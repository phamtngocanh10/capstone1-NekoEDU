import json
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select, text

from app.extensions import db
from app.models import AuditLog, StaffPosition, StaffProfile
from app.services.session_service import _serialize_session


@pytest.fixture
def schedule_scope(app, users, create_staff):
    outsider_user = create_staff("gv_schedule_out", StaffPosition.LECTURER, "GV-S-OUT")
    other_assistant_user = create_staff(
        "ta_schedule_out", StaffPosition.TEACHING_ASSISTANT, "TA-S-OUT"
    )
    with app.app_context():
        staff_ids = {
            profile.user_id: profile.id
            for profile in db.session.scalars(select(StaffProfile)).all()
        }
        level_id = db.session.execute(
            text(
                "INSERT INTO levels (code, name, min_age, max_age, sort_order) "
                "OUTPUT INSERTED.id VALUES ('KID_1', 'Kid 1', 6, 7, 1)"
            )
        ).scalar_one()
        course_id = db.session.execute(
            text(
                """INSERT INTO courses
                    (course_code, level_id, name, sessions_per_week, session_minutes,
                     monthly_fee, status)
                   OUTPUT INSERTED.id
                   VALUES ('C-SCHEDULE', :level_id, 'Schedule Course', 2, 90,
                           1000000, 'ACTIVE')"""
            ),
            {"level_id": level_id},
        ).scalar_one()
        # Giữ các ID dùng qua API lớn hơn 0 vì database test reseed identity về 0.
        db.session.execute(
            text(
                "INSERT INTO rooms (code, name, capacity, status) "
                "VALUES ('R-DUMMY', 'Dummy', 1, 'AVAILABLE')"
            )
        )
        room_id = _insert_room("R-S1", "Room Schedule 1", 20, "AVAILABLE")
        room_2_id = _insert_room("R-S2", "Room Schedule 2", 25, "AVAILABLE")
        small_room_id = _insert_room("R-SMALL", "Small Room", 5, "AVAILABLE")
        maintenance_room_id = _insert_room("R-MAINT", "Maintenance", 20, "MAINTENANCE")
        class_id = _insert_class(
            "CLS-S1",
            "Schedule Class 1",
            course_id,
            staff_ids[users["lecturer"]],
            staff_ids[users["assistant"]],
            room_id,
            "ONGOING",
        )
        completed_class_id = _insert_class(
            "CLS-S-DONE",
            "Schedule Class Done",
            course_id,
            staff_ids[users["lecturer"]],
            staff_ids[users["assistant"]],
            room_id,
            "COMPLETED",
        )
        guardian_id = db.session.execute(
            text(
                "INSERT INTO guardians (full_name, phone, relationship) OUTPUT INSERTED.id "
                "VALUES (N'Phụ huynh lịch học', '0905555555', 'MOTHER')"
            )
        ).scalar_one()
        student_id = db.session.execute(
            text(
                """INSERT INTO students
                    (student_code, full_name, date_of_birth, guardian_id, user_id,
                     current_level_id, enrolled_at, status)
                   OUTPUT INSERTED.id
                   VALUES ('HS-S1', N'Học sinh lịch học', '2018-01-01', :guardian_id,
                           :user_id, :level_id, '2025-01-01', 'ACTIVE')"""
            ),
            {
                "guardian_id": guardian_id,
                "user_id": users["student"],
                "level_id": level_id,
            },
        ).scalar_one()
        db.session.execute(
            text(
                "INSERT INTO class_enrollments "
                "(class_id, student_id, enrolled_date, status) "
                "VALUES (:class_id, :student_id, '2026-01-01', 'ACTIVE')"
            ),
            {"class_id": class_id, "student_id": student_id},
        )
        db.session.commit()
    return {
        "class": class_id,
        "completed_class": completed_class_id,
        "room": room_id,
        "room_2": room_2_id,
        "small_room": small_room_id,
        "maintenance_room": maintenance_room_id,
        "student": student_id,
        "outsider": outsider_user,
        "other_lecturer": staff_ids[outsider_user],
        "other_assistant": staff_ids[other_assistant_user],
        "staff_ids": staff_ids,
        "course": course_id,
        "level": level_id,
    }


def _insert_room(code, name, capacity, status):
    return db.session.execute(
        text(
            "INSERT INTO rooms (code, name, capacity, status) OUTPUT INSERTED.id "
            "VALUES (:code, :name, :capacity, :status)"
        ),
        {"code": code, "name": name, "capacity": capacity, "status": status},
    ).scalar_one()


def _insert_class(code, name, course, lecturer, assistant, room, status="ONGOING"):
    return db.session.execute(
        text(
            """INSERT INTO classes
                (class_code, name, course_id, lecturer_id, assistant_id,
                 default_room_id, max_students, start_date, end_date, status)
               OUTPUT INSERTED.id
               VALUES (:code, :name, :course, :lecturer, :assistant, :room,
                       15, '2026-01-01', '2026-12-31', :status)"""
        ),
        {
            "code": code,
            "name": name,
            "course": course,
            "lecturer": lecturer,
            "assistant": assistant,
            "room": room,
            "status": status,
        },
    ).scalar_one()


def class_schedules_url(class_id):
    return f"/api/v1/classes/{class_id}/schedules"


def schedule_url(schedule_id):
    return f"/api/v1/schedules/{schedule_id}"


def schedule_payload(scope, **overrides):
    payload = {
        "day_of_week": 2,
        "start_time": "18:00:00",
        "end_time": "19:30:00",
        "room_id": scope["room"],
    }
    payload.update(overrides)
    return payload


def create_schedule(client, headers, scope, **overrides):
    response = client.post(
        class_schedules_url(scope["class"]),
        headers=headers,
        json=schedule_payload(scope, **overrides),
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def test_f35_manager_creates_schedule_without_hard_coded_duration(
    app, client, users, auth_header, schedule_scope
):
    body = create_schedule(
        client,
        auth_header(users["manager"]),
        schedule_scope,
        start_time="08:00:00",
        end_time="09:00:00",
    )

    assert body["class_id"] == schedule_scope["class"]
    assert body["day_of_week"] == 2
    assert body["start_time"] == "08:00:00"
    assert body["end_time"] == "09:00:00"
    assert body["room"]["id"] == schedule_scope["room"]
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "class_schedules",
                AuditLog.entity_id == body["id"],
            )
        )
        assert audit.action == "CREATE"
        assert audit.actor_user_id == users["manager"]
        assert audit.new_data["start_time"] == "08:00:00"


@pytest.mark.parametrize("actor", ["manager", "lecturer", "assistant", "student"])
def test_f35_authorized_class_scope_can_list_schedules(
    client, users, auth_header, schedule_scope, actor
):
    created = create_schedule(client, auth_header(users["manager"]), schedule_scope)
    response = client.get(
        class_schedules_url(schedule_scope["class"]),
        headers=auth_header(users[actor]),
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.get_json()["items"]] == [created["id"]]


def test_f35_denies_unassigned_staff_and_requires_auth(
    client, auth_header, schedule_scope
):
    url = class_schedules_url(schedule_scope["class"])
    assert client.get(url).status_code == 401
    assert client.get(url, headers=auth_header(schedule_scope["outsider"])).status_code == 403


