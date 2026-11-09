from datetime import date, timedelta
import json

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import StaffProfile


@pytest.fixture
def tuition_scope(app, users, create_user):
    from app.models import RoleCode

    unlinked_parent = create_user("parent_tuition_other", RoleCode.STUDENT_PARENT, email=None)
    with app.app_context():
        staff_ids = {
            profile.user_id: profile.id
            for profile in db.session.scalars(select(StaffProfile)).all()
        }
        db.session.execute(
            text(
                "INSERT INTO levels (code, name, min_age, max_age, sort_order) "
                "VALUES ('KINDY', N'Kindy', 4, 5, 0)"
            )
        )
        level_id = db.session.execute(
            text(
                "INSERT INTO levels (code, name, min_age, max_age, sort_order) "
                "OUTPUT INSERTED.id VALUES ('KID_1', N'Kid 1', 6, 7, 1)"
            )
        ).scalar_one()
        course_id = db.session.execute(
            text(
                """INSERT INTO courses
                    (course_code, level_id, name, sessions_per_week, session_minutes,
                     monthly_fee, status)
                   OUTPUT INSERTED.id
                   VALUES ('C-TUI', :level, N'Khóa học phí', 2, 90, 1000000, 'ACTIVE')"""
            ),
            {"level": level_id},
        ).scalar_one()
        room_id = db.session.execute(
            text(
                "INSERT INTO rooms (code, name, capacity, status) OUTPUT INSERTED.id "
                "VALUES ('R-TUI', N'Phòng học phí', 20, 'AVAILABLE')"
            )
        ).scalar_one()
        class_id = db.session.execute(
            text(
                """INSERT INTO classes
                    (class_code, name, course_id, lecturer_id, assistant_id,
                     default_room_id, max_students, start_date, end_date, status)
                   OUTPUT INSERTED.id
                   VALUES ('CLS-TUI', N'Lớp học phí', :course, :lecturer, :assistant,
                           :room, 20, '2026-01-01', '2026-12-31', 'ONGOING')"""
            ),
            {
                "course": course_id,
                "lecturer": staff_ids[users["lecturer"]],
                "assistant": staff_ids[users["assistant"]],
                "room": room_id,
            },
        ).scalar_one()
        guardian_id = db.session.execute(
            text(
                "INSERT INTO guardians (full_name, phone, relationship) "
                "OUTPUT INSERTED.id VALUES (N'Phụ huynh học phí', '0902000001', 'GUARDIAN')"
            )
        ).scalar_one()
        dummy_student_id = db.session.execute(
            text(
                """INSERT INTO students
                    (student_code, full_name, date_of_birth, guardian_id,
                     current_level_id, enrolled_at, status)
                   OUTPUT INSERTED.id
                   VALUES ('HT000', N'Học sinh giả', '2018-01-01', :guardian,
                           :level, '2026-01-01', 'ACTIVE')"""
            ),
            {"guardian": guardian_id, "level": level_id},
        ).scalar_one()
        student_id = db.session.execute(
            text(
                """INSERT INTO students
                    (student_code, full_name, date_of_birth, guardian_id, user_id,
                     current_level_id, enrolled_at, status)
                   OUTPUT INSERTED.id
                   VALUES ('HT001', N'Học sinh học phí', '2018-01-01', :guardian,
                           :user_id, :level, '2026-01-01', 'ACTIVE')"""
            ),
            {"guardian": guardian_id, "user_id": users["student"], "level": level_id},
        ).scalar_one()
        db.session.execute(
            text(
                """INSERT INTO class_enrollments
                    (class_id, student_id, enrolled_date, status)
                   VALUES (:class_id, :student_id, '2026-01-01', 'ACTIVE')"""
            ),
            {"class_id": class_id, "student_id": dummy_student_id},
        )
        enrollment_id = db.session.execute(
            text(
                """INSERT INTO class_enrollments
                    (class_id, student_id, enrolled_date, status)
                   OUTPUT INSERTED.id
                   VALUES (:class_id, :student_id, '2026-01-01', 'ACTIVE')"""
            ),
            {"class_id": class_id, "student_id": student_id},
        ).scalar_one()
        session_ids = []
        start = date(2026, 1, 3)
        for index in range(18):
            session_id = db.session.execute(
                text(
                    """INSERT INTO class_sessions
                        (class_id, session_date, start_time, end_time, room_id,
                         lecturer_id, assistant_id, status)
                       OUTPUT INSERTED.id
                       VALUES (:class_id, :session_date, '18:00', '19:30', :room,
                               :lecturer, :assistant, :status)"""
                ),
                {
                    "class_id": class_id,
                    "session_date": start + timedelta(days=index * 5),
                    "room": room_id,
                    "lecturer": staff_ids[users["lecturer"]],
                    "assistant": staff_ids[users["assistant"]],
                    "status": "CANCELLED" if index == 3 else "SCHEDULED",
                },
            ).scalar_one()
            session_ids.append(session_id)
        db.session.commit()
    return {
        "class": class_id,
        "dummy_student": dummy_student_id,
        "student": student_id,
        "enrollment": enrollment_id,
        "sessions": session_ids,
        "unlinked_parent": unlinked_parent,
    }


def generate_cycle(client, users, auth_header, scope, enrollment_id=None):
    return client.post(
        "/api/v1/tuition-cycles/generate",
        headers=auth_header(users["manager"]),
        json={"enrollment_id": enrollment_id or scope["enrollment"]},
    )


def test_f62_generates_exactly_eight_ordered_sessions_including_cancelled(
    app, client, users, auth_header, tuition_scope
):
    response = generate_cycle(client, users, auth_header, tuition_scope)
    assert response.status_code == 201
    body = response.get_json()
    assert body["cycle_number"] == 1
    assert body["status"] == "DRAFT"
    assert [item["sequence_no"] for item in body["sessions"]] == list(range(1, 9))
    assert [item["id"] for item in body["sessions"]] == tuition_scope["sessions"][:8]
    assert body["sessions"][3]["status"] == "CANCELLED"
    assert body["start_session_id"] == tuition_scope["sessions"][0]
    assert body["end_session_id"] == tuition_scope["sessions"][7]
    with app.app_context():
        audit = db.session.execute(
            text("SELECT new_data FROM audit_logs WHERE entity_name = 'tuition_cycles'")
        ).scalar_one()
    assert json.loads(audit)["session_ids"] == tuition_scope["sessions"][:8]


def test_f62_second_cycle_uses_next_eight_without_overlap(
    client, users, auth_header, tuition_scope
):
    first = generate_cycle(client, users, auth_header, tuition_scope).get_json()
    second_response = generate_cycle(client, users, auth_header, tuition_scope)
    assert second_response.status_code == 201
    second = second_response.get_json()
    assert second["cycle_number"] == 2
    assert [item["id"] for item in second["sessions"]] == tuition_scope["sessions"][8:16]
    assert set(item["id"] for item in first["sessions"]).isdisjoint(
        item["id"] for item in second["sessions"]
    )


def test_f62_rejects_when_fewer_than_eight_unused_sessions_remain(
    app, client, users, auth_header, tuition_scope
):
    assert generate_cycle(client, users, auth_header, tuition_scope).status_code == 201
    assert generate_cycle(client, users, auth_header, tuition_scope).status_code == 201
    response = generate_cycle(client, users, auth_header, tuition_scope)
    assert response.status_code == 409
    assert response.get_json()["errors"] == {
        "available_sessions": 2,
        "required_sessions": 8,
    }
    with app.app_context():
        assert db.session.execute(text("SELECT COUNT(*) FROM tuition_cycles")).scalar_one() == 2


def test_f62_generation_is_not_bound_to_calendar_month(
    client, users, auth_header, tuition_scope
):
    body = generate_cycle(client, users, auth_header, tuition_scope).get_json()
    assert body["start_date"][:7] != body["end_date"][:7]


def test_f62_only_manager_can_generate(
    client, users, auth_header, tuition_scope
):
    for actor in ("lecturer", "assistant", "student"):
        assert client.post(
            "/api/v1/tuition-cycles/generate",
            headers=auth_header(users[actor]),
            json={"enrollment_id": tuition_scope["enrollment"]},
        ).status_code == 403


def test_f62_requires_authentication_before_validation(client):
    assert client.post("/api/v1/tuition-cycles/generate", json={}).status_code == 401


def test_f62_validates_enrollment_id(client, users, auth_header):
    for value in ("1", True, 0, -1):
        assert client.post(
            "/api/v1/tuition-cycles/generate",
            headers=auth_header(users["manager"]),
            json={"enrollment_id": value},
        ).status_code == 422


