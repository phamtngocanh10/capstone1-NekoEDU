import pytest
from sqlalchemy import select, text, update

from app.common.errors import ForbiddenError, NotFoundError
from app.extensions import db
from app.models import AuditAction, AuditLog, StaffPosition, StaffProfile, User
from app.services.authorization_service import require_session_access


@pytest.fixture
def assignment_scope(app, users, create_staff):
    lecturer_2_user = create_staff("gv09", StaffPosition.LECTURER, "GV09")
    assistant_2_user = create_staff("tg09", StaffPosition.TEACHING_ASSISTANT, "TG09")
    outsider_user = create_staff("gv10", StaffPosition.LECTURER, "GV10")
    with app.app_context():
        staff_ids = {
            row.user_id: row.id
            for row in db.session.scalars(select(StaffProfile)).all()
        }
        level_id = db.session.execute(
            text("INSERT INTO levels (code, name, min_age, max_age, sort_order) OUTPUT INSERTED.id VALUES ('KID_1', 'Kid 1', 6, 7, 2)")
        ).scalar_one()
        course_id = db.session.execute(
            text("""INSERT INTO courses
                (course_code, level_id, name, sessions_per_week, session_minutes,
                 monthly_fee, status)
                OUTPUT INSERTED.id VALUES ('C1', :level, 'Course 1', 2, 90, 1000000, 'ACTIVE')"""),
            {"level": level_id},
        ).scalar_one()
        room_id = db.session.execute(
            text("INSERT INTO rooms (code, name, capacity, status) OUTPUT INSERTED.id VALUES ('R1', 'Room 1', 20, 'AVAILABLE')")
        ).scalar_one()
        class_id = db.session.execute(
            text("""INSERT INTO classes
                (class_code, name, course_id, lecturer_id, assistant_id,
                 default_room_id, max_students, start_date, end_date, status)
                OUTPUT INSERTED.id
                VALUES ('L1', 'Class 1', :course, :lecturer, :assistant,
                        :room, 20, '2026-01-01', '2026-12-31', 'ONGOING')"""),
            {
                "course": course_id,
                "lecturer": staff_ids[users["lecturer"]],
                "assistant": staff_ids[users["assistant"]],
                "room": room_id,
            },
        ).scalar_one()
        db.session.commit()
    return {
        "class": class_id,
        "lecturer_1": staff_ids[users["lecturer"]],
        "assistant_1": staff_ids[users["assistant"]],
        "lecturer_2": staff_ids[lecturer_2_user],
        "assistant_2": staff_ids[assistant_2_user],
        "lecturer_2_user": lecturer_2_user,
        "assistant_2_user": assistant_2_user,
        "outsider_user": outsider_user,
        "room": room_id,
    }


def endpoint(scope):
    return f"/api/v1/classes/{scope['class']}/staff"


def test_manager_assigns_lecturer_and_assistant_with_audit(
    app, client, users, auth_header, assignment_scope
):
    payload = {
        "lecturer_id": assignment_scope["lecturer_2"],
        "assistant_id": assignment_scope["assistant_2"],
    }

    res = client.patch(
        endpoint(assignment_scope),
        headers=auth_header(users["manager"]),
        json=payload,
    )

    assert res.status_code == 200
    body = res.get_json()
    assert body["lecturer"]["staff_code"] == "GV09"
    assert body["assistant"]["staff_code"] == "TG09"
    with app.app_context():
        assigned = db.session.execute(
            text("SELECT lecturer_id, assistant_id FROM classes WHERE id = :id"),
            {"id": assignment_scope["class"]},
        ).mappings().one()
        assert assigned == payload
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "classes",
                AuditLog.entity_id == assignment_scope["class"],
            )
        )
        assert audit.action == AuditAction.UPDATE
        assert audit.actor_user_id == users["manager"]
        assert audit.old_data["lecturer_id"] == assignment_scope["lecturer_1"]
        assert audit.new_data == payload


def test_manager_can_remove_optional_assistant(client, users, auth_header, assignment_scope):
    res = client.patch(
        endpoint(assignment_scope),
        headers=auth_header(users["manager"]),
        json={"lecturer_id": assignment_scope["lecturer_1"], "assistant_id": None},
    )

    assert res.status_code == 200
    assert res.get_json()["assistant"] is None


def test_same_assignment_is_idempotent_without_audit(
    app, client, users, auth_header, assignment_scope
):
    res = client.patch(
        endpoint(assignment_scope),
        headers=auth_header(users["manager"]),
        json={
            "lecturer_id": assignment_scope["lecturer_1"],
            "assistant_id": assignment_scope["assistant_1"],
        },
    )

    assert res.status_code == 200
    with app.app_context():
        assert db.session.scalar(select(AuditLog)) is None


def test_lecturer_and_assistant_must_be_different(client, users, auth_header, assignment_scope):
    res = client.patch(
        endpoint(assignment_scope),
        headers=auth_header(users["manager"]),
        json={
            "lecturer_id": assignment_scope["lecturer_1"],
            "assistant_id": assignment_scope["lecturer_1"],
        },
    )

    assert res.status_code == 422
    assert "assistant_id" in res.get_json()["errors"]["json"]


