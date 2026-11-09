"""SQL Server integrity checks for the additive Manager schema (0010)."""

import pytest
from flask_migrate import downgrade, upgrade
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import StaffProfile, User


@pytest.fixture
def academic_schema_data(app, users):
    """Reuse the static catalogs preserved by the reset fixture."""
    with app.app_context():
        resource_id = db.session.execute(
            text("SELECT id FROM permission_resources WHERE code = 'GRADES'")
        ).scalar_one()
        group_id = db.session.execute(
            text("SELECT id FROM course_groups WHERE code = 'KID'")
        ).scalar_one()
        role_id = db.session.execute(
            text("SELECT role_id FROM users WHERE id = :id"),
            {"id": users["lecturer"]},
        ).scalar_one()
        staff_id = db.session.scalar(
            select(StaffProfile.id).where(StaffProfile.user_id == users["lecturer"])
        )
        level_id = db.session.execute(
            text("""INSERT INTO levels (code, name, min_age, max_age, sort_order)
                OUTPUT INSERTED.id VALUES ('KID_4', 'Kid 4', 8, 9, 5)""")
        ).scalar_one()
        course_id = db.session.execute(
            text("""INSERT INTO courses
                (course_code, level_id, name, sessions_per_week, session_minutes,
                 monthly_fee, status, group_id, curriculum_level)
                OUTPUT INSERTED.id
                VALUES ('C-KID4', :level, 'English Kid 4', 2, 90, 1000000,
                        'ACTIVE', :group_id, 4)"""),
            {"level": level_id, "group_id": group_id},
        ).scalar_one()
        db.session.commit()
    return {
        "resource_id": resource_id,
        "group_id": group_id,
        "role_id": role_id,
        "staff_id": staff_id,
        "course_id": course_id,
        "user_id": users["lecturer"],
        "manager_id": users["manager"],
    }


def _insert_permission(data, **overrides):
    payload = {
        "role_id": data["role_id"],
        "resource_id": data["resource_id"],
        "action": "UPDATE",
        "effect": "ALLOW",
        "condition": None,
        "actor": data["manager_id"],
        **overrides,
    }
    return db.session.execute(
        text("""INSERT INTO role_permissions
            (role_id, resource_id, action_code, effect, condition_code, updated_by)
            OUTPUT INSERTED.id
            VALUES (:role_id, :resource_id, :action, :effect, :condition, :actor)"""),
        payload,
    ).scalar_one()


def test_permission_matrix_cannot_have_two_values_for_one_cell(app, academic_schema_data):
    with app.app_context():
        _insert_permission(academic_schema_data)
        db.session.commit()
        with pytest.raises(IntegrityError):
            _insert_permission(academic_schema_data, effect="DENY")
        db.session.rollback()


@pytest.mark.parametrize("condition", [None, "", "   "])
def test_conditional_permission_requires_a_machine_readable_condition(
    app, academic_schema_data, condition
):
    with app.app_context():
        with pytest.raises(IntegrityError):
            _insert_permission(
                academic_schema_data, effect="CONDITIONAL", condition=condition
            )
        db.session.rollback()


def test_conditional_permission_stores_the_scope_without_becoming_an_allow(
    app, academic_schema_data
):
    with app.app_context():
        permission_id = _insert_permission(
            academic_schema_data,
            effect="CONDITIONAL",
            condition="ASSIGNED_CLASS_AND_OPEN_GRADING_WINDOW",
        )
        db.session.commit()
        row = db.session.execute(
            text("SELECT effect, condition_code FROM role_permissions WHERE id = :id"),
            {"id": permission_id},
        ).mappings().one()
        assert row["effect"] == "CONDITIONAL"
        assert row["condition_code"] == "ASSIGNED_CLASS_AND_OPEN_GRADING_WINDOW"


@pytest.mark.parametrize(
    "overrides",
    [
        {"role_id": 999999},
        {"resource_id": 999999},
        {"actor": 999999},
        {"action": "EXECUTE"},
        {"effect": "MAYBE"},
    ],
)
def test_permissions_require_existing_entities_and_supported_values(
    app, academic_schema_data, overrides
):
    with app.app_context():
        with pytest.raises(IntegrityError):
            _insert_permission(academic_schema_data, **overrides)
        db.session.rollback()


@pytest.mark.parametrize("stage", [0, -1, 100])
def test_curriculum_level_rejects_invalid_numbers(app, academic_schema_data, stage):
    with app.app_context():
        with pytest.raises(IntegrityError):
            db.session.execute(
                text("UPDATE courses SET curriculum_level = :stage WHERE id = :id"),
                {"stage": stage, "id": academic_schema_data["course_id"]},
            )
        db.session.rollback()