def test_f62_returns_not_found_for_missing_enrollment(
    client, users, auth_header, tuition_scope
):
    assert generate_cycle(
        client, users, auth_header, tuition_scope, enrollment_id=999999
    ).status_code == 404


def test_f62_manager_and_linked_parent_get_cycle(
    client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    for actor in (users["manager"], users["student"]):
        response = client.get(
            f"/api/v1/tuition-cycles/{cycle_id}", headers=auth_header(actor)
        )
        assert response.status_code == 200
        assert len(response.get_json()["sessions"]) == 8


def test_f62_denies_staff_and_unlinked_parent_get(
    client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    for actor in (
        users["lecturer"],
        users["assistant"],
        tuition_scope["unlinked_parent"],
    ):
        assert client.get(
            f"/api/v1/tuition-cycles/{cycle_id}", headers=auth_header(actor)
        ).status_code == 403


def test_f62_database_prevents_same_session_in_two_cycles_for_enrollment(
    app, client, users, auth_header, tuition_scope
):
    cycle = generate_cycle(client, users, auth_header, tuition_scope).get_json()
    with app.app_context():
        with pytest.raises(IntegrityError):
            db.session.execute(
                text(
                    """INSERT INTO tuition_cycle_sessions
                        (cycle_id, enrollment_id, session_id, sequence_no)
                       VALUES (:cycle, :enrollment, :session, 8)"""
                ),
                {
                    "cycle": cycle["id"],
                    "enrollment": tuition_scope["enrollment"],
                    "session": tuition_scope["sessions"][0],
                },
            )
            db.session.flush()
        db.session.rollback()


def test_f62_returns_not_found_for_missing_cycle(client, users, auth_header):
    assert client.get(
        "/api/v1/tuition-cycles/999999", headers=auth_header(users["manager"])
    ).status_code == 404


def _create_midterm_enrollment(app, users, scope, *, enrolled_date="2026-01-28", left_date=None):
    with app.app_context():
        guardian = db.session.execute(
            text(
                "INSERT INTO guardians (full_name, phone, relationship) "
                "OUTPUT INSERTED.id VALUES (N'Phụ huynh giữa kỳ', '0902000002', 'GUARDIAN')"
            )
        ).scalar_one()
        level = db.session.execute(
            text("SELECT current_level_id FROM students WHERE id = :id"),
            {"id": scope["student"]},
        ).scalar_one()
        student = db.session.execute(
            text(
                """INSERT INTO students
                    (student_code, full_name, date_of_birth, guardian_id,
                     current_level_id, enrolled_at, status)
                   OUTPUT INSERTED.id VALUES ('HT002', N'Học sinh giữa kỳ',
                   '2018-02-01', :guardian, :level, :enrolled, 'ACTIVE')"""
            ),
            {"guardian": guardian, "level": level, "enrolled": enrolled_date},
        ).scalar_one()
        enrollment = db.session.execute(
            text(
                """INSERT INTO class_enrollments
                    (class_id, student_id, enrolled_date, left_date, status)
                   OUTPUT INSERTED.id VALUES (:class_id, :student_id, :enrolled,
                   :left_date, 'ACTIVE')"""
            ),
            {
                "class_id": scope["class"],
                "student_id": student,
                "enrolled": enrolled_date,
                "left_date": left_date,
            },
        ).scalar_one()
        db.session.commit()
    return enrollment


def test_f63_midterm_student_cycle_starts_at_first_effective_session(
    app, client, users, auth_header, tuition_scope
):
    enrollment = _create_midterm_enrollment(app, users, tuition_scope)
    response = generate_cycle(
        client, users, auth_header, tuition_scope, enrollment_id=enrollment
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["cycle_number"] == 1
    assert body["sessions"][0]["session_date"] >= "2026-01-28"
    assert body["sessions"][0]["id"] == tuition_scope["sessions"][5]
    assert [item["id"] for item in body["sessions"]] == tuition_scope["sessions"][5:13]


def test_f63_midterm_cycle_is_independent_from_existing_student_cycle(
    app, client, users, auth_header, tuition_scope
):
    first_student_cycle = generate_cycle(client, users, auth_header, tuition_scope).get_json()
    enrollment = _create_midterm_enrollment(app, users, tuition_scope)
    midterm_cycle = generate_cycle(
        client, users, auth_header, tuition_scope, enrollment_id=enrollment
    ).get_json()
    assert first_student_cycle["cycle_number"] == 1
    assert midterm_cycle["cycle_number"] == 1
    # Cùng class_session có thể thuộc chu kỳ của hai enrollment khác nhau.
    assert set(item["id"] for item in first_student_cycle["sessions"]) & set(
        item["id"] for item in midterm_cycle["sessions"]
    )


def test_f63_does_not_charge_sessions_before_enrollment(
    app, client, users, auth_header, tuition_scope
):
    enrollment = _create_midterm_enrollment(app, users, tuition_scope)
    cycle = generate_cycle(
        client, users, auth_header, tuition_scope, enrollment_id=enrollment
    ).get_json()
    assert not set(tuition_scope["sessions"][:5]) & {
        item["id"] for item in cycle["sessions"]
    }


def test_f63_respects_left_date_and_requires_eight_effective_sessions(
    app, client, users, auth_header, tuition_scope
):
    enrollment = _create_midterm_enrollment(
        app, users, tuition_scope, enrolled_date="2026-01-28", left_date="2026-02-20"
    )
    response = generate_cycle(
        client, users, auth_header, tuition_scope, enrollment_id=enrollment
    )
    assert response.status_code == 409
    assert response.get_json()["errors"]["available_sessions"] < 8


def test_f64_issue_creates_one_invoice_and_notification(
    app, client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    response = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["cycle"]["status"] == "ISSUED"
    assert body["invoice"]["tuition_cycle_id"] == cycle_id
    assert body["invoice"]["base_amount"] == 1000000
    assert body["invoice"]["cancellation_credit_snapshot"] == 125000
    assert body["invoice"]["final_amount"] == 875000
    assert body["invoice"]["status"] == "UNPAID"
    assert body["notifications_created"] == 1
    with app.app_context():
        item = db.session.execute(
            text("SELECT item_type, amount FROM tuition_invoice_items WHERE invoice_id = :id"),
            {"id": body["invoice"]["id"]},
        ).one()
        assert item.item_type == "TUITION"
        assert item.amount == body["invoice"]["base_amount"]
        assert db.session.execute(
            text("SELECT COUNT(*) FROM notifications WHERE related_invoice_id = :id"),
            {"id": body["invoice"]["id"]},
        ).scalar_one() == 1


def test_f64_issue_is_idempotent_without_duplicate_invoice_or_notification(
    app, client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    url = f"/api/v1/tuition-cycles/{cycle_id}/issue"
    first = client.post(url, headers=auth_header(users["manager"]))
    second = client.post(url, headers=auth_header(users["manager"]))
    assert first.status_code == second.status_code == 200
    assert first.get_json()["invoice"]["id"] == second.get_json()["invoice"]["id"]
    assert second.get_json()["notifications_created"] == 0
    with app.app_context():
        assert db.session.execute(
            text("SELECT COUNT(*) FROM tuition_invoice_items WHERE invoice_id = :id"),
            {"id": first.get_json()["invoice"]["id"]},
        ).scalar_one() == 1
        assert db.session.execute(
            text("SELECT COUNT(*) FROM tuition_invoices WHERE tuition_cycle_id = :id"),
            {"id": cycle_id},
        ).scalar_one() == 1
        assert db.session.execute(text("SELECT COUNT(*) FROM notifications")).scalar_one() == 1


def test_f64_notifies_each_distinct_linked_account_once(
    app, client, users, auth_header, tuition_scope, create_user
):
    from app.models import RoleCode

    parent = create_user("parent_tuition_linked", RoleCode.STUDENT_PARENT, email=None)
    with app.app_context():
        db.session.execute(
            text(
                """INSERT INTO student_user_links
                    (user_id, student_id, relationship, can_view)
                   VALUES (:user, :student, 'GUARDIAN', 1)"""
            ),
            {"user": parent, "student": tuition_scope["student"]},
        )
        db.session.commit()
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    response = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    assert response.get_json()["notifications_created"] == 2


def test_f64_only_manager_can_issue(client, users, auth_header, tuition_scope):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    for actor in ("lecturer", "assistant", "student"):
        assert client.post(
            f"/api/v1/tuition-cycles/{cycle_id}/issue",
            headers=auth_header(users[actor]),
        ).status_code == 403


def test_f64_requires_authentication(client):
    assert client.post("/api/v1/tuition-cycles/1/issue").status_code == 401


def test_f64_returns_not_found_for_missing_cycle(client, users, auth_header):
    assert client.post(
        "/api/v1/tuition-cycles/999999/issue",
        headers=auth_header(users["manager"]),
    ).status_code == 404


def test_f65_calculate_sets_fixed_one_million_base_amount(
    client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    response = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "CALCULATED"
    assert body["base_amount"] == 1000000
    assert body["final_amount"] == 875000
    assert body["policy_discount_amount"] == 0
    assert body["absence_credit_amount"] == 0
    assert body["cancellation_credit_amount"] == 125000


def test_f65_base_amount_does_not_follow_course_monthly_fee(
    app, client, users, auth_header, tuition_scope
):
    with app.app_context():
        db.session.execute(
            text(
                "UPDATE courses SET monthly_fee = 2500000 WHERE id = "
                "(SELECT course_id FROM classes WHERE id = :class_id)"
            ),
            {"class_id": tuition_scope["class"]},
        )
        db.session.commit()
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    body = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["base_amount"] == 1000000


def test_f65_recalculate_before_issue_is_idempotent(
    client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    url = f"/api/v1/tuition-cycles/{cycle_id}/calculate"
    first = client.post(url, headers=auth_header(users["manager"]))
    second = client.post(url, headers=auth_header(users["manager"]))
    assert first.status_code == second.status_code == 200
    assert first.get_json()["final_amount"] == second.get_json()["final_amount"] == 875000


def test_f65_issue_uses_calculated_snapshot(
    client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    issue = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    )
    assert issue.status_code == 200
    assert issue.get_json()["invoice"]["base_amount"] == 1000000
    assert issue.get_json()["invoice"]["final_amount"] == 875000


def test_f65_only_manager_can_calculate(client, users, auth_header, tuition_scope):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    for actor in ("lecturer", "assistant", "student"):
        assert client.post(
            f"/api/v1/tuition-cycles/{cycle_id}/calculate",
            headers=auth_header(users[actor]),
        ).status_code == 403


def test_f65_rejects_standard_recalculation_after_issue(
    client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    assert client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    ).status_code == 200
    assert client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    ).status_code == 409


def create_sibling_relationship(
    client, users, auth_header, scope, *, student_id=None, sibling_student_id=None, **changes
):
    payload = {
        "sibling_student_id": (
            scope["dummy_student"]
            if sibling_student_id is None
            else sibling_student_id
        ),
        "valid_from": "2026-01-01",
        "valid_to": None,
        "reason": "Đã đối chiếu hồ sơ gia đình",
    }
    payload.update(changes)
    return client.post(
        f"/api/v1/students/{scope['student'] if student_id is None else student_id}"
        "/sibling-relationships",
        headers=auth_header(users["manager"]),
        json=payload,
    )


def test_f66_manager_records_normalized_sibling_relationship_with_audit(
    app, client, users, auth_header, tuition_scope
):
    response = create_sibling_relationship(
        client,
        users,
        auth_header,
        tuition_scope,
        reason="  Đã đối chiếu hồ sơ gia đình  ",
    )
    assert response.status_code == 201
    body = response.get_json()
    assert (body["student_id"], body["sibling_student_id"]) == tuple(
        sorted((tuition_scope["student"], tuition_scope["dummy_student"]))
    )
    assert body["reason"] == "Đã đối chiếu hồ sơ gia đình"
    assert body["approved_by"] == users["manager"]
    assert body["status"] == "ACTIVE"
    with app.app_context():
        audit = db.session.execute(
            text(
                "SELECT new_data FROM audit_logs "
                "WHERE entity_name = 'sibling_relationships' AND entity_id = :id"
            ),
            {"id": body["id"]},
        ).scalar_one()
    assert json.loads(audit)["reason"] == "Đã đối chiếu hồ sơ gia đình"


def test_f66_rejects_self_missing_and_inactive_sibling(
    app, client, users, auth_header, tuition_scope
):
    assert create_sibling_relationship(
        client,
        users,
        auth_header,
        tuition_scope,
        sibling_student_id=tuition_scope["student"],
    ).status_code == 409
    assert create_sibling_relationship(
        client, users, auth_header, tuition_scope, sibling_student_id=999999
    ).status_code == 404
    with app.app_context():
        db.session.execute(
            text("UPDATE students SET status = 'ON_HOLD' WHERE id = :id"),
            {"id": tuition_scope["dummy_student"]},
        )
        db.session.commit()
    assert create_sibling_relationship(
        client, users, auth_header, tuition_scope
    ).status_code == 409


def test_f66_rejects_overlapping_period_in_either_direction(
    client, users, auth_header, tuition_scope
):
    assert create_sibling_relationship(
        client,
        users,
        auth_header,
        tuition_scope,
        valid_from="2026-01-01",
        valid_to="2026-06-30",
    ).status_code == 201
    assert create_sibling_relationship(
        client,
        users,
        auth_header,
        tuition_scope,
        student_id=tuition_scope["dummy_student"],
        sibling_student_id=tuition_scope["student"],
        valid_from="2026-06-30",
        valid_to="2026-12-31",
    ).status_code == 409


def test_f66_allows_non_overlapping_relationship_history(
    client, users, auth_header, tuition_scope
):
    first = create_sibling_relationship(
        client,
        users,
        auth_header,
        tuition_scope,
        valid_from="2025-01-01",
        valid_to="2025-12-31",
    )
    second = create_sibling_relationship(
        client,
        users,
        auth_header,
        tuition_scope,
        student_id=tuition_scope["dummy_student"],
        sibling_student_id=tuition_scope["student"],
        valid_from="2026-01-01",
        valid_to="2026-12-31",
    )
    assert first.status_code == second.status_code == 201
    assert first.get_json()["id"] != second.get_json()["id"]


def test_f66_validates_relationship_payload(client, users, auth_header, tuition_scope):
    invalid_payloads = (
        {"reason": "   "},
        {"valid_from": "2026-02-01", "valid_to": "2026-01-31"},
        {"sibling_student_id": True},
        {"sibling_student_id": "1"},
    )
    for changes in invalid_payloads:
        assert create_sibling_relationship(
            client, users, auth_header, tuition_scope, **changes
        ).status_code == 422


def test_f66_only_manager_can_record_relationship(
    client, users, auth_header, tuition_scope
):
    url = f"/api/v1/students/{tuition_scope['student']}/sibling-relationships"
    payload = {
        "sibling_student_id": tuition_scope["dummy_student"],
        "valid_from": "2026-01-01",
        "reason": "Hồ sơ hợp lệ",
    }
    for actor in ("lecturer", "assistant", "student"):
        assert client.post(
            url, headers=auth_header(users[actor]), json=payload
        ).status_code == 403
    assert client.post(url, json=payload).status_code == 401


def test_f66_applies_exactly_one_hundred_thousand_discount(
    app, client, users, auth_header, tuition_scope
):
    assert create_sibling_relationship(
        client, users, auth_header, tuition_scope
    ).status_code == 201
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    response = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["policy_discount_amount"] == 100000
    assert body["final_amount"] == 775000
    with app.app_context():
        adjustment = db.session.execute(
            text(
                """SELECT adjustment_type, amount, status, approved_by
                       FROM tuition_adjustments WHERE cycle_id = :cycle_id
                         AND adjustment_type = 'SIBLING_DISCOUNT'"""
            ),
            {"cycle_id": cycle_id},
        ).mappings().one()
    assert adjustment["adjustment_type"] == "SIBLING_DISCOUNT"
    assert int(adjustment["amount"]) == 100000
    assert adjustment["status"] == "ACTIVE"
    assert adjustment["approved_by"] == users["manager"]


def test_f66_discount_uses_cycle_start_date_and_active_sibling(
    app, client, users, auth_header, tuition_scope
):
    assert create_sibling_relationship(
        client,
        users,
        auth_header,
        tuition_scope,
        valid_from="2026-01-04",
    ).status_code == 201
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    body = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["start_date"] == "2026-01-03"
    assert body["policy_discount_amount"] == 0
    with app.app_context():
        db.session.execute(
            text("UPDATE students SET status = 'ON_HOLD' WHERE id = :id"),
            {"id": tuition_scope["dummy_student"]},
        )
        db.session.commit()
    assert client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()["policy_discount_amount"] == 0


def test_f66_recalculation_is_idempotent_and_reverses_obsolete_discount(
    app, client, users, auth_header, tuition_scope
):
    relationship_id = create_sibling_relationship(
        client, users, auth_header, tuition_scope
    ).get_json()["id"]
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    url = f"/api/v1/tuition-cycles/{cycle_id}/calculate"
    assert client.post(url, headers=auth_header(users["manager"])).status_code == 200
    assert client.post(url, headers=auth_header(users["manager"])).status_code == 200
    with app.app_context():
        assert db.session.execute(
            text(
                "SELECT COUNT(*) FROM tuition_adjustments "
                "WHERE cycle_id = :cycle_id AND adjustment_type = 'SIBLING_DISCOUNT'"
            ),
            {"cycle_id": cycle_id},
        ).scalar_one() == 1
        db.session.execute(
            text("UPDATE sibling_relationships SET status = 'INACTIVE' WHERE id = :id"),
            {"id": relationship_id},
        )
        db.session.commit()
    body = client.post(url, headers=auth_header(users["manager"])).get_json()
    assert body["policy_discount_amount"] == 0
    assert body["final_amount"] == 875000
    with app.app_context():
        assert db.session.execute(
                text(
                    "SELECT status FROM tuition_adjustments "
                    "WHERE cycle_id = :cycle_id "
                    "AND adjustment_type = 'SIBLING_DISCOUNT'"
                ),
            {"cycle_id": cycle_id},
        ).scalar_one() == "REVERSED"


def test_f66_issue_snapshots_sibling_discount(
    client, users, auth_header, tuition_scope
):
    create_sibling_relationship(client, users, auth_header, tuition_scope)
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    invoice = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    assert invoice["policy_discount_snapshot"] == 100000
    assert invoice["discount_amount"] == 225000
    assert invoice["final_amount"] == 775000


def insert_tuition_adjustment(
    app, users, cycle_id, adjustment_type, amount, *, status="ACTIVE", reason="Kiểm thử"
):
    with app.app_context():
        adjustment_id = db.session.execute(
            text(
                """INSERT INTO tuition_adjustments
                    (cycle_id, adjustment_type, amount, status, reason,
                     approved_by, created_by)
                   OUTPUT INSERTED.id
                   VALUES (:cycle_id, :adjustment_type, :amount, :status,
                           :reason, :actor, :actor)"""
            ),
            {
                "cycle_id": cycle_id,
                "adjustment_type": adjustment_type,
                "amount": amount,
                "status": status,
                "reason": reason,
                "actor": users["manager"],
            },
        ).scalar_one()
        db.session.commit()
    return adjustment_id


def test_f67_calculates_adjustments_in_documented_order(
    app, client, users, auth_header, tuition_scope
):
    create_sibling_relationship(client, users, auth_header, tuition_scope)
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_tuition_adjustment(app, users, cycle_id, "ABSENCE_CREDIT", 250000)
    insert_tuition_adjustment(app, users, cycle_id, "CANCELLATION_CREDIT", 125000)
    insert_tuition_adjustment(app, users, cycle_id, "MANUAL", 50000)
    body = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["base_amount"] == 1000000
    assert body["policy_discount_amount"] == 100000
    assert body["absence_credit_amount"] == 250000
    assert body["cancellation_credit_amount"] == 125000
    assert body["manual_adjustment_amount"] == 50000
    assert body["final_amount"] == 575000


def test_f67_signed_manual_adjustment_supports_discount_and_surcharge(
    app, client, users, auth_header, tuition_scope
):
    first_cycle = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_tuition_adjustment(app, users, first_cycle, "MANUAL", -75000)
    first = client.post(
        f"/api/v1/tuition-cycles/{first_cycle}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert first["manual_adjustment_amount"] == -75000
    assert first["final_amount"] == 800000

    second_cycle = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_tuition_adjustment(app, users, second_cycle, "MANUAL", 150000)
    second = client.post(
        f"/api/v1/tuition-cycles/{second_cycle}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert second["manual_adjustment_amount"] == 150000
    assert second["final_amount"] == 1150000


def test_f67_final_amount_has_zero_floor(
    app, client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_tuition_adjustment(app, users, cycle_id, "ABSENCE_CREDIT", 750000)
    insert_tuition_adjustment(app, users, cycle_id, "MANUAL", -250000)
    body = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["final_amount"] == 0


def test_f67_ignores_reversed_adjustments(
    app, client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_tuition_adjustment(
        app, users, cycle_id, "MANUAL", 999999, status="REVERSED"
    )
    body = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["manual_adjustment_amount"] == 0
    assert body["final_amount"] == 875000


def test_f67_invoice_keeps_nonnegative_legacy_discount_for_surcharge(
    app, client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_tuition_adjustment(app, users, cycle_id, "MANUAL", 100000)
    invoice = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    assert invoice["discount_amount"] == 25000
    assert invoice["manual_adjustment_snapshot"] == 100000
    assert invoice["final_amount"] == 975000


def test_f68_invoice_snapshots_every_calculation_component(
    app, client, users, auth_header, tuition_scope
):
    create_sibling_relationship(client, users, auth_header, tuition_scope)
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_tuition_adjustment(app, users, cycle_id, "ABSENCE_CREDIT", 250000)
    insert_tuition_adjustment(app, users, cycle_id, "CANCELLATION_CREDIT", 125000)
    insert_tuition_adjustment(app, users, cycle_id, "MANUAL", -25000)
    invoice = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    assert invoice["base_amount"] == 1000000
    assert invoice["policy_discount_snapshot"] == 100000
    assert invoice["absence_credit_snapshot"] == 250000
    assert invoice["cancellation_credit_snapshot"] == 125000
    assert invoice["manual_adjustment_snapshot"] == -25000
    assert invoice["discount_amount"] == 500000
    assert invoice["final_amount"] == 500000


def test_f68_source_changes_do_not_mutate_issued_invoice(
    app, client, users, auth_header, tuition_scope
):
    relationship_id = create_sibling_relationship(
        client, users, auth_header, tuition_scope
    ).get_json()["id"]
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    adjustment_id = insert_tuition_adjustment(
        app, users, cycle_id, "MANUAL", 50000
    )
    issued = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    with app.app_context():
        db.session.execute(
            text("UPDATE sibling_relationships SET status = 'INACTIVE' WHERE id = :id"),
            {"id": relationship_id},
        )
        db.session.execute(
            text("UPDATE tuition_adjustments SET amount = 900000 WHERE id = :id"),
            {"id": adjustment_id},
        )
        db.session.commit()
    reread = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    assert reread["id"] == issued["id"]
    assert reread["policy_discount_snapshot"] == issued["policy_discount_snapshot"] == 100000
    assert reread["manual_adjustment_snapshot"] == issued["manual_adjustment_snapshot"] == 50000
    assert reread["final_amount"] == issued["final_amount"] == 825000


def test_f68_paid_invoice_snapshot_cannot_be_recalculated(
    app, client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    issued = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    with app.app_context():
        db.session.execute(
            text(
                """UPDATE tuition_invoices
                   SET paid_amount = final_amount, status = 'PAID'
                   WHERE id = :id"""
            ),
            {"id": issued["id"]},
        )
        db.session.commit()
    assert client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    ).status_code == 409
    reread = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    assert reread["status"] == "PAID"
    assert reread["final_amount"] == issued["final_amount"]


def post_manual_adjustment(client, users, auth_header, cycle_id, **changes):
    payload = {"amount": 50000, "reason": "Bổ sung học cụ"}
    payload.update(changes)
    return client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/adjustments",
        headers=auth_header(users["manager"]),
        json=payload,
    )


def test_f69_manager_adds_audited_surcharge_and_recalculates(
    app, client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    response = post_manual_adjustment(
        client,
        users,
        auth_header,
        cycle_id,
        amount=75000,
        reason="  Bổ sung học cụ  ",
    )
    assert response.status_code == 201
    body = response.get_json()
    adjustment = body["adjustment"]
    assert adjustment["adjustment_type"] == "MANUAL"
    assert adjustment["amount"] == 75000
    assert adjustment["reason"] == "Bổ sung học cụ"
    assert adjustment["approved_by"] == users["manager"]
    assert adjustment["created_by"] == users["manager"]
    assert body["cycle"]["manual_adjustment_amount"] == 75000
    assert body["cycle"]["final_amount"] == 950000
    with app.app_context():
        audit = db.session.execute(
            text(
                "SELECT new_data FROM audit_logs "
                "WHERE entity_name = 'tuition_adjustments' AND entity_id = :id"
            ),
            {"id": adjustment["id"]},
        ).scalar_one()
    assert json.loads(audit)["reason"] == "Bổ sung học cụ"


def test_f69_negative_adjustment_is_discount_and_multiple_items_accumulate(
    client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    first = post_manual_adjustment(
        client, users, auth_header, cycle_id, amount=-100000, reason="Hỗ trợ đặc biệt"
    )
    second = post_manual_adjustment(
        client, users, auth_header, cycle_id, amount=25000, reason="Phí tài liệu"
    )
    assert first.status_code == second.status_code == 201
    assert first.get_json()["cycle"]["final_amount"] == 775000
    assert second.get_json()["cycle"]["manual_adjustment_amount"] == -75000
    assert second.get_json()["cycle"]["final_amount"] == 800000


def test_f69_validates_amount_reason_and_unknown_final_amount(
    client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    invalid = (
        {"amount": 0},
        {"amount": True},
        {"amount": "50000"},
        {"amount": 1000000000000},
        {"reason": "   "},
        {"final_amount": 1},
    )
    for changes in invalid:
        assert post_manual_adjustment(
            client, users, auth_header, cycle_id, **changes
        ).status_code == 422


def test_f69_only_manager_can_add_manual_adjustment(
    client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    url = f"/api/v1/tuition-cycles/{cycle_id}/adjustments"
    payload = {"amount": 50000, "reason": "Phụ thu"}
    for actor in ("lecturer", "assistant", "student"):
        assert client.post(
            url, headers=auth_header(users[actor]), json=payload
        ).status_code == 403
    assert client.post(url, json=payload).status_code == 401


def test_f69_rejects_missing_or_issued_cycle_without_creating_adjustment(
    app, client, users, auth_header, tuition_scope
):
    assert post_manual_adjustment(
        client, users, auth_header, 999999
    ).status_code == 404
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    )
    assert post_manual_adjustment(
        client, users, auth_header, cycle_id
    ).status_code == 409
    with app.app_context():
        assert db.session.execute(
            text(
                "SELECT COUNT(*) FROM tuition_adjustments "
                "WHERE cycle_id = :cycle_id AND adjustment_type = 'MANUAL'"
            ),
            {"cycle_id": cycle_id},
        ).scalar_one() == 0


def test_f70_lists_student_cycles_newest_first(
    client, users, auth_header, tuition_scope
):
    first = generate_cycle(client, users, auth_header, tuition_scope).get_json()
    second = generate_cycle(client, users, auth_header, tuition_scope).get_json()
    response = client.get(
        f"/api/v1/students/{tuition_scope['student']}/tuition-cycles",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["total"] == 2
    assert [item["id"] for item in body["items"]] == [second["id"], first["id"]]
    assert all(len(item["sessions"]) == 8 for item in body["items"])


def test_f70_lists_empty_student_history_and_rejects_missing_student(
    client, users, auth_header, tuition_scope
):
    response = client.get(
        f"/api/v1/students/{tuition_scope['dummy_student']}/tuition-cycles",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    assert response.get_json() == {"items": [], "total": 0}
    assert client.get(
        "/api/v1/students/999999/tuition-cycles",
        headers=auth_header(users["manager"]),
    ).status_code == 404


def test_f70_student_cycle_list_authorization(
    client, users, auth_header, tuition_scope
):
    url = f"/api/v1/students/{tuition_scope['student']}/tuition-cycles"
    assert client.get(url, headers=auth_header(users["student"])).status_code == 200
    assert client.get(
        url, headers=auth_header(tuition_scope["unlinked_parent"])
    ).status_code == 403
    for actor in ("lecturer", "assistant"):
        assert client.get(url, headers=auth_header(users[actor])).status_code == 403
    assert client.get(url).status_code == 401


def test_f70_lists_complete_adjustment_history_for_manager_and_linked_parent(
    app, client, users, auth_header, tuition_scope
):
    create_sibling_relationship(client, users, auth_header, tuition_scope)
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    post_manual_adjustment(
        client, users, auth_header, cycle_id, amount=-50000, reason="Hỗ trợ"
    )
    reversed_id = insert_tuition_adjustment(
        app, users, cycle_id, "MANUAL", 10000, status="REVERSED"
    )
    url = f"/api/v1/tuition-cycles/{cycle_id}/adjustments"
    for actor in (users["manager"], users["student"]):
        response = client.get(url, headers=auth_header(actor))
        assert response.status_code == 200
        body = response.get_json()
        assert body["total"] == 4
        assert {item["adjustment_type"] for item in body["items"]} == {
            "SIBLING_DISCOUNT",
            "MANUAL",
            "CANCELLATION_CREDIT",
        }
        assert any(
            item["id"] == reversed_id and item["status"] == "REVERSED"
            for item in body["items"]
        )


def test_f70_adjustment_list_authorization_and_missing_cycle(
    client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    url = f"/api/v1/tuition-cycles/{cycle_id}/adjustments"
    for actor in (users["lecturer"], users["assistant"], tuition_scope["unlinked_parent"]):
        assert client.get(url, headers=auth_header(actor)).status_code == 403
    assert client.get(url).status_code == 401
    assert client.get(
        "/api/v1/tuition-cycles/999999/adjustments",
        headers=auth_header(users["manager"]),
    ).status_code == 404


def create_tuition_policy(client, users, auth_header, **changes):
    payload = {
        "eligible_absence_statuses": ["EXCUSED_ABSENCE"],
        "cancellation_after_issue_mode": None,
        "effective_from": "2026-01-01",
        "effective_to": "2026-12-31",
    }
    payload.update(changes)
    return client.post(
        "/api/v1/tuition-policies",
        headers=auth_header(users["manager"]),
        json=payload,
    )


def insert_attendances(app, users, student_id, entries):
    with app.app_context():
        for session_id, status in entries:
            db.session.execute(
                text(
                    """INSERT INTO attendances
                        (session_id, student_id, status, recorded_by, recorded_at)
                       VALUES (:session_id, :student_id, :status, :recorded_by,
                               SYSDATETIMEOFFSET())"""
                ),
                {
                    "session_id": session_id,
                    "student_id": student_id,
                    "status": status,
                    "recorded_by": users["manager"],
                },
            )
        db.session.commit()


def test_f71_manager_versions_validated_absence_policy_with_audit(
    app, client, users, auth_header
):
    response = create_tuition_policy(
        client,
        users,
        auth_header,
        eligible_absence_statuses=["EXCUSED_ABSENCE", "UNEXCUSED_ABSENCE"],
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["version"] == 1
    assert body["base_amount"] == 1000000
    assert body["sessions_per_cycle"] == 8
    assert body["unit_amount"] == 125000
    assert body["absence_threshold"] == 4
    assert body["eligible_absence_statuses"] == [
        "EXCUSED_ABSENCE",
        "UNEXCUSED_ABSENCE",
    ]
    with app.app_context():
        audit = db.session.execute(
            text(
                "SELECT new_data FROM audit_logs "
                "WHERE entity_name = 'tuition_business_policies' AND entity_id = :id"
            ),
            {"id": body["id"]},
        ).scalar_one()
    assert json.loads(audit)["absence_threshold"] == 4


def test_f71_policy_rejects_invalid_overlap_and_non_manager(
    client, users, auth_header
):
    invalid = (
        {"eligible_absence_statuses": []},
        {"eligible_absence_statuses": ["PRESENT"]},
        {"eligible_absence_statuses": ["EXCUSED_ABSENCE", "EXCUSED_ABSENCE"]},
        {"effective_from": "2026-02-01", "effective_to": "2026-01-31"},
    )
    for changes in invalid:
        assert create_tuition_policy(
            client, users, auth_header, **changes
        ).status_code == 422
    assert create_tuition_policy(client, users, auth_header).status_code == 201
    assert create_tuition_policy(
        client,
        users,
        auth_header,
        effective_from="2026-06-01",
        effective_to="2027-01-01",
    ).status_code == 409
    for actor in ("lecturer", "assistant", "student"):
        assert client.post(
            "/api/v1/tuition-policies",
            headers=auth_header(users[actor]),
            json={
                "eligible_absence_statuses": ["EXCUSED_ABSENCE"],
                "effective_from": "2027-01-01",
            },
        ).status_code == 403


def test_f71_fails_safely_when_absence_rule_is_not_configured(
    app, client, users, auth_header, tuition_scope
):
    generate_cycle(client, users, auth_header, tuition_scope)
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_attendances(
        app,
        users,
        tuition_scope["student"],
        [(tuition_scope["sessions"][0], "EXCUSED_ABSENCE")],
    )
    response = client.post(
        f"/api/v1/tuition-cycles/{target_id}/calculate",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 409
    assert "Chưa cấu hình" in response.get_json()["message"]


def test_f71_counts_only_policy_eligible_absences_and_excludes_cancelled_session(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(client, users, auth_header)
    generate_cycle(client, users, auth_header, tuition_scope)
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    entries = [
        (tuition_scope["sessions"][0], "EXCUSED_ABSENCE"),
        (tuition_scope["sessions"][1], "EXCUSED_ABSENCE"),
        (tuition_scope["sessions"][2], "EXCUSED_ABSENCE"),
        (tuition_scope["sessions"][3], "EXCUSED_ABSENCE"),  # CANCELLED
        (tuition_scope["sessions"][4], "EXCUSED_ABSENCE"),
        (tuition_scope["sessions"][5], "EXCUSED_ABSENCE"),
        (tuition_scope["sessions"][6], "UNEXCUSED_ABSENCE"),
        (tuition_scope["sessions"][7], "UNEXCUSED_ABSENCE"),
    ]
    insert_attendances(app, users, tuition_scope["student"], entries)
    body = client.post(
        f"/api/v1/tuition-cycles/{target_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["absence_credit_amount"] == 625000
    adjustments = client.get(
        f"/api/v1/tuition-cycles/{target_id}/adjustments",
        headers=auth_header(users["manager"]),
    ).get_json()["items"]
    credit = next(item for item in adjustments if item["adjustment_type"] == "ABSENCE_CREDIT")
    assert "5 buổi" in credit["reason"]


def test_f71_cancelled_absence_cannot_push_count_over_threshold(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(client, users, auth_header)
    generate_cycle(client, users, auth_header, tuition_scope)
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_attendances(
        app,
        users,
        tuition_scope["student"],
        [
            (tuition_scope["sessions"][0], "EXCUSED_ABSENCE"),
            (tuition_scope["sessions"][1], "EXCUSED_ABSENCE"),
            (tuition_scope["sessions"][2], "EXCUSED_ABSENCE"),
            (tuition_scope["sessions"][3], "EXCUSED_ABSENCE"),  # CANCELLED
            (tuition_scope["sessions"][4], "EXCUSED_ABSENCE"),
        ],
    )
    body = client.post(
        f"/api/v1/tuition-cycles/{target_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["absence_credit_amount"] == 0


@pytest.mark.parametrize(
    ("absence_count", "expected_credit"),
    [(1, 0), (4, 0), (5, 625000), (6, 750000), (7, 875000)],
)
def test_f72_credit_threshold_and_full_absence_amount(
    app,
    client,
    users,
    auth_header,
    tuition_scope,
    absence_count,
    expected_credit,
):
    create_tuition_policy(client, users, auth_header)
    generate_cycle(client, users, auth_header, tuition_scope)
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    scheduled_sessions = [
        session_id
        for index, session_id in enumerate(tuition_scope["sessions"][:8])
        if index != 3
    ]
    insert_attendances(
        app,
        users,
        tuition_scope["student"],
        [
            (session_id, "EXCUSED_ABSENCE")
            for session_id in scheduled_sessions[:absence_count]
        ],
    )
    body = client.post(
        f"/api/v1/tuition-cycles/{target_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["absence_credit_amount"] == expected_credit
    assert body["final_amount"] == 1000000 - expected_credit


def test_f72_credit_uses_fixed_policy_unit_not_course_monthly_fee(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(client, users, auth_header)
    with app.app_context():
        db.session.execute(
            text(
                "UPDATE courses SET monthly_fee = 9999999 WHERE id = "
                "(SELECT course_id FROM classes WHERE id = :class_id)"
            ),
            {"class_id": tuition_scope["class"]},
        )
        db.session.commit()
    generate_cycle(client, users, auth_header, tuition_scope)
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    eligible_sessions = [
        tuition_scope["sessions"][index] for index in (0, 1, 2, 4, 5)
    ]
    insert_attendances(
        app,
        users,
        tuition_scope["student"],
        [(session_id, "EXCUSED_ABSENCE") for session_id in eligible_sessions],
    )
    body = client.post(
        f"/api/v1/tuition-cycles/{target_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["absence_credit_amount"] == 625000


def test_f73_absence_credit_applies_only_to_next_cycle(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(client, users, auth_header)
    source_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_attendances(
        app,
        users,
        tuition_scope["student"],
        [
            (tuition_scope["sessions"][index], "EXCUSED_ABSENCE")
            for index in (0, 1, 2, 4, 5)
        ],
    )
    source = client.post(
        f"/api/v1/tuition-cycles/{source_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert source["absence_credit_amount"] == 0
    assert source["final_amount"] == 875000

    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    target = client.post(
        f"/api/v1/tuition-cycles/{target_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert target["absence_credit_amount"] == 625000
    assert target["final_amount"] == 375000


def test_f73_adjustment_links_source_and_target_cycle(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(client, users, auth_header)
    source_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_attendances(
        app,
        users,
        tuition_scope["student"],
        [
            (tuition_scope["sessions"][index], "EXCUSED_ABSENCE")
            for index in (0, 1, 2, 4, 5)
        ],
    )
    client.post(
        f"/api/v1/tuition-cycles/{target_id}/calculate",
        headers=auth_header(users["manager"]),
    )
    with app.app_context():
        credit = db.session.execute(
            text(
                """SELECT cycle_id, source_cycle_id, amount, status
                   FROM tuition_adjustments
                   WHERE adjustment_type = 'ABSENCE_CREDIT'"""
            )
        ).mappings().one()
    assert credit["source_cycle_id"] == source_id
    assert credit["cycle_id"] == target_id
    assert int(credit["amount"]) == 625000
    assert credit["status"] == "ACTIVE"


def test_f73_next_cycle_combines_absence_credit_with_sibling_discount(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(client, users, auth_header)
    create_sibling_relationship(client, users, auth_header, tuition_scope)
    generate_cycle(client, users, auth_header, tuition_scope)
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_attendances(
        app,
        users,
        tuition_scope["student"],
        [
            (tuition_scope["sessions"][index], "EXCUSED_ABSENCE")
            for index in (0, 1, 2, 4, 5)
        ],
    )
    target = client.post(
        f"/api/v1/tuition-cycles/{target_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert target["policy_discount_amount"] == 100000
    assert target["absence_credit_amount"] == 625000
    assert target["final_amount"] == 275000


def get_attendance_id(app, student_id, session_id):
    with app.app_context():
        return db.session.execute(
            text(
                "SELECT id FROM attendances "
                "WHERE student_id = :student_id AND session_id = :session_id"
            ),
            {"student_id": student_id, "session_id": session_id},
        ).scalar_one()


def test_f74_recalculates_zero_to_credit_and_processes_outbox(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(client, users, auth_header)
    source_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    session_indexes = (0, 1, 2, 4, 5)
    insert_attendances(
        app,
        users,
        tuition_scope["student"],
        [
            (
                tuition_scope["sessions"][index],
                "EXCUSED_ABSENCE" if position < 4 else "PRESENT",
            )
            for position, index in enumerate(session_indexes)
        ],
    )
    calculate_url = f"/api/v1/tuition-cycles/{target_id}/calculate"
    assert client.post(
        calculate_url, headers=auth_header(users["manager"])
    ).get_json()["absence_credit_amount"] == 0

    changed_session = tuition_scope["sessions"][5]
    attendance_id = get_attendance_id(
        app, tuition_scope["student"], changed_session
    )
    assert client.patch(
        f"/api/v1/attendances/{attendance_id}",
        headers=auth_header(users["manager"]),
        json={
            "status": "EXCUSED_ABSENCE",
            "reason": "Bổ sung đơn xin nghỉ hợp lệ",
        },
    ).status_code == 200
    body = client.post(
        calculate_url, headers=auth_header(users["manager"])
    ).get_json()
    assert body["absence_credit_amount"] == 625000
    with app.app_context():
        request_row = db.session.execute(
            text(
                """SELECT status, processed_at, error_message
                   FROM tuition_recalculation_requests
                   WHERE attendance_id = :attendance_id"""
            ),
            {"attendance_id": attendance_id},
        ).mappings().one()
        active_credit = db.session.execute(
            text(
                """SELECT source_cycle_id, cycle_id, amount
                   FROM tuition_adjustments
                   WHERE adjustment_type = 'ABSENCE_CREDIT' AND status = 'ACTIVE'"""
            )
        ).mappings().one()
    assert request_row["status"] == "PROCESSED"
    assert request_row["processed_at"] is not None
    assert request_row["error_message"] is None
    assert active_credit["source_cycle_id"] == source_id
    assert active_credit["cycle_id"] == target_id


def test_f74_recalculates_credit_to_zero_by_reversal_not_delete(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(client, users, auth_header)
    generate_cycle(client, users, auth_header, tuition_scope)
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    session_indexes = (0, 1, 2, 4, 5)
    insert_attendances(
        app,
        users,
        tuition_scope["student"],
        [
            (tuition_scope["sessions"][index], "EXCUSED_ABSENCE")
            for index in session_indexes
        ],
    )
    calculate_url = f"/api/v1/tuition-cycles/{target_id}/calculate"
    assert client.post(
        calculate_url, headers=auth_header(users["manager"])
    ).get_json()["absence_credit_amount"] == 625000
    attendance_id = get_attendance_id(
        app, tuition_scope["student"], tuition_scope["sessions"][5]
    )
    client.patch(
        f"/api/v1/attendances/{attendance_id}",
        headers=auth_header(users["manager"]),
        json={"status": "PRESENT", "reason": "Đối soát lại camera lớp học"},
    )
    body = client.post(
        calculate_url, headers=auth_header(users["manager"])
    ).get_json()
    assert body["absence_credit_amount"] == 0
    assert body["final_amount"] == 1000000
    with app.app_context():
        rows = db.session.execute(
            text(
                """SELECT status, amount FROM tuition_adjustments
                   WHERE adjustment_type = 'ABSENCE_CREDIT'"""
            )
        ).mappings().all()
        request_status = db.session.execute(
            text(
                "SELECT status FROM tuition_recalculation_requests "
                "WHERE attendance_id = :attendance_id"
            ),
            {"attendance_id": attendance_id},
        ).scalar_one()
    assert len(rows) == 1
    assert rows[0]["status"] == "REVERSED"
    assert int(rows[0]["amount"]) == 625000
    assert request_status == "PROCESSED"


def test_f74_repeated_recalculation_keeps_one_active_credit_and_full_history(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(client, users, auth_header)
    generate_cycle(client, users, auth_header, tuition_scope)
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    session_indexes = (0, 1, 2, 4, 5)
    insert_attendances(
        app,
        users,
        tuition_scope["student"],
        [
            (tuition_scope["sessions"][index], "EXCUSED_ABSENCE")
            for index in session_indexes
        ],
    )
    url = f"/api/v1/tuition-cycles/{target_id}/calculate"
    client.post(url, headers=auth_header(users["manager"]))
    attendance_id = get_attendance_id(
        app, tuition_scope["student"], tuition_scope["sessions"][5]
    )
    for status in ("PRESENT", "EXCUSED_ABSENCE"):
        client.patch(
            f"/api/v1/attendances/{attendance_id}",
            headers=auth_header(users["manager"]),
            json={"status": status, "reason": "Kiểm tra lịch sử tính lại credit"},
        )
        client.post(url, headers=auth_header(users["manager"]))
    client.post(url, headers=auth_header(users["manager"]))
    with app.app_context():
        rows = db.session.execute(
            text(
                """SELECT id, status, reversed_adjustment_id
                   FROM tuition_adjustments
                   WHERE adjustment_type = 'ABSENCE_CREDIT'
                   ORDER BY id"""
            )
        ).mappings().all()
    assert len(rows) == 2
    assert [row["status"] for row in rows].count("ACTIVE") == 1
    assert [row["status"] for row in rows].count("REVERSED") == 1
    assert rows[1]["reversed_adjustment_id"] == rows[0]["id"]


def test_f75_cancelled_session_creates_exact_credit_per_session(
    app, client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    body = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["cancellation_credit_amount"] == 125000
    assert body["final_amount"] == 875000
    with app.app_context():
        adjustment = db.session.execute(
            text(
                """SELECT session_id, adjustment_type, amount, status
                   FROM tuition_adjustments
                   WHERE cycle_id = :cycle_id
                     AND adjustment_type = 'CANCELLATION_CREDIT'"""
            ),
            {"cycle_id": cycle_id},
        ).mappings().one()
    assert adjustment["session_id"] == tuition_scope["sessions"][3]
    assert adjustment["adjustment_type"] == "CANCELLATION_CREDIT"
    assert int(adjustment["amount"]) == 125000
    assert adjustment["status"] == "ACTIVE"


def test_f75_multiple_cancelled_sessions_sum_by_fixed_unit(
    app, client, users, auth_header, tuition_scope
):
    with app.app_context():
        db.session.execute(
            text("UPDATE class_sessions SET status = 'CANCELLED' WHERE id = :id"),
            {"id": tuition_scope["sessions"][1]},
        )
        db.session.commit()
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    body = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["cancellation_credit_amount"] == 250000
    assert body["final_amount"] == 750000
    with app.app_context():
        assert db.session.execute(
            text(
                """SELECT COUNT(*) FROM tuition_adjustments
                   WHERE cycle_id = :cycle_id
                     AND adjustment_type = 'CANCELLATION_CREDIT'
                     AND status = 'ACTIVE'"""
            ),
            {"cycle_id": cycle_id},
        ).scalar_one() == 2


def test_f75_cancellation_credit_combines_with_other_adjustments(
    app, client, users, auth_header, tuition_scope
):
    create_sibling_relationship(client, users, auth_header, tuition_scope)
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_tuition_adjustment(app, users, cycle_id, "MANUAL", 25000)
    body = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["policy_discount_amount"] == 100000
    assert body["cancellation_credit_amount"] == 125000
    assert body["manual_adjustment_amount"] == 25000
    assert body["final_amount"] == 800000


def test_f75_issue_snapshots_cancellation_credit(
    client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    invoice = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    assert invoice["cancellation_credit_snapshot"] == 125000
    assert invoice["discount_amount"] == 125000
    assert invoice["final_amount"] == 875000


def test_f76_cancelled_session_rejects_attendance_recording(
    client, users, auth_header, tuition_scope
):
    response = client.put(
        f"/api/v1/sessions/{tuition_scope['sessions'][3]}/attendances",
        headers=auth_header(users["manager"]),
        json={
            "items": [
                {
                    "student_id": tuition_scope["student"],
                    "status": "EXCUSED_ABSENCE",
                    "note": "Không được ghi nhận",
                }
            ]
        },
    )
    assert response.status_code == 409


def test_f76_cancelled_session_attendance_never_creates_absence_credit(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(client, users, auth_header)
    generate_cycle(client, users, auth_header, tuition_scope)
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_attendances(
        app,
        users,
        tuition_scope["student"],
        [
            (tuition_scope["sessions"][0], "EXCUSED_ABSENCE"),
            (tuition_scope["sessions"][1], "EXCUSED_ABSENCE"),
            (tuition_scope["sessions"][2], "EXCUSED_ABSENCE"),
            (tuition_scope["sessions"][3], "EXCUSED_ABSENCE"),
            (tuition_scope["sessions"][4], "EXCUSED_ABSENCE"),
        ],
    )
    body = client.post(
        f"/api/v1/tuition-cycles/{target_id}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert body["absence_credit_amount"] == 0
    # Buổi hủy thuộc chu kỳ nguồn; credit hủy của chu kỳ đích vẫn độc lập.
    assert body["cancellation_credit_amount"] == 0
    with app.app_context():
        source_adjustments = db.session.execute(
            text(
                """SELECT adjustment_type, session_id
                   FROM tuition_adjustments
                   WHERE source_cycle_id = (
                       SELECT id FROM tuition_cycles
                       WHERE enrollment_id = :enrollment_id AND cycle_number = 1
                   )"""
            ),
            {"enrollment_id": tuition_scope["enrollment"]},
        ).mappings().all()
    assert not any(
        item["adjustment_type"] == "ABSENCE_CREDIT"
        for item in source_adjustments
    )


def test_f76_same_cancelled_session_has_only_one_credit_type(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(client, users, auth_header)
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    insert_attendances(
        app,
        users,
        tuition_scope["student"],
        [(tuition_scope["sessions"][3], "EXCUSED_ABSENCE")],
    )
    client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    )
    with app.app_context():
        rows = db.session.execute(
            text(
                """SELECT adjustment_type, session_id
                   FROM tuition_adjustments
                   WHERE cycle_id = :cycle_id AND status = 'ACTIVE'"""
            ),
            {"cycle_id": cycle_id},
        ).mappings().all()
    assert [dict(row) for row in rows] == [
        {
            "adjustment_type": "CANCELLATION_CREDIT",
            "session_id": tuition_scope["sessions"][3],
        }
    ]


def test_f77_cancelled_session_stays_in_original_eight_slots(
    client, users, auth_header, tuition_scope
):
    cycle = generate_cycle(client, users, auth_header, tuition_scope).get_json()
    assert len(cycle["sessions"]) == 8
    assert [item["id"] for item in cycle["sessions"]] == tuition_scope["sessions"][:8]
    assert cycle["sessions"][3]["status"] == "CANCELLED"
    assert cycle["end_session_id"] == tuition_scope["sessions"][7]


def test_f77_cancelled_slot_does_not_pull_ninth_session_forward(
    client, users, auth_header, tuition_scope
):
    first = generate_cycle(client, users, auth_header, tuition_scope).get_json()
    second = generate_cycle(client, users, auth_header, tuition_scope).get_json()
    assert tuition_scope["sessions"][8] not in {
        item["id"] for item in first["sessions"]
    }
    assert second["sessions"][0]["id"] == tuition_scope["sessions"][8]
    assert second["cycle_number"] == 2


def test_f77_recalculation_does_not_change_cycle_membership(
    client, users, auth_header, tuition_scope
):
    cycle = generate_cycle(client, users, auth_header, tuition_scope).get_json()
    original_session_ids = [item["id"] for item in cycle["sessions"]]
    calculated = client.post(
        f"/api/v1/tuition-cycles/{cycle['id']}/calculate",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert [item["id"] for item in calculated["sessions"]] == original_session_ids
    assert len(calculated["sessions"]) == 8


def test_f78_repeated_calculation_does_not_duplicate_cancellation_credit(
    app, client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    url = f"/api/v1/tuition-cycles/{cycle_id}/calculate"
    amounts = []
    for _ in range(3):
        response = client.post(url, headers=auth_header(users["manager"]))
        assert response.status_code == 200
        amounts.append(response.get_json()["cancellation_credit_amount"])
    assert amounts == [125000, 125000, 125000]
    with app.app_context():
        rows = db.session.execute(
            text(
                """SELECT id, status FROM tuition_adjustments
                   WHERE cycle_id = :cycle_id
                     AND adjustment_type = 'CANCELLATION_CREDIT'"""
            ),
            {"cycle_id": cycle_id},
        ).mappings().all()
    assert len(rows) == 1
    assert rows[0]["status"] == "ACTIVE"


def test_f78_database_prevents_duplicate_active_credit_for_same_session(
    app, client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    )
    with app.app_context():
        with pytest.raises(IntegrityError):
            db.session.execute(
                text(
                    """INSERT INTO tuition_adjustments
                        (cycle_id, session_id, adjustment_type, amount, status,
                         reason, created_by)
                       VALUES (:cycle_id, :session_id, 'CANCELLATION_CREDIT',
                               125000, 'ACTIVE', N'Trùng credit', :created_by)"""
                ),
                {
                    "cycle_id": cycle_id,
                    "session_id": tuition_scope["sessions"][3],
                    "created_by": users["manager"],
                },
            )
            db.session.flush()
        db.session.rollback()


def test_f78_restore_and_cancel_again_preserves_history_with_one_active_credit(
    app, client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    url = f"/api/v1/tuition-cycles/{cycle_id}/calculate"
    client.post(url, headers=auth_header(users["manager"]))
    cancelled_session = tuition_scope["sessions"][3]
    with app.app_context():
        db.session.execute(
            text("UPDATE class_sessions SET status = 'SCHEDULED' WHERE id = :id"),
            {"id": cancelled_session},
        )
        db.session.commit()
    assert client.post(
        url, headers=auth_header(users["manager"])
    ).get_json()["cancellation_credit_amount"] == 0
    with app.app_context():
        db.session.execute(
            text("UPDATE class_sessions SET status = 'CANCELLED' WHERE id = :id"),
            {"id": cancelled_session},
        )
        db.session.commit()
    assert client.post(
        url, headers=auth_header(users["manager"])
    ).get_json()["cancellation_credit_amount"] == 125000
    with app.app_context():
        rows = db.session.execute(
            text(
                """SELECT id, status, reversed_adjustment_id
                   FROM tuition_adjustments
                   WHERE cycle_id = :cycle_id
                     AND adjustment_type = 'CANCELLATION_CREDIT'
                   ORDER BY id"""
            ),
            {"cycle_id": cycle_id},
        ).mappings().all()
    assert len(rows) == 2
    assert rows[0]["status"] == "REVERSED"
    assert rows[1]["status"] == "ACTIVE"
    assert rows[1]["reversed_adjustment_id"] == rows[0]["id"]


def cancel_session_directly(app, session_id):
    with app.app_context():
        db.session.execute(
            text("UPDATE class_sessions SET status = 'CANCELLED' WHERE id = :id"),
            {"id": session_id},
        )
        db.session.commit()


def test_f79_requires_configured_rule_for_cancellation_after_issue(
    app, client, users, auth_header, tuition_scope
):
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    )
    cancel_session_directly(app, tuition_scope["sessions"][1])
    response = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 409
    assert "Chưa cấu hình" in response.get_json()["message"]


def test_f79_recalculates_unpaid_invoice_when_policy_selects_that_mode(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(
        client,
        users,
        auth_header,
        cancellation_after_issue_mode="RECALCULATE_UNPAID",
    )
    cycle_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    before = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    assert before["cancellation_credit_snapshot"] == 125000
    assert before["final_amount"] == 875000
    cancel_session_directly(app, tuition_scope["sessions"][1])
    response = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/calculate",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    assert response.get_json()["cancellation_credit_amount"] == 250000
    after = client.post(
        f"/api/v1/tuition-cycles/{cycle_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    assert after["id"] == before["id"]
    assert after["status"] == "UNPAID"
    assert after["cancellation_credit_snapshot"] == 250000
    assert after["final_amount"] == 750000


def test_f79_credit_next_mode_keeps_unpaid_invoice_snapshot_unchanged(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(
        client,
        users,
        auth_header,
        cancellation_after_issue_mode="CREDIT_NEXT_CYCLE",
    )
    source_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    before = client.post(
        f"/api/v1/tuition-cycles/{source_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    cancel_session_directly(app, tuition_scope["sessions"][1])
    assert client.post(
        f"/api/v1/tuition-cycles/{source_id}/calculate",
        headers=auth_header(users["manager"]),
    ).status_code == 200
    source_invoice = client.post(
        f"/api/v1/tuition-cycles/{source_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    target = client.get(
        f"/api/v1/tuition-cycles/{target_id}",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert source_invoice["final_amount"] == before["final_amount"] == 875000
    assert source_invoice["cancellation_credit_snapshot"] == 125000
    assert target["cancellation_credit_amount"] == 125000
    assert target["final_amount"] == 875000


def test_f79_paid_invoice_is_immutable_and_credit_moves_to_next_cycle(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(
        client,
        users,
        auth_header,
        cancellation_after_issue_mode="RECALCULATE_UNPAID",
    )
    source_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    target_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    issued = client.post(
        f"/api/v1/tuition-cycles/{source_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    with app.app_context():
        db.session.execute(
            text(
                """UPDATE tuition_invoices
                   SET paid_amount = final_amount, status = 'PAID'
                   WHERE id = :id"""
            ),
            {"id": issued["id"]},
        )
        db.session.commit()
    cancel_session_directly(app, tuition_scope["sessions"][1])
    assert client.post(
        f"/api/v1/tuition-cycles/{source_id}/calculate",
        headers=auth_header(users["manager"]),
    ).status_code == 200
    paid_invoice = client.post(
        f"/api/v1/tuition-cycles/{source_id}/issue",
        headers=auth_header(users["manager"]),
    ).get_json()["invoice"]
    target = client.get(
        f"/api/v1/tuition-cycles/{target_id}",
        headers=auth_header(users["manager"]),
    ).get_json()
    assert paid_invoice["status"] == "PAID"
    assert paid_invoice["final_amount"] == issued["final_amount"] == 875000
    assert paid_invoice["cancellation_credit_snapshot"] == 125000
    assert target["cancellation_credit_amount"] == 125000
    assert target["final_amount"] == 875000


def test_f79_next_cycle_credit_requires_available_unissued_target(
    app, client, users, auth_header, tuition_scope
):
    create_tuition_policy(
        client,
        users,
        auth_header,
        cancellation_after_issue_mode="CREDIT_NEXT_CYCLE",
    )
    source_id = generate_cycle(client, users, auth_header, tuition_scope).get_json()["id"]
    client.post(
        f"/api/v1/tuition-cycles/{source_id}/issue",
        headers=auth_header(users["manager"]),
    )
    cancel_session_directly(app, tuition_scope["sessions"][1])
    response = client.post(
        f"/api/v1/tuition-cycles/{source_id}/calculate",
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 409
    assert "chu kỳ kế tiếp" in response.get_json()["message"]