def test_assignment_requires_correct_positions(client, users, auth_header, assignment_scope):
    headers = auth_header(users["manager"])
    wrong_lecturer = client.patch(
        endpoint(assignment_scope),
        headers=headers,
        json={"lecturer_id": assignment_scope["assistant_1"], "assistant_id": None},
    )
    wrong_assistant = client.patch(
        endpoint(assignment_scope),
        headers=headers,
        json={
            "lecturer_id": assignment_scope["lecturer_1"],
            "assistant_id": assignment_scope["lecturer_2"],
        },
    )

    assert wrong_lecturer.status_code == 409
    assert wrong_assistant.status_code == 409


@pytest.mark.parametrize("inactive_kind", ["profile", "account"])
def test_assignment_requires_active_staff_and_account(
    app, client, users, auth_header, assignment_scope, inactive_kind
):
    with app.app_context():
        if inactive_kind == "profile":
            db.session.execute(
                update(StaffProfile)
                .where(StaffProfile.id == assignment_scope["lecturer_2"])
                .values(status="INACTIVE")
            )
        else:
            db.session.execute(
                update(User)
                .where(User.id == assignment_scope["lecturer_2_user"])
                .values(status="LOCKED")
            )
        db.session.commit()

    res = client.patch(
        endpoint(assignment_scope),
        headers=auth_header(users["manager"]),
        json={"lecturer_id": assignment_scope["lecturer_2"], "assistant_id": None},
    )

    assert res.status_code == 409
    assert "hoạt động" in res.get_json()["message"]


def test_assignment_handles_missing_class_and_staff(client, users, auth_header, assignment_scope):
    headers = auth_header(users["manager"])
    missing_class = client.patch(
        "/api/v1/classes/999999/staff",
        headers=headers,
        json={"lecturer_id": assignment_scope["lecturer_1"], "assistant_id": None},
    )
    missing_staff = client.patch(
        endpoint(assignment_scope),
        headers=headers,
        json={"lecturer_id": 999999, "assistant_id": None},
    )

    assert missing_class.status_code == 404
    assert missing_staff.status_code == 404


def test_assignment_is_manager_only_before_validation(client, users, auth_header, assignment_scope):
    url = endpoint(assignment_scope)
    assert client.patch(url, json={}).status_code == 401
    assert client.patch(url, headers=auth_header(users["lecturer"]), json={}).status_code == 403


@pytest.mark.parametrize("actor", ["manager", "lecturer", "assistant"])
def test_manager_and_assigned_staff_can_read_class_assignment(
    client, users, auth_header, assignment_scope, actor
):
    res = client.get(endpoint(assignment_scope), headers=auth_header(users[actor]))

    assert res.status_code == 200
    assert res.get_json()["lecturer"]["staff_code"] == "GV01"
    assert "rate_per_session" not in res.get_json()["lecturer"]


def test_unassigned_staff_and_student_cannot_read_class_assignment(
    client, users, auth_header, assignment_scope
):
    assert client.get(
        endpoint(assignment_scope),
        headers=auth_header(assignment_scope["outsider_user"]),
    ).status_code == 403
    assert client.get(
        endpoint(assignment_scope), headers=auth_header(users["student"])
    ).status_code == 403


def test_class_scope_changes_immediately_after_reassignment(
    client, users, auth_header, assignment_scope
):
    old_lecturer = auth_header(users["lecturer"])
    new_lecturer = auth_header(assignment_scope["lecturer_2_user"])
    assert client.patch(
        endpoint(assignment_scope),
        headers=auth_header(users["manager"]),
        json={"lecturer_id": assignment_scope["lecturer_2"], "assistant_id": None},
    ).status_code == 200

    assert client.get(endpoint(assignment_scope), headers=old_lecturer).status_code == 403
    assert client.get(endpoint(assignment_scope), headers=new_lecturer).status_code == 200


def test_class_assignment_get_handles_missing_class(client, users, auth_header):
    assert client.get(
        "/api/v1/classes/999999/staff",
        headers=auth_header(users["manager"]),
    ).status_code == 404


def test_session_scope_accepts_class_or_session_assignment(
    app, users, assignment_scope
):
    with app.app_context():
        session_id = db.session.execute(
            text("""INSERT INTO class_sessions
                (class_id, session_date, start_time, end_time, room_id,
                 lecturer_id, assistant_id, status)
                OUTPUT INSERTED.id
                VALUES (:class_id, '2026-06-01', '08:00', '09:30', :room,
                        :lecturer, :assistant, 'SCHEDULED')"""),
            {
                "class_id": assignment_scope["class"],
                "room": assignment_scope["room"],
                "lecturer": assignment_scope["lecturer_2"],
                "assistant": assignment_scope["assistant_2"],
            },
        ).scalar_one()
        db.session.commit()

        for user_id in (
            users["manager"],
            users["lecturer"],
            users["assistant"],
            assignment_scope["lecturer_2_user"],
            assignment_scope["assistant_2_user"],
        ):
            require_session_access(db.session.get(User, user_id), session_id)
        with pytest.raises(ForbiddenError):
            require_session_access(
                db.session.get(User, assignment_scope["outsider_user"]), session_id
            )
        with pytest.raises(NotFoundError):
            require_session_access(db.session.get(User, users["manager"]), 999999)