@pytest.mark.parametrize("actor", ["lecturer", "assistant", "student"])
def test_f35_only_manager_can_mutate_schedules(
    client, users, auth_header, schedule_scope, actor
):
    response = client.post(
        class_schedules_url(schedule_scope["class"]),
        headers=auth_header(users[actor]),
        json=schedule_payload(schedule_scope),
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"day_of_week": 0}, "day_of_week"),
        ({"day_of_week": 8}, "day_of_week"),
        ({"day_of_week": "2"}, "day_of_week"),
        ({"start_time": "invalid"}, "start_time"),
        ({"end_time": "18:00:00"}, "end_time"),
        ({"room_id": "1"}, "room_id"),
    ],
)
def test_f35_validates_create_payload(
    client, users, auth_header, schedule_scope, overrides, field
):
    response = client.post(
        class_schedules_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=schedule_payload(schedule_scope, **overrides),
    )
    assert response.status_code == 422
    assert field in response.get_json()["errors"]["json"]


def test_f35_rejects_missing_class_or_room(client, users, auth_header, schedule_scope):
    headers = auth_header(users["manager"])
    missing_class = client.post(
        class_schedules_url(999999),
        headers=headers,
        json=schedule_payload(schedule_scope),
    )
    missing_room = client.post(
        class_schedules_url(schedule_scope["class"]),
        headers=headers,
        json=schedule_payload(schedule_scope, room_id=999999),
    )
    assert missing_class.status_code == 404
    assert missing_room.status_code == 404


@pytest.mark.parametrize("room_key", ["small_room", "maintenance_room"])
def test_f35_requires_available_room_with_enough_capacity(
    client, users, auth_header, schedule_scope, room_key
):
    response = client.post(
        class_schedules_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=schedule_payload(schedule_scope, room_id=schedule_scope[room_key]),
    )
    assert response.status_code == 409


def test_f35_rejects_schedule_changes_for_finished_class(
    client, users, auth_header, schedule_scope
):
    response = client.post(
        class_schedules_url(schedule_scope["completed_class"]),
        headers=auth_header(users["manager"]),
        json=schedule_payload(schedule_scope),
    )
    assert response.status_code == 409


def test_f35_rejects_duplicate_class_day_and_start(
    client, users, auth_header, schedule_scope
):
    headers = auth_header(users["manager"])
    create_schedule(client, headers, schedule_scope)
    duplicate = client.post(
        class_schedules_url(schedule_scope["class"]),
        headers=headers,
        json=schedule_payload(schedule_scope, end_time="20:00:00"),
    )
    assert duplicate.status_code == 409


def test_f35_updates_schedule_and_audits_only_changed_fields(
    app, client, users, auth_header, schedule_scope
):
    headers = auth_header(users["manager"])
    created = create_schedule(client, headers, schedule_scope)
    response = client.patch(
        schedule_url(created["id"]),
        headers=headers,
        json={"day_of_week": 4, "room_id": schedule_scope["room_2"]},
    )
    assert response.status_code == 200
    assert response.get_json()["day_of_week"] == 4
    assert response.get_json()["room"]["id"] == schedule_scope["room_2"]
    with app.app_context():
        audits = db.session.scalars(
            select(AuditLog)
            .where(AuditLog.entity_name == "class_schedules")
            .order_by(AuditLog.id)
        ).all()
        assert len(audits) == 2
        assert audits[1].old_data == {
            "day_of_week": 2,
            "room_id": schedule_scope["room"],
        }
        assert audits[1].new_data == {
            "day_of_week": 4,
            "room_id": schedule_scope["room_2"],
        }


def test_f35_partial_update_revalidates_combined_time_range(
    client, users, auth_header, schedule_scope
):
    headers = auth_header(users["manager"])
    created = create_schedule(client, headers, schedule_scope)
    response = client.patch(
        schedule_url(created["id"]), headers=headers, json={"end_time": "17:00:00"}
    )
    assert response.status_code == 409


def test_f35_delete_schedule_writes_audit_and_removes_resource(
    app, client, users, auth_header, schedule_scope
):
    headers = auth_header(users["manager"])
    created = create_schedule(client, headers, schedule_scope)
    response = client.delete(schedule_url(created["id"]), headers=headers)
    assert response.status_code == 204
    with app.app_context():
        assert db.session.execute(
            text("SELECT COUNT(*) FROM class_schedules WHERE id = :id"),
            {"id": created["id"]},
        ).scalar_one() == 0
        delete_audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "class_schedules",
                AuditLog.entity_id == created["id"],
                AuditLog.action == "DELETE",
            )
        )
        assert json.loads(json.dumps(delete_audit.old_data))["room_id"] == schedule_scope["room"]


def test_f35_handles_missing_schedule_on_update_and_delete(
    client, users, auth_header, schedule_scope
):
    headers = auth_header(users["manager"])
    assert client.patch(
        schedule_url(999999), headers=headers, json={"day_of_week": 3}
    ).status_code == 404
    assert client.delete(schedule_url(999999), headers=headers).status_code == 404


def _insert_schedule(class_id, room_id, day=2, start="18:00:00", end="19:30:00"):
    return db.session.execute(
        text(
            """INSERT INTO class_schedules
                (class_id, day_of_week, start_time, end_time, room_id)
               OUTPUT INSERTED.id
               VALUES (:class_id, :day, :start, :end, :room_id)"""
        ),
        {"class_id": class_id, "day": day, "start": start, "end": end, "room_id": room_id},
    ).scalar_one()


def _insert_other_class(scope, *, code, name, lecturer, assistant=None, room=None):
    return _insert_class(
        code,
        name,
        scope["course"],
        lecturer,
        assistant,
        room or scope["room_2"],
    )


def _assert_conflict(response, conflict_type, **expected):
    assert response.status_code == 409, response.get_json()
    conflict = response.get_json()["errors"]["conflict"]
    assert conflict["type"] == conflict_type
    for key, value in expected.items():
        assert conflict[key] == value


@pytest.mark.parametrize(
    ("existing_start", "existing_end", "new_start", "new_end", "conflicts"),
    [
        ("18:00:00", "19:00:00", "17:00:00", "18:00:00", False),
        ("18:00:00", "19:00:00", "19:00:00", "20:00:00", False),
        ("18:00:00", "19:00:00", "17:30:00", "18:30:00", True),
        ("18:00:00", "19:00:00", "18:30:00", "19:30:00", True),
        ("18:00:00", "19:00:00", "18:15:00", "18:45:00", True),
        ("18:00:00", "19:00:00", "17:30:00", "19:30:00", True),
    ],
)
def test_f36_uses_half_open_overlap_formula_for_room(
    app,
    client,
    users,
    auth_header,
    schedule_scope,
    existing_start,
    existing_end,
    new_start,
    new_end,
    conflicts,
):
    with app.app_context():
        other_class = _insert_other_class(
            schedule_scope,
            code="CLS-ROOM-CONFLICT",
            name="Room Conflict",
            lecturer=schedule_scope["other_lecturer"],
            assistant=schedule_scope["other_assistant"],
            room=schedule_scope["room"],
        )
        existing_schedule = _insert_schedule(
            other_class,
            schedule_scope["room"],
            start=existing_start,
            end=existing_end,
        )
        db.session.commit()
    response = client.post(
        class_schedules_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=schedule_payload(
            schedule_scope, start_time=new_start, end_time=new_end
        ),
    )
    if conflicts:
        _assert_conflict(
            response,
            "ROOM",
            schedule_id=existing_schedule,
            class_id=other_class,
            room_id=schedule_scope["room"],
        )
    else:
        assert response.status_code == 201, response.get_json()