def test_course_group_is_a_reference_and_cannot_be_deleted_while_used(
    app, academic_schema_data
):
    with app.app_context():
        with pytest.raises(IntegrityError):
            db.session.execute(
                text("UPDATE courses SET group_id = 999999 WHERE id = :id"),
                {"id": academic_schema_data["course_id"]},
            )
        db.session.rollback()
        with pytest.raises(IntegrityError):
            db.session.execute(
                text("DELETE FROM course_groups WHERE id = :id"),
                {"id": academic_schema_data["group_id"]},
            )
        db.session.rollback()


@pytest.mark.parametrize(
    "statement, parameter_key, value",
    [
        ("UPDATE users SET gender = :value WHERE id = :id", "user_id", "UNKNOWN"),
        (
            "UPDATE staff_profiles SET contract_type = :value WHERE id = :id",
            "staff_id", "UNKNOWN",
        ),
        (
            "UPDATE staff_profiles SET hourly_rate = :value WHERE id = :id",
            "staff_id", -1,
        ),
        ("UPDATE users SET locked_by = :value WHERE id = :id", "user_id", 999999),
        ("UPDATE users SET deleted_by = :value WHERE id = :id", "user_id", 999999),
        (
            "UPDATE users SET locked_at = '2026-11-08T08:00:00+07:00', "
            "locked_until = :value WHERE id = :id",
            "user_id", "2026-11-07T08:00:00+07:00",
        ),
    ],
)
def test_profile_and_account_metadata_rejects_invalid_values(
    app, academic_schema_data, statement, parameter_key, value
):
    with app.app_context():
        with pytest.raises(IntegrityError):
            db.session.execute(
                text(statement),
                {"id": academic_schema_data[parameter_key], "value": value},
            )
        db.session.rollback()


def test_hourly_rate_does_not_overwrite_legacy_session_rate(app, academic_schema_data):
    with app.app_context():
        profile = db.session.get(StaffProfile, academic_schema_data["staff_id"])
        assert profile.hourly_rate is None
        old_session_rate = profile.rate_per_session
        profile.hourly_rate = 90000
        profile.contract_type = "PART_TIME"
        profile.certificate = "IELTS 7.0"
        user = db.session.get(User, academic_schema_data["user_id"])
        user.gender = "OTHER"
        user.address = "25 Nguyễn Văn Linh"
        db.session.commit()
        db.session.expire_all()
        assert profile.hourly_rate == 90000
        assert profile.rate_per_session == old_session_rate
        assert user.address == "25 Nguyễn Văn Linh"


def test_upgrade_backfills_course_groups_without_replacing_existing_levels_or_profiles(
    app, academic_schema_data
):
    """Run the real migration over populated pre-0010 rows, then restore head."""
    with app.app_context():
        db.session.remove()
        try:
            downgrade(revision="0009")
            before = db.session.execute(
                text("""SELECT c.id, c.course_code, c.name, c.level_id, c.monthly_fee,
                               l.code AS level_code
                        FROM courses c JOIN levels l ON l.id = c.level_id""")
            ).mappings().all()
            staff_before = db.session.execute(
                text("SELECT id, staff_code, rate_per_session FROM staff_profiles ORDER BY id")
            ).all()
            users_before = db.session.execute(
                text("SELECT id, username, password_hash, auth_version FROM users ORDER BY id")
            ).all()
            db.session.remove()
            upgrade()
            after = db.session.execute(
                text("""SELECT c.id, c.course_code, c.name, c.level_id, c.monthly_fee,
                               l.code AS level_code
                        FROM courses c JOIN levels l ON l.id = c.level_id""")
            ).mappings().all()
            assert after == before
            assert db.session.execute(
                text("SELECT id, staff_code, rate_per_session FROM staff_profiles ORDER BY id")
            ).all() == staff_before
            assert db.session.execute(
                text("SELECT id, username, password_hash, auth_version FROM users ORDER BY id")
            ).all() == users_before
            mapping = db.session.execute(
                text("""SELECT g.code AS group_code, c.curriculum_level
                        FROM courses c JOIN course_groups g ON g.id = c.group_id
                        WHERE c.id = :id"""),
                {"id": academic_schema_data["course_id"]},
            ).mappings().one()
            assert mapping == {"group_code": "KID", "curriculum_level": 4}
        finally:
            db.session.remove()
            upgrade()
