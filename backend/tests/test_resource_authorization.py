from datetime import date

import pytest
from sqlalchemy import text

from app.common.errors import ForbiddenError, NotFoundError
from app.extensions import db
from app.models import RoleCode, StaffPosition, User
from app.services.authorization_service import (
    require_class_access,
    require_invoice_access,
    require_student_access,
)


@pytest.fixture
def resource_scope(app, users, create_staff, create_user):
    outsider_id = create_staff("gv09", StaffPosition.LECTURER, "GV09")
    other_student_user_id = create_user("hs002", RoleCode.STUDENT_PARENT, email=None)
    with app.app_context():
        lecturer_profile = db.session.execute(
            text("SELECT id FROM staff_profiles WHERE user_id = :id"),
            {"id": users["lecturer"]},
        ).scalar_one()
        assistant_profile = db.session.execute(
            text("SELECT id FROM staff_profiles WHERE user_id = :id"),
            {"id": users["assistant"]},
        ).scalar_one()
        outsider_profile = db.session.execute(
            text("SELECT id FROM staff_profiles WHERE user_id = :id"),
            {"id": outsider_id},
        ).scalar_one()
        guardian_id = db.session.execute(
            text("INSERT INTO guardians (full_name, phone, relationship) OUTPUT INSERTED.id VALUES (N'Phụ huynh', '0901234567', 'FATHER')")
        ).scalar_one()
        other_guardian_id = db.session.execute(
            text("INSERT INTO guardians (full_name, phone, relationship) OUTPUT INSERTED.id VALUES (N'Phụ huynh khác', '0901234568', 'MOTHER')")
        ).scalar_one()
        level_id = db.session.execute(
            text("INSERT INTO levels (code, name, min_age, max_age, sort_order) OUTPUT INSERTED.id VALUES ('KID_1', 'Kid 1', 6, 7, 2)")
        ).scalar_one()
        student_id = db.session.execute(
            text("""INSERT INTO students
                (student_code, full_name, date_of_birth, guardian_id, user_id,
                 current_level_id, enrolled_at, status)
                OUTPUT INSERTED.id
                VALUES ('HS001', N'Học viên 1', '2018-01-01', :guardian, :user,
                        :level, '2025-01-01', 'ACTIVE')"""),
            {"guardian": guardian_id, "user": users["student"], "level": level_id},
        ).scalar_one()
        other_student_id = db.session.execute(
            text("""INSERT INTO students
                (student_code, full_name, date_of_birth, guardian_id, user_id,
                 current_level_id, enrolled_at, status)
                OUTPUT INSERTED.id
                VALUES ('HS002', N'Học viên 2', '2018-02-01', :guardian, :user,
                        :level, '2025-01-01', 'ACTIVE')"""),
            {"guardian": other_guardian_id, "user": other_student_user_id, "level": level_id},
        ).scalar_one()
        course_id = db.session.execute(
            text("""INSERT INTO courses
                (course_code, level_id, name, sessions_per_week, session_minutes,
                 monthly_fee, status)
                OUTPUT INSERTED.id
                VALUES ('C-K1', :level, 'Kid 1', 2, 90, 1000000, 'ACTIVE')"""),
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
                "lecturer": lecturer_profile,
                "assistant": assistant_profile,
                "room": room_id,
            },
        ).scalar_one()
        other_class_id = db.session.execute(
            text("""INSERT INTO classes
                (class_code, name, course_id, lecturer_id, assistant_id,
                 default_room_id, max_students, start_date, end_date, status)
                OUTPUT INSERTED.id
                VALUES ('L2', 'Class 2', :course, :lecturer, NULL,
                        :room, 20, '2026-01-01', '2026-12-31', 'ONGOING')"""),
            {"course": course_id, "lecturer": outsider_profile, "room": room_id},
        ).scalar_one()
        db.session.execute(
            text("INSERT INTO class_enrollments (class_id, student_id, enrolled_date, status) VALUES (:class_id, :student_id, '2026-01-01', 'ACTIVE')"),
            {"class_id": class_id, "student_id": student_id},
        )
        db.session.execute(
            text("INSERT INTO class_enrollments (class_id, student_id, enrolled_date, status) VALUES (:class_id, :student_id, '2026-01-01', 'ACTIVE')"),
            {"class_id": other_class_id, "student_id": other_student_id},
        )
        invoice_id = _insert_invoice(student_id, class_id, "INV001", date(2026, 1, 1))
        other_invoice_id = _insert_invoice(
            other_student_id, other_class_id, "INV002", date(2026, 2, 1)
        )
        db.session.commit()
    return {
        "student": student_id,
        "other_student": other_student_id,
        "class": class_id,
        "other_class": other_class_id,
        "invoice": invoice_id,
        "other_invoice": other_invoice_id,
        "outsider": outsider_id,
    }


def _insert_invoice(student_id, class_id, code, billing_month):
    return db.session.execute(
        text("""INSERT INTO tuition_invoices
            (invoice_code, student_id, class_id, billing_month, base_amount,
             discount_amount, final_amount, paid_amount, due_date, status, generated_by)
            OUTPUT INSERTED.id
            VALUES (:code, :student, :class_id, :month, 1000000,
                    0, 1000000, 0, :month, 'UNPAID', 'MANUAL')"""),
        {
            "code": code,
            "student": student_id,
            "class_id": class_id,
            "month": billing_month,
        },
    ).scalar_one()


def actor(user_id):
    return db.session.get(User, user_id)


def test_manager_can_access_all_scoped_resources(app, users, resource_scope):
    with app.app_context():
        manager = actor(users["manager"])
        require_student_access(manager, resource_scope["other_student"])
        require_class_access(manager, resource_scope["other_class"])
        require_invoice_access(manager, resource_scope["other_invoice"])


@pytest.mark.parametrize("staff_key", ["lecturer", "assistant"])
def test_assigned_staff_can_access_class_and_its_students(
    app, users, resource_scope, staff_key
):
    with app.app_context():
        staff = actor(users[staff_key])
        require_class_access(staff, resource_scope["class"])
        require_student_access(staff, resource_scope["student"])
        with pytest.raises(ForbiddenError):
            require_invoice_access(staff, resource_scope["invoice"])


def test_unassigned_staff_cannot_access_class_or_student(app, resource_scope):
    with app.app_context():
        outsider = actor(resource_scope["outsider"])
        with pytest.raises(ForbiddenError):
            require_class_access(outsider, resource_scope["class"])
        with pytest.raises(ForbiddenError):
            require_student_access(outsider, resource_scope["student"])


def test_student_parent_only_accesses_own_scope(app, users, resource_scope):
    with app.app_context():
        student = actor(users["student"])
        require_student_access(student, resource_scope["student"])
        require_class_access(student, resource_scope["class"])
        require_invoice_access(student, resource_scope["invoice"])
        with pytest.raises(ForbiddenError):
            require_student_access(student, resource_scope["other_student"])
        with pytest.raises(ForbiddenError):
            require_class_access(student, resource_scope["other_class"])
        with pytest.raises(ForbiddenError):
            require_invoice_access(student, resource_scope["other_invoice"])


@pytest.mark.parametrize(
    "checker",
    [require_student_access, require_class_access, require_invoice_access],
)
def test_resource_authorization_returns_not_found_for_unknown_id(
    app, users, resource_scope, checker
):
    with app.app_context():
        with pytest.raises(NotFoundError):
            checker(actor(users["manager"]), 999999)