@pytest.mark.parametrize(
    ("candidate_role", "other_role"),
    [
        ("lecturer", "lecturer"),
        ("lecturer", "assistant"),
        ("assistant", "lecturer"),
        ("assistant", "assistant"),
    ],
)
def test_f36_detects_staff_conflict_across_lecturer_and_assistant_roles(
    app,
    client,
    users,
    auth_header,
    schedule_scope,
    candidate_role,
    other_role,
):
    shared_staff = schedule_scope["staff_ids"][users[candidate_role]]
    lecturer = schedule_scope["other_lecturer"]
    assistant = schedule_scope["other_assistant"]
    if other_role == "lecturer":
        lecturer = shared_staff
    else:
        assistant = shared_staff
    with app.app_context():
        other_class = _insert_other_class(
            schedule_scope,
            code=f"C-S-{candidate_role[0]}-{other_role[0]}",
            name=f"Staff {candidate_role} {other_role}",
            lecturer=lecturer,
            assistant=assistant,
        )
        existing_schedule = _insert_schedule(other_class, schedule_scope["room_2"])
        db.session.commit()
    response = client.post(
        class_schedules_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=schedule_payload(schedule_scope),
    )
    _assert_conflict(
        response,
        "STAFF",
        schedule_id=existing_schedule,
        class_id=other_class,
        staff_id=shared_staff,
    )


def test_f36_detects_active_student_conflict(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        other_class = _insert_other_class(
            schedule_scope,
            code="CLS-STUDENT-CONFLICT",
            name="Student Conflict",
            lecturer=schedule_scope["other_lecturer"],
            assistant=schedule_scope["other_assistant"],
        )
        db.session.execute(
            text(
                "INSERT INTO class_enrollments "
                "(class_id, student_id, enrolled_date, status) "
                "VALUES (:class_id, :student_id, '2026-01-01', 'ACTIVE')"
            ),
            {"class_id": other_class, "student_id": schedule_scope["student"]},
        )
        existing_schedule = _insert_schedule(other_class, schedule_scope["room_2"])
        db.session.commit()
    response = client.post(
        class_schedules_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=schedule_payload(schedule_scope),
    )
    _assert_conflict(
        response,
        "STUDENT",
        schedule_id=existing_schedule,
        class_id=other_class,
        student_id=schedule_scope["student"],
    )


@pytest.mark.parametrize("other_status", ["TRANSFERRED", "DROPPED", "COMPLETED"])
def test_f36_ignores_non_active_student_enrollment(
    app, client, users, auth_header, schedule_scope, other_status
):
    with app.app_context():
        other_class = _insert_other_class(
            schedule_scope,
            code=f"C-I-{other_status[:3]}",
            name=f"Inactive {other_status}",
            lecturer=schedule_scope["other_lecturer"],
            assistant=schedule_scope["other_assistant"],
        )
        db.session.execute(
            text(
                "INSERT INTO class_enrollments "
                "(class_id, student_id, enrolled_date, left_date, status) "
                "VALUES (:class_id, :student_id, '2026-01-01', '2026-02-01', :status)"
            ),
            {
                "class_id": other_class,
                "student_id": schedule_scope["student"],
                "status": other_status,
            },
        )
        _insert_schedule(other_class, schedule_scope["room_2"])
        db.session.commit()
    response = client.post(
        class_schedules_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=schedule_payload(schedule_scope),
    )
    assert response.status_code == 201, response.get_json()


def test_f36_conflicts_only_on_same_day_of_week(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        other_class = _insert_other_class(
            schedule_scope,
            code="CLS-OTHER-DAY",
            name="Other Day",
            lecturer=schedule_scope["other_lecturer"],
            assistant=schedule_scope["other_assistant"],
            room=schedule_scope["room"],
        )
        _insert_schedule(other_class, schedule_scope["room"], day=3)
        db.session.commit()
    response = client.post(
        class_schedules_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=schedule_payload(schedule_scope, day_of_week=2),
    )
    assert response.status_code == 201


def test_f36_update_ignores_itself_but_detects_other_schedule(
    app, client, users, auth_header, schedule_scope
):
    headers = auth_header(users["manager"])
    created = create_schedule(client, headers, schedule_scope)
    self_update = client.patch(
        schedule_url(created["id"]), headers=headers, json={"end_time": "19:45:00"}
    )
    assert self_update.status_code == 200, self_update.get_json()
    with app.app_context():
        other_class = _insert_other_class(
            schedule_scope,
            code="CLS-UPDATE-CONFLICT",
            name="Update Conflict",
            lecturer=schedule_scope["other_lecturer"],
            assistant=schedule_scope["other_assistant"],
            room=schedule_scope["room_2"],
        )
        other_schedule = _insert_schedule(
            other_class, schedule_scope["room_2"], start="20:00:00", end="21:00:00"
        )
        db.session.commit()
    conflict = client.patch(
        schedule_url(created["id"]),
        headers=headers,
        json={
            "start_time": "20:30:00",
            "end_time": "21:30:00",
            "room_id": schedule_scope["room_2"],
        },
    )
    _assert_conflict(
        conflict,
        "ROOM",
        schedule_id=other_schedule,
        class_id=other_class,
        room_id=schedule_scope["room_2"],
    )


def test_f36_ignores_schedule_of_cancelled_class(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        other_class = _insert_other_class(
            schedule_scope,
            code="C-CANCELLED",
            name="Cancelled Conflict",
            lecturer=schedule_scope["other_lecturer"],
            assistant=schedule_scope["other_assistant"],
            room=schedule_scope["room"],
        )
        _insert_schedule(other_class, schedule_scope["room"])
        db.session.execute(
            text("UPDATE classes SET status = 'CANCELLED' WHERE id = :id"),
            {"id": other_class},
        )
        db.session.commit()
    response = client.post(
        class_schedules_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=schedule_payload(schedule_scope),
    )
    assert response.status_code == 201


def generate_url(class_id):
    return f"/api/v1/classes/{class_id}/sessions/generate"


def _add_generation_schedules(scope):
    monday = _insert_schedule(
        scope["class"], scope["room"], day=1, start="09:00:00", end="10:00:00"
    )
    wednesday = _insert_schedule(
        scope["class"], scope["room_2"], day=3, start="18:00:00", end="19:30:00"
    )
    db.session.commit()
    return monday, wednesday


def generation_payload(**overrides):
    payload = {"date_from": "2026-01-05", "date_to": "2026-01-11"}
    payload.update(overrides)
    return payload


def test_f37_generates_sessions_from_iso_weekday_schedules_with_staff_snapshot(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        _add_generation_schedules(schedule_scope)
    response = client.post(
        generate_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=generation_payload(),
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["created_count"] == 2
    assert body["skipped_count"] == 0
    assert [item["session_date"] for item in body["sessions"]] == [
        "2026-01-05",
        "2026-01-07",
    ]
    assert [item["start_time"] for item in body["sessions"]] == [
        "09:00:00",
        "18:00:00",
    ]
    assert all(item["status"] == "SCHEDULED" for item in body["sessions"])
    assert all(
        item["lecturer"]["id"] == schedule_scope["staff_ids"][users["lecturer"]]
        for item in body["sessions"]
    )
    assert all(
        item["assistant"]["id"] == schedule_scope["staff_ids"][users["assistant"]]
        for item in body["sessions"]
    )
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(AuditLog.entity_name == "class_session_generations")
        )
        assert audit.actor_user_id == users["manager"]
        assert audit.new_data["created_count"] == 2


def test_f37_generation_is_idempotent_and_skips_existing_session(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        _add_generation_schedules(schedule_scope)
        db.session.execute(
            text(
                """INSERT INTO class_sessions
                    (class_id, session_date, start_time, end_time, room_id,
                     lecturer_id, assistant_id, status)
                   VALUES (:class_id, '2026-01-05', '09:00:00', '10:00:00', :room_id,
                           :lecturer_id, :assistant_id, 'SCHEDULED')"""
            ),
            {
                "class_id": schedule_scope["class"],
                "room_id": schedule_scope["room"],
                "lecturer_id": schedule_scope["staff_ids"][users["lecturer"]],
                "assistant_id": schedule_scope["staff_ids"][users["assistant"]],
            },
        )
        db.session.commit()
    headers = auth_header(users["manager"])
    first = client.post(
        generate_url(schedule_scope["class"]), headers=headers, json=generation_payload()
    )
    second = client.post(
        generate_url(schedule_scope["class"]), headers=headers, json=generation_payload()
    )
    assert first.status_code == 201
    assert first.get_json()["created_count"] == 1
    assert first.get_json()["skipped_count"] == 1
    assert second.status_code == 201
    assert second.get_json()["created_count"] == 0
    assert second.get_json()["skipped_count"] == 2
    with app.app_context():
        assert db.session.execute(
            text("SELECT COUNT(*) FROM class_sessions WHERE class_id = :class_id"),
            {"class_id": schedule_scope["class"]},
        ).scalar_one() == 2


@pytest.mark.parametrize("actor", ["lecturer", "assistant", "student"])
def test_f37_only_manager_can_generate_sessions(
    app, client, users, auth_header, schedule_scope, actor
):
    with app.app_context():
        _add_generation_schedules(schedule_scope)
    response = client.post(
        generate_url(schedule_scope["class"]),
        headers=auth_header(users[actor]),
        json=generation_payload(),
    )
    assert response.status_code == 403


def test_f37_requires_auth_before_payload_validation(client, schedule_scope):
    assert client.post(generate_url(schedule_scope["class"]), json={"date_from": "x"}).status_code == 401


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"date_from": "invalid"}, "date_from"),
        ({"date_to": "invalid"}, "date_to"),
        ({"date_from": "2026-02-01", "date_to": "2026-01-01"}, "date_to"),
    ],
)
def test_f37_validates_generation_payload(
    client, users, auth_header, schedule_scope, payload, field
):
    response = client.post(
        generate_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=payload,
    )
    assert response.status_code == 422
    assert field in response.get_json()["errors"]["json"]


@pytest.mark.parametrize(
    "payload",
    [
        {"date_from": "2025-12-31", "date_to": "2026-01-05"},
        {"date_from": "2026-12-31", "date_to": "2027-01-01"},
    ],
)
def test_f37_restricts_generation_to_class_date_range(
    app, client, users, auth_header, schedule_scope, payload
):
    with app.app_context():
        _add_generation_schedules(schedule_scope)
    response = client.post(
        generate_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=payload,
    )
    assert response.status_code == 400


def test_f37_rejects_missing_class_or_schedules(
    client, users, auth_header, schedule_scope
):
    headers = auth_header(users["manager"])
    assert client.post(
        generate_url(999999), headers=headers, json=generation_payload()
    ).status_code == 404
    no_schedules = client.post(
        generate_url(schedule_scope["class"]), headers=headers, json=generation_payload()
    )
    assert no_schedules.status_code == 409


def test_f37_rejects_finished_class(app, client, users, auth_header, schedule_scope):
    with app.app_context():
        _insert_schedule(
            schedule_scope["completed_class"], schedule_scope["room"], day=1
        )
        db.session.commit()
    response = client.post(
        generate_url(schedule_scope["completed_class"]),
        headers=auth_header(users["manager"]),
        json=generation_payload(),
    )
    assert response.status_code == 409


@pytest.mark.parametrize("room_change", ["MAINTENANCE", "TOO_SMALL"])
def test_f37_revalidates_room_before_generation(
    app, client, users, auth_header, schedule_scope, room_change
):
    with app.app_context():
        _add_generation_schedules(schedule_scope)
        if room_change == "MAINTENANCE":
            db.session.execute(
                text("UPDATE rooms SET status = 'MAINTENANCE' WHERE id = :id"),
                {"id": schedule_scope["room"]},
            )
        else:
            db.session.execute(
                text("UPDATE rooms SET capacity = 1 WHERE id = :id"),
                {"id": schedule_scope["room"]},
            )
        db.session.commit()
    response = client.post(
        generate_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=generation_payload(),
    )
    assert response.status_code == 409


def test_f37_supports_partial_date_input_using_class_boundary(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        _insert_schedule(
            schedule_scope["class"], schedule_scope["room"], day=1,
            start="09:00:00", end="10:00:00"
        )
        db.session.commit()
    response = client.post(
        generate_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json={"date_to": "2026-01-05"},
    )
    assert response.status_code == 201
    assert response.get_json()["date_from"] == "2026-01-01"
    assert response.get_json()["created_count"] == 1


def sessions_url(session_id=None):
    base = "/api/v1/sessions"
    return f"{base}/{session_id}" if session_id is not None else base


def _insert_session(
    scope,
    *,
    class_id=None,
    session_date="2026-01-10",
    start="09:00:00",
    end="10:30:00",
    room_id=None,
    lecturer_id=None,
    assistant_id=None,
    status="SCHEDULED",
):
    return db.session.execute(
        text(
            """INSERT INTO class_sessions
                (class_id, session_date, start_time, end_time, room_id,
                 lecturer_id, assistant_id, status)
               OUTPUT INSERTED.id
               VALUES (:class_id, :session_date, :start, :end, :room_id,
                       :lecturer_id, :assistant_id, :status)"""
        ),
        {
            "class_id": class_id or scope["class"],
            "session_date": session_date,
            "start": start,
            "end": end,
            "room_id": room_id or scope["room"],
            "lecturer_id": lecturer_id or scope["staff_ids"][scope["lecturer_user"]],
            "assistant_id": (
                scope["staff_ids"][scope["assistant_user"]]
                if assistant_id is None
                else assistant_id
            ),
            "status": status,
        },
    ).scalar_one()


@pytest.fixture
def session_scope(app, schedule_scope, users):
    schedule_scope["lecturer_user"] = users["lecturer"]
    schedule_scope["assistant_user"] = users["assistant"]
    with app.app_context():
        session_1 = _insert_session(schedule_scope, session_date="2026-01-10")
        session_2 = _insert_session(
            schedule_scope,
            session_date="2026-02-10",
            room_id=schedule_scope["room_2"],
            status="COMPLETED",
        )
        other_class = _insert_other_class(
            schedule_scope,
            code="C-F38-OTHER",
            name="F38 Other",
            lecturer=schedule_scope["other_lecturer"],
            assistant=schedule_scope["other_assistant"],
        )
        other_session = _insert_session(
            schedule_scope,
            class_id=other_class,
            session_date="2026-03-10",
            room_id=schedule_scope["room_2"],
            lecturer_id=schedule_scope["other_lecturer"],
            assistant_id=schedule_scope["other_assistant"],
            status="CANCELLED",
        )
        override_session = _insert_session(
            schedule_scope,
            session_date="2026-04-10",
            lecturer_id=schedule_scope["other_lecturer"],
            assistant_id=schedule_scope["other_assistant"],
        )
        db.session.commit()
    return {
        **schedule_scope,
        "sessions": (session_1, session_2, other_session, override_session),
        "other_class": other_class,
    }


def get_sessions(client, headers, **query):
    response = client.get(sessions_url(), headers=headers, query_string=query)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def session_ids(body):
    return [item["id"] for item in body["items"]]


def test_f38_manager_lists_all_sessions_with_pagination_and_related_data(
    client, users, auth_header, session_scope
):
    body = get_sessions(client, auth_header(users["manager"]), page=1, page_size=3)
    assert session_ids(body) == list(session_scope["sessions"][:3])
    assert body["pagination"] == {
        "page": 1,
        "page_size": 3,
        "total": 4,
        "total_pages": 2,
    }
    assert body["items"][0]["room"]["id"] == session_scope["room"]
    assert body["items"][0]["lecturer"]["id"] == session_scope["staff_ids"][users["lecturer"]]
    assert body["items"][0]["assistant"]["id"] == session_scope["staff_ids"][users["assistant"]]


@pytest.mark.parametrize("actor", ["lecturer", "assistant"])
def test_f38_assigned_class_staff_see_class_sessions_even_with_session_override(
    client, users, auth_header, session_scope, actor
):
    body = get_sessions(client, auth_header(users[actor]))
    assert session_ids(body) == [
        session_scope["sessions"][0],
        session_scope["sessions"][1],
        session_scope["sessions"][3],
    ]


def test_f38_session_override_staff_sees_overridden_and_own_class_sessions(
    client, auth_header, session_scope
):
    body = get_sessions(client, auth_header(session_scope["outsider"]))
    assert session_ids(body) == [
        session_scope["sessions"][2],
        session_scope["sessions"][3],
    ]


def test_f38_parent_scope_respects_enrollment_effective_dates(
    app, client, users, auth_header, session_scope
):
    with app.app_context():
        db.session.execute(
            text(
                "UPDATE class_enrollments SET status = 'COMPLETED', left_date = '2026-01-31' "
                "WHERE class_id = :class_id AND student_id = :student_id"
            ),
            {"class_id": session_scope["class"], "student_id": session_scope["student"]},
        )
        db.session.commit()
    body = get_sessions(client, auth_header(users["student"]))
    assert session_ids(body) == [session_scope["sessions"][0]]


def test_f38_filters_class_student_staff_room_date_and_status(
    client, users, auth_header, session_scope
):
    headers = auth_header(users["manager"])
    assert session_ids(get_sessions(client, headers, class_id=session_scope["other_class"])) == [
        session_scope["sessions"][2]
    ]
    assert session_ids(get_sessions(client, headers, student_id=session_scope["student"])) == [
        session_scope["sessions"][0],
        session_scope["sessions"][1],
        session_scope["sessions"][3],
    ]
    assert session_ids(get_sessions(client, headers, staff_id=session_scope["other_lecturer"])) == [
        session_scope["sessions"][2],
        session_scope["sessions"][3],
    ]
    assert session_ids(get_sessions(client, headers, room_id=session_scope["room"])) == [
        session_scope["sessions"][0],
        session_scope["sessions"][3],
    ]
    assert session_ids(
        get_sessions(client, headers, date_from="2026-02-01", date_to="2026-03-31")
    ) == [session_scope["sessions"][1], session_scope["sessions"][2]]
    assert session_ids(get_sessions(client, headers, status="COMPLETED")) == [
        session_scope["sessions"][1]
    ]


def test_f38_filters_remain_inside_actor_scope(client, users, auth_header, session_scope):
    body = get_sessions(
        client,
        auth_header(users["lecturer"]),
        class_id=session_scope["other_class"],
    )
    assert body["items"] == []


@pytest.mark.parametrize(
    ("query", "field"),
    [
        ({"page": 0}, "page"),
        ({"page_size": 101}, "page_size"),
        ({"class_id": 0}, "class_id"),
        ({"student_id": "abc"}, "student_id"),
        ({"staff_id": 0}, "staff_id"),
        ({"room_id": 0}, "room_id"),
        ({"date_from": "invalid"}, "date_from"),
        ({"date_from": "2026-02-01", "date_to": "2026-01-01"}, "date_to"),
        ({"status": "ONGOING"}, "status"),
    ],
)
def test_f38_validates_list_filters(
    client, users, auth_header, session_scope, query, field
):
    response = client.get(
        sessions_url(), headers=auth_header(users["manager"]), query_string=query
    )
    assert response.status_code == 422
    assert field in response.get_json()["errors"]["query"]


def test_f38_requires_auth_before_query_validation(client):
    assert client.get(f"{sessions_url()}?page=bad").status_code == 401


@pytest.mark.parametrize("actor", ["manager", "lecturer", "assistant", "student"])
def test_f38_authorized_actor_can_get_session_detail(
    client, users, auth_header, session_scope, actor
):
    response = client.get(
        sessions_url(session_scope["sessions"][0]), headers=auth_header(users[actor])
    )
    assert response.status_code == 200
    assert response.get_json()["id"] == session_scope["sessions"][0]


def test_f38_detail_denies_out_of_scope_and_returns_not_found(
    client, users, auth_header, session_scope
):
    denied = client.get(
        sessions_url(session_scope["sessions"][2]),
        headers=auth_header(users["lecturer"]),
    )
    missing = client.get(sessions_url(999999), headers=auth_header(users["manager"]))
    assert denied.status_code == 403
    assert missing.status_code == 404


def exception_url(class_id):
    return f"/api/v1/classes/{class_id}/sessions"


def exception_payload(**overrides):
    payload = {
        "session_date": "2026-05-10",
        "start_time": "09:00:00",
        "end_time": "10:30:00",
        "note": "Buổi học bù",
    }
    payload.update(overrides)
    return payload


def test_f39_manager_creates_exception_session_with_class_defaults_and_audit(
    app, client, users, auth_header, schedule_scope
):
    response = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=exception_payload(),
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["session_date"] == "2026-05-10"
    assert body["room"]["id"] == schedule_scope["room"]
    assert body["lecturer"]["id"] == schedule_scope["staff_ids"][users["lecturer"]]
    assert body["assistant"]["id"] == schedule_scope["staff_ids"][users["assistant"]]
    assert body["status"] == "SCHEDULED"
    assert body["note"] == "Buổi học bù"
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "class_sessions", AuditLog.entity_id == body["id"]
            )
        )
        assert audit.action == "CREATE"
        assert audit.new_data["status"] == "SCHEDULED"


def test_f39_manager_can_override_room_and_staff_or_remove_assistant(
    client, users, auth_header, schedule_scope
):
    response = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=exception_payload(
            room_id=schedule_scope["room_2"],
            lecturer_id=schedule_scope["other_lecturer"],
            assistant_id=None,
        ),
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["room"]["id"] == schedule_scope["room_2"]
    assert body["lecturer"]["id"] == schedule_scope["other_lecturer"]
    assert body["assistant"] is None


@pytest.mark.parametrize("actor", ["lecturer", "assistant", "student"])
def test_f39_only_manager_can_create_or_update_exception_session(
    app, client, users, auth_header, schedule_scope, actor
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(schedule_scope, session_date="2026-05-11")
        db.session.commit()
    assert client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users[actor]),
        json=exception_payload(),
    ).status_code == 403
    assert client.patch(
        sessions_url(session_id),
        headers=auth_header(users[actor]),
        json={"note": "x"},
    ).status_code == 403


def test_f39_requires_auth_before_validation(client, schedule_scope):
    assert client.post(exception_url(schedule_scope["class"]), json={}).status_code == 401
    assert client.patch(sessions_url(999999), json={}).status_code == 401


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({}, "session_date"),
        ({"session_date": "x", "start_time": "09:00", "end_time": "10:00"}, "session_date"),
        ({"session_date": "2026-05-10", "start_time": "x", "end_time": "10:00"}, "start_time"),
        ({"session_date": "2026-05-10", "start_time": "10:00", "end_time": "09:00"}, "end_time"),
        ({**exception_payload(), "room_id": "1"}, "room_id"),
        ({**exception_payload(), "lecturer_id": "1"}, "lecturer_id"),
        ({**exception_payload(), "note": "x" * 256}, "note"),
    ],
)
def test_f39_validates_create_payload(
    client, users, auth_header, schedule_scope, payload, field
):
    response = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=payload,
    )
    assert response.status_code == 422
    assert field in response.get_json()["errors"]["json"]


def test_f39_validates_partial_update_combined_values(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(schedule_scope, session_date="2026-05-11")
        db.session.commit()
    response = client.patch(
        sessions_url(session_id),
        headers=auth_header(users["manager"]),
        json={"end_time": "08:00:00"},
    )
    assert response.status_code == 409


@pytest.mark.parametrize("session_date", ["2025-12-31", "2027-01-01"])
def test_f39_requires_session_date_inside_class_range(
    client, users, auth_header, schedule_scope, session_date
):
    response = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=exception_payload(session_date=session_date),
    )
    assert response.status_code == 400


def test_f39_rejects_finished_or_missing_class(client, users, auth_header, schedule_scope):
    headers = auth_header(users["manager"])
    assert client.post(
        exception_url(schedule_scope["completed_class"]),
        headers=headers,
        json=exception_payload(),
    ).status_code == 409
    assert client.post(
        exception_url(999999), headers=headers, json=exception_payload()
    ).status_code == 404


@pytest.mark.parametrize("room_key", ["maintenance_room"])
def test_f39_rejects_unavailable_room(
    client, users, auth_header, schedule_scope, room_key
):
    response = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=exception_payload(room_id=schedule_scope[room_key]),
    )
    assert response.status_code == 409


def _add_students_to_class(scope, count):
    for index in range(count):
        guardian_id = db.session.execute(
            text(
                "INSERT INTO guardians (full_name, phone, relationship) OUTPUT INSERTED.id "
                "VALUES (:name, :phone, 'GUARDIAN')"
            ),
            {"name": f"Guardian {index}", "phone": f"0910{index:06d}"},
        ).scalar_one()
        student_id = db.session.execute(
            text(
                """INSERT INTO students
                    (student_code, full_name, date_of_birth, guardian_id,
                     current_level_id, enrolled_at, status)
                   OUTPUT INSERTED.id
                   VALUES (:code, :name, '2018-01-01', :guardian_id,
                           :level_id, '2025-01-01', 'ACTIVE')"""
            ),
            {
                "code": f"HX{index:03d}",
                "name": f"Student {index}",
                "guardian_id": guardian_id,
                "level_id": scope["level"],
            },
        ).scalar_one()
        db.session.execute(
            text(
                "INSERT INTO class_enrollments "
                "(class_id, student_id, enrolled_date, status) "
                "VALUES (:class_id, :student_id, '2026-01-01', 'ACTIVE')"
            ),
            {"class_id": scope["class"], "student_id": student_id},
        )


def test_f39_room_capacity_uses_active_enrollment_count(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        _add_students_to_class(schedule_scope, 5)
        db.session.commit()
    response = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=exception_payload(room_id=schedule_scope["small_room"]),
    )
    assert response.status_code == 409
    assert "sức chứa" in response.get_json()["message"].lower()


@pytest.mark.parametrize(
    ("field", "staff_key"),
    [("lecturer_id", "other_assistant"), ("assistant_id", "other_lecturer")],
)
def test_f39_requires_correct_staff_position(
    client, users, auth_header, schedule_scope, field, staff_key
):
    response = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=exception_payload(**{field: schedule_scope[staff_key]}),
    )
    assert response.status_code == 409


def test_f39_rejects_missing_or_inactive_staff(
    app, client, users, auth_header, schedule_scope
):
    headers = auth_header(users["manager"])
    missing = client.post(
        exception_url(schedule_scope["class"]),
        headers=headers,
        json=exception_payload(lecturer_id=999999),
    )
    with app.app_context():
        db.session.execute(
            text("UPDATE staff_profiles SET status = 'INACTIVE' WHERE id = :id"),
            {"id": schedule_scope["other_lecturer"]},
        )
        db.session.commit()
    inactive = client.post(
        exception_url(schedule_scope["class"]),
        headers=headers,
        json=exception_payload(lecturer_id=schedule_scope["other_lecturer"]),
    )
    assert missing.status_code == 404
    assert inactive.status_code == 409


def test_f39_rejects_same_lecturer_and_assistant(
    client, users, auth_header, schedule_scope
):
    staff_id = schedule_scope["other_lecturer"]
    response = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=exception_payload(lecturer_id=staff_id, assistant_id=staff_id),
    )
    assert response.status_code == 422


@pytest.mark.parametrize("conflict_type", ["ROOM", "STAFF", "STUDENT"])
def test_f39_detects_actual_session_conflicts(
    app, client, users, auth_header, schedule_scope, conflict_type
):
    with app.app_context():
        other_class = _insert_other_class(
            schedule_scope,
            code=f"C-F39-{conflict_type}",
            name=f"F39 {conflict_type}",
            lecturer=schedule_scope["other_lecturer"],
            assistant=schedule_scope["other_assistant"],
        )
        room_id = schedule_scope["room_2"]
        lecturer_id = schedule_scope["other_lecturer"]
        assistant_id = schedule_scope["other_assistant"]
        if conflict_type == "ROOM":
            room_id = schedule_scope["room"]
        elif conflict_type == "STAFF":
            lecturer_id = schedule_scope["staff_ids"][users["lecturer"]]
        else:
            db.session.execute(
                text(
                    "INSERT INTO class_enrollments "
                    "(class_id, student_id, enrolled_date, status) "
                    "VALUES (:class_id, :student_id, '2026-01-01', 'ACTIVE')"
                ),
                {"class_id": other_class, "student_id": schedule_scope["student"]},
            )
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        existing = _insert_session(
            schedule_scope,
            class_id=other_class,
            session_date="2026-05-10",
            room_id=room_id,
            lecturer_id=lecturer_id,
            assistant_id=assistant_id,
        )
        db.session.commit()
    response = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=exception_payload(),
    )
    assert response.status_code == 409
    assert response.get_json()["errors"]["conflict"]["type"] == conflict_type
    assert response.get_json()["errors"]["conflict"]["session_id"] == existing


def test_f39_ignores_cancelled_session_for_conflicts(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        _insert_session(
            schedule_scope,
            session_date="2026-05-10",
            start="09:30:00",
            end="11:00:00",
            status="CANCELLED",
        )
        db.session.commit()
    response = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=exception_payload(),
    )
    assert response.status_code == 201


def test_f39_updates_scheduled_session_ignores_itself_and_audits(
    app, client, users, auth_header, schedule_scope
):
    create = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=exception_payload(),
    )
    session_id = create.get_json()["id"]
    update = client.patch(
        sessions_url(session_id),
        headers=auth_header(users["manager"]),
        json={"start_time": "10:30:00", "end_time": "12:00:00", "note": "Đổi giờ"},
    )
    assert update.status_code == 200, update.get_json()
    assert update.get_json()["start_time"] == "10:30:00"
    with app.app_context():
        audits = db.session.scalars(
            select(AuditLog)
            .where(AuditLog.entity_name == "class_sessions", AuditLog.entity_id == session_id)
            .order_by(AuditLog.id)
        ).all()
        assert len(audits) == 2
        assert audits[1].old_data["note"] == "Buổi học bù"
        assert audits[1].new_data["note"] == "Đổi giờ"


@pytest.mark.parametrize("status", ["COMPLETED", "CANCELLED"])
def test_f39_cannot_update_closed_session(
    app, client, users, auth_header, schedule_scope, status
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(
            schedule_scope, session_date="2026-05-10", status=status
        )
        db.session.commit()
    response = client.patch(
        sessions_url(session_id),
        headers=auth_header(users["manager"]),
        json={"note": "Không được"},
    )
    assert response.status_code == 409


def test_f39_update_returns_not_found(client, users, auth_header, schedule_scope):
    response = client.patch(
        sessions_url(999999),
        headers=auth_header(users["manager"]),
        json={"note": "x"},
    )
    assert response.status_code == 404


def cancel_url(session_id):
    return f"{sessions_url(session_id)}/cancel"


def test_f40_manager_cancels_session_with_reason_actor_and_audit(
    app, client, users, auth_header, schedule_scope
):
    create = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=exception_payload(),
    )
    session_id = create.get_json()["id"]
    response = client.post(
        cancel_url(session_id),
        headers=auth_header(users["manager"]),
        json={"reason": "  Trung tâm mất điện  "},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "CANCELLED"
    assert body["note"] == "Trung tâm mất điện"
    with app.app_context():
        audit = db.session.scalars(
            select(AuditLog)
            .where(AuditLog.entity_name == "class_sessions", AuditLog.entity_id == session_id)
            .order_by(AuditLog.id.desc())
        ).first()
        assert audit.actor_user_id == users["manager"]
        assert audit.old_data["status"] == "SCHEDULED"
        assert audit.new_data == {
            "status": "CANCELLED",
            "reason": "Trung tâm mất điện",
        }


@pytest.mark.parametrize("actor", ["lecturer", "assistant", "student"])
def test_f40_only_manager_can_cancel_session(
    app, client, users, auth_header, schedule_scope, actor
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(schedule_scope, session_date="2026-05-10")
        db.session.commit()
    response = client.post(
        cancel_url(session_id),
        headers=auth_header(users[actor]),
        json={"reason": "x"},
    )
    assert response.status_code == 403


def test_f40_requires_auth_before_validation(client):
    assert client.post(cancel_url(999999), json={}).status_code == 401


@pytest.mark.parametrize(
    ("payload", "field"),
    [({}, "reason"), ({"reason": "   "}, "reason"), ({"reason": "x" * 256}, "reason")],
)
def test_f40_validates_cancellation_reason(
    app, client, users, auth_header, schedule_scope, payload, field
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(schedule_scope, session_date="2026-05-10")
        db.session.commit()
    response = client.post(
        cancel_url(session_id),
        headers=auth_header(users["manager"]),
        json=payload,
    )
    assert response.status_code == 422
    assert field in response.get_json()["errors"]["json"]


def test_f40_does_not_create_absent_attendance(
    app, client, users, auth_header, schedule_scope
):
    create = client.post(
        exception_url(schedule_scope["class"]),
        headers=auth_header(users["manager"]),
        json=exception_payload(),
    )
    session_id = create.get_json()["id"]
    response = client.post(
        cancel_url(session_id),
        headers=auth_header(users["manager"]),
        json={"reason": "Giáo viên nghỉ đột xuất"},
    )
    assert response.status_code == 200
    with app.app_context():
        assert db.session.execute(
            text("SELECT COUNT(*) FROM attendances WHERE session_id = :session_id"),
            {"session_id": session_id},
        ).scalar_one() == 0
        assert db.session.execute(
            text("SELECT COUNT(*) FROM class_sessions WHERE id = :session_id"),
            {"session_id": session_id},
        ).scalar_one() == 1


@pytest.mark.parametrize("status", ["COMPLETED", "CANCELLED"])
def test_f40_rejects_completed_or_already_cancelled_session(
    app, client, users, auth_header, schedule_scope, status
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(
            schedule_scope, session_date="2026-05-10", status=status
        )
        db.session.commit()
    response = client.post(
        cancel_url(session_id),
        headers=auth_header(users["manager"]),
        json={"reason": "Không thể"},
    )
    assert response.status_code == 409


def test_f40_rejects_session_that_already_has_attendance(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(schedule_scope, session_date="2026-05-10")
        db.session.execute(
            text(
                """INSERT INTO attendances
                    (session_id, student_id, status, recorded_by, recorded_at)
                   VALUES (:session_id, :student_id, 'PRESENT', :recorded_by,
                           SYSDATETIMEOFFSET())"""
            ),
            {
                "session_id": session_id,
                "student_id": schedule_scope["student"],
                "recorded_by": users["manager"],
            },
        )
        db.session.commit()
    response = client.post(
        cancel_url(session_id),
        headers=auth_header(users["manager"]),
        json={"reason": "Không được mất attendance"},
    )
    assert response.status_code == 409
    with app.app_context():
        assert db.session.execute(
            text("SELECT status FROM class_sessions WHERE id = :id"), {"id": session_id}
        ).scalar_one() == "SCHEDULED"
        assert db.session.execute(
            text("SELECT COUNT(*) FROM attendances WHERE session_id = :id"),
            {"id": session_id},
        ).scalar_one() == 1


def test_f40_returns_not_found_for_missing_session(client, users, auth_header):
    response = client.post(
        cancel_url(999999),
        headers=auth_header(users["manager"]),
        json={"reason": "Không tồn tại"},
    )
    assert response.status_code == 404


def _display_row(status="SCHEDULED"):
    return {
        "id": 1,
        "class_id": 1,
        "session_date": datetime(2026, 5, 10).date(),
        "start_time": datetime.strptime("09:00", "%H:%M").time(),
        "end_time": datetime.strptime("10:30", "%H:%M").time(),
        "room_id": 1,
        "room_code": "R1",
        "room_name": "Room 1",
        "lecturer_id": 1,
        "lecturer_code": "GV01",
        "lecturer_name": "Teacher",
        "assistant_id": None,
        "assistant_code": None,
        "assistant_name": None,
        "status": status,
        "note": None,
    }


@pytest.mark.parametrize(
    ("now", "expected"),
    [
        (datetime(2026, 5, 10, 8, 59, 59), "UPCOMING"),
        (datetime(2026, 5, 10, 9, 0, 0), "ONGOING"),
        (datetime(2026, 5, 10, 10, 29, 59), "ONGOING"),
        (datetime(2026, 5, 10, 10, 30, 0), "SCHEDULED"),
    ],
)
def test_f41_computes_dynamic_display_status_at_boundaries(now, expected):
    assert _serialize_session(_display_row(), now=now)["display_status"] == expected


@pytest.mark.parametrize("status", ["COMPLETED", "CANCELLED"])
def test_f41_database_terminal_status_takes_priority(status):
    before_session = datetime(2026, 5, 10, 8, 0, 0)
    body = _serialize_session(_display_row(status), now=before_session)
    assert body["status"] == status
    assert body["display_status"] == status


def test_f41_converts_aware_time_to_vietnam_timezone():
    utc_now = datetime(2026, 5, 10, 2, 30, tzinfo=ZoneInfo("UTC"))
    assert _serialize_session(_display_row(), now=utc_now)["display_status"] == "ONGOING"


def test_f41_api_returns_database_and_display_status_separately(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(
            schedule_scope, session_date="2026-05-10", status="CANCELLED"
        )
        db.session.commit()
    response = client.get(sessions_url(session_id), headers=auth_header(users["manager"]))
    assert response.status_code == 200
    assert response.get_json()["status"] == "CANCELLED"
    assert response.get_json()["display_status"] == "CANCELLED"


def complete_url(session_id):
    return f"{sessions_url(session_id)}/complete"


def _record_attendance(session_id, student_id, recorded_by, status="PRESENT"):
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
            "recorded_by": recorded_by,
        },
    )


def test_f42_manager_completes_past_session_after_attendance_with_audit(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(schedule_scope, session_date="2026-05-10")
        _record_attendance(session_id, schedule_scope["student"], users["manager"])
        db.session.commit()
    response = client.post(
        complete_url(session_id), headers=auth_header(users["manager"])
    )
    assert response.status_code == 200
    assert response.get_json()["status"] == "COMPLETED"
    assert response.get_json()["display_status"] == "COMPLETED"
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "class_sessions",
                AuditLog.entity_id == session_id,
                AuditLog.action == "UPDATE",
            )
        )
        assert audit.actor_user_id == users["manager"]
        assert audit.old_data == {"status": "SCHEDULED"}
        assert audit.new_data == {"status": "COMPLETED"}


def test_f42_assigned_class_lecturer_can_complete_session(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(schedule_scope, session_date="2026-05-10")
        _record_attendance(session_id, schedule_scope["student"], users["lecturer"])
        db.session.commit()
    response = client.post(
        complete_url(session_id), headers=auth_header(users["lecturer"])
    )
    assert response.status_code == 200


def test_f42_session_override_lecturer_can_complete_session(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        schedule_scope["lecturer_user"] = schedule_scope["outsider"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(
            schedule_scope,
            session_date="2026-05-10",
            lecturer_id=schedule_scope["other_lecturer"],
            assistant_id=None,
        )
        _record_attendance(session_id, schedule_scope["student"], schedule_scope["outsider"])
        db.session.commit()
    response = client.post(
        complete_url(session_id), headers=auth_header(schedule_scope["outsider"])
    )
    assert response.status_code == 200


@pytest.mark.parametrize("actor", ["assistant", "student"])
def test_f42_ta_and_parent_cannot_complete_session(
    app, client, users, auth_header, schedule_scope, actor
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(schedule_scope, session_date="2026-05-10")
        db.session.commit()
    response = client.post(complete_url(session_id), headers=auth_header(users[actor]))
    assert response.status_code == 403


def test_f42_unassigned_lecturer_cannot_complete_session(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(schedule_scope, session_date="2026-05-10")
        db.session.commit()
    response = client.post(
        complete_url(session_id), headers=auth_header(schedule_scope["outsider"])
    )
    assert response.status_code == 403


def test_f42_requires_authentication(client):
    assert client.post(complete_url(999999)).status_code == 401


def test_f42_rejects_session_before_end_time(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(schedule_scope, session_date="2026-12-31")
        db.session.commit()
    response = client.post(
        complete_url(session_id), headers=auth_header(users["manager"])
    )
    assert response.status_code == 409
    assert "sau khi" in response.get_json()["message"]


def test_f42_requires_complete_attendance_and_returns_counts(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        _add_students_to_class(schedule_scope, 2)
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(schedule_scope, session_date="2026-05-10")
        _record_attendance(session_id, schedule_scope["student"], users["manager"])
        db.session.commit()
    response = client.post(
        complete_url(session_id), headers=auth_header(users["manager"])
    )
    assert response.status_code == 409
    assert response.get_json()["errors"]["attendance"] == {
        "expected": 3,
        "recorded": 1,
        "missing": 2,
    }
    with app.app_context():
        assert db.session.execute(
            text("SELECT status FROM class_sessions WHERE id = :id"), {"id": session_id}
        ).scalar_one() == "SCHEDULED"


def test_f42_empty_class_can_complete_without_attendance(
    app, client, users, auth_header, schedule_scope
):
    with app.app_context():
        empty_class = _insert_other_class(
            schedule_scope,
            code="C-F42-EMPTY",
            name="F42 Empty",
            lecturer=schedule_scope["staff_ids"][users["lecturer"]],
            assistant=schedule_scope["staff_ids"][users["assistant"]],
        )
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(
            schedule_scope, class_id=empty_class, session_date="2026-05-10"
        )
        db.session.commit()
    response = client.post(
        complete_url(session_id), headers=auth_header(users["manager"])
    )
    assert response.status_code == 200


@pytest.mark.parametrize("status", ["COMPLETED", "CANCELLED"])
def test_f42_rejects_terminal_session(
    app, client, users, auth_header, schedule_scope, status
):
    with app.app_context():
        schedule_scope["lecturer_user"] = users["lecturer"]
        schedule_scope["assistant_user"] = users["assistant"]
        session_id = _insert_session(
            schedule_scope, session_date="2026-05-10", status=status
        )
        db.session.commit()
    response = client.post(
        complete_url(session_id), headers=auth_header(users["manager"])
    )
    assert response.status_code == 409


def test_f42_returns_not_found_for_missing_session(client, users, auth_header):
    response = client.post(
        complete_url(999999), headers=auth_header(users["manager"])
    )
    assert response.status_code == 404
