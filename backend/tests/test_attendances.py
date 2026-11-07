import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, text

from app.extensions import db
from app.models import AuditLog, RoleCode, StaffPosition, StaffProfile


@pytest.fixture
def attendance_scope(app, users, create_staff, create_user):
    override_user = create_staff("gv_att_override", StaffPosition.LECTURER, "GV-ATT-OVR")
    outsider_user = create_staff("gv_att_out", StaffPosition.LECTURER, "GV-ATT-OUT")
    unlinked_parent = create_user("parent_att_other", RoleCode.STUDENT_PARENT, email=None)
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
                   VALUES ('C-ATT', :level_id, 'Attendance Course', 2, 90,
                           1000000, 'ACTIVE')"""
            ),
            {"level_id": level_id},
        ).scalar_one()
        db.session.execute(
            text(
                "INSERT INTO rooms (code, name, capacity, status) "
                "VALUES ('R-ATT-D', 'Dummy', 1, 'AVAILABLE')"
            )
        )
        room_id = db.session.execute(
            text(
                "INSERT INTO rooms (code, name, capacity, status) OUTPUT INSERTED.id "
                "VALUES ('R-ATT', 'Attendance Room', 20, 'AVAILABLE')"
            )
        ).scalar_one()
        class_id = db.session.execute(
            text(
                """INSERT INTO classes
                    (class_code, name, course_id, lecturer_id, assistant_id,
                     default_room_id, max_students, start_date, end_date, status)
                   OUTPUT INSERTED.id
                   VALUES ('CLS-ATT', 'Attendance Class', :course_id, :lecturer_id,
                           :assistant_id, :room_id, 20, '2026-01-01', '2026-12-31',
                           'ONGOING')"""
            ),
            {
                "course_id": course_id,
                "lecturer_id": staff_ids[users["lecturer"]],
                "assistant_id": staff_ids[users["assistant"]],
                "room_id": room_id,
            },
        ).scalar_one()
        guardians = []
        for index in range(4):
            guardians.append(
                db.session.execute(
                    text(
                        "INSERT INTO guardians (full_name, phone, relationship) "
                        "OUTPUT INSERTED.id VALUES (:name, :phone, 'GUARDIAN')"
                    ),
                    {"name": f"Guardian ATT {index}", "phone": f"0920{index:06d}"},
                ).scalar_one()
            )
        _insert_student("HA000", "Học sinh Dummy", guardians[0], level_id)
        student_1 = _insert_student(
            "HA001", "Học sinh Một", guardians[0], level_id, users["student"]
        )
        student_2 = _insert_student("HA002", "Học sinh Hai", guardians[1], level_id)
        past_student = _insert_student("HA003", "Học sinh Cũ", guardians[2], level_id)
        future_student = _insert_student("HA004", "Học sinh Tương lai", guardians[3], level_id)
        _enroll(class_id, student_1, "2026-01-01", None, "ACTIVE")
        _enroll(class_id, student_2, "2026-01-01", None, "ACTIVE")
        _enroll(class_id, past_student, "2026-01-01", "2026-01-14", "DROPPED")
        _enroll(class_id, future_student, "2026-01-16", None, "ACTIVE")
        session_id = _insert_session(
            class_id,
            room_id,
            staff_ids[override_user],
            staff_ids[users["assistant"]],
            "2026-01-15",
        )
        attendance_id = db.session.execute(
            text(
                """INSERT INTO attendances
                    (session_id, student_id, status, recorded_by, recorded_at, note)
                   OUTPUT INSERTED.id
                   VALUES (:session_id, :student_id, 'PRESENT', :recorded_by,
                           SYSDATETIMEOFFSET(), N'Đúng giờ')"""
            ),
            {
                "session_id": session_id,
                "student_id": student_1,
                "recorded_by": users["manager"],
            },
        ).scalar_one()
        db.session.commit()
    return {
        "session": session_id,
        "class": class_id,
        "room": room_id,
        "students": (student_1, student_2, past_student, future_student),
        "attendance": attendance_id,
        "override_user": override_user,
        "outsider_user": outsider_user,
        "unlinked_parent": unlinked_parent,
        "staff_ids": staff_ids,
        "level": level_id,
    }


def _insert_student(code, name, guardian_id, level_id, user_id=None):
    return db.session.execute(
        text(
            """INSERT INTO students
                (student_code, full_name, date_of_birth, guardian_id, user_id,
                 current_level_id, enrolled_at, status)
               OUTPUT INSERTED.id
               VALUES (:code, :name, '2018-01-01', :guardian_id, :user_id,
                       :level_id, '2025-01-01', 'ACTIVE')"""
        ),
        {
            "code": code,
            "name": name,
            "guardian_id": guardian_id,
            "user_id": user_id,
            "level_id": level_id,
        },
    ).scalar_one()


def _enroll(class_id, student_id, enrolled_date, left_date, status):
    db.session.execute(
        text(
            """INSERT INTO class_enrollments
                (class_id, student_id, enrolled_date, left_date, status)
               VALUES (:class_id, :student_id, :enrolled_date, :left_date, :status)"""
        ),
        {
            "class_id": class_id,
            "student_id": student_id,
            "enrolled_date": enrolled_date,
            "left_date": left_date,
            "status": status,
        },
    )


def _insert_session(class_id, room_id, lecturer_id, assistant_id, session_date, status="SCHEDULED"):
    return db.session.execute(
        text(
            """INSERT INTO class_sessions
                (class_id, session_date, start_time, end_time, room_id,
                 lecturer_id, assistant_id, status)
               OUTPUT INSERTED.id
               VALUES (:class_id, :session_date, '18:00:00', '19:30:00',
                       :room_id, :lecturer_id, :assistant_id, :status)"""
        ),
        {
            "class_id": class_id,
            "session_date": session_date,
            "room_id": room_id,
            "lecturer_id": lecturer_id,
            "assistant_id": assistant_id,
            "status": status,
        },
    ).scalar_one()


def attendance_url(session_id):
    return f"/api/v1/sessions/{session_id}/attendances"


def test_f43_manager_gets_effective_roster_with_nullable_attendance(
    client, users, auth_header, attendance_scope
):
    response = client.get(
        attendance_url(attendance_scope["session"]),
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["session_id"] == attendance_scope["session"]
    assert body["session_date"] == "2026-01-15"
    assert [item["student"]["student_code"] for item in body["items"]] == [
        "HA001",
        "HA002",
    ]
    assert body["items"][0]["attendance"] == {
        "id": attendance_scope["attendance"],
        "status": "PRESENT",
        "note": "Đúng giờ",
        "recorded_by": users["manager"],
        "recorded_at": body["items"][0]["attendance"]["recorded_at"],
    }
    assert body["items"][1]["attendance"] is None


@pytest.mark.parametrize("actor", ["manager", "lecturer", "assistant"])
def test_f43_manager_and_class_staff_can_view_full_roster(
    client, users, auth_header, attendance_scope, actor
):
    response = client.get(
        attendance_url(attendance_scope["session"]), headers=auth_header(users[actor])
    )
    assert response.status_code == 200
    assert len(response.get_json()["items"]) == 2


def test_f43_session_override_lecturer_can_view_full_roster(
    client, auth_header, attendance_scope
):
    response = client.get(
        attendance_url(attendance_scope["session"]),
        headers=auth_header(attendance_scope["override_user"]),
    )
    assert response.status_code == 200
    assert len(response.get_json()["items"]) == 2


def test_f43_parent_sees_only_linked_student(client, users, auth_header, attendance_scope):
    response = client.get(
        attendance_url(attendance_scope["session"]),
        headers=auth_header(users["student"]),
    )
    assert response.status_code == 200
    assert [item["student"]["id"] for item in response.get_json()["items"]] == [
        attendance_scope["students"][0]
    ]


def test_f43_denies_unassigned_staff_and_unlinked_parent(
    client, auth_header, attendance_scope
):
    assert client.get(
        attendance_url(attendance_scope["session"]),
        headers=auth_header(attendance_scope["outsider_user"]),
    ).status_code == 403
    assert client.get(
        attendance_url(attendance_scope["session"]),
        headers=auth_header(attendance_scope["unlinked_parent"]),
    ).status_code == 403


def test_f43_requires_authentication(client, attendance_scope):
    assert client.get(attendance_url(attendance_scope["session"])).status_code == 401


def test_f43_returns_not_found_for_missing_session(client, users, auth_header):
    assert client.get(
        attendance_url(999999), headers=auth_header(users["manager"])
    ).status_code == 404


def test_f43_can_read_cancelled_session_roster(
    app, client, users, auth_header, attendance_scope
):
    with app.app_context():
        db.session.execute(
            text("UPDATE class_sessions SET status = 'CANCELLED' WHERE id = :id"),
            {"id": attendance_scope["session"]},
        )
        db.session.commit()
    response = client.get(
        attendance_url(attendance_scope["session"]),
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    assert response.get_json()["session_status"] == "CANCELLED"


def bulk_payload(*items):
    return {"items": list(items)}


def attendance_item(student_id, status="PRESENT", note=None):
    item = {"student_id": student_id, "status": status}
    if note is not None:
        item["note"] = note
    return item


def _new_scope_session(scope, *, session_date="2026-02-15", status="SCHEDULED"):
    return _insert_session(
        scope["class"],
        scope["room"],
        scope["staff_ids"][scope["lecturer_user"]],
        scope["staff_ids"][scope["assistant_user"]],
        session_date,
        status,
    )


def test_f44_manager_records_bulk_attendance_atomically_with_audit(
    app, client, users, auth_header, attendance_scope
):
    with app.app_context():
        attendance_scope["lecturer_user"] = users["lecturer"]
        attendance_scope["assistant_user"] = users["assistant"]
        session_id = _new_scope_session(attendance_scope)
        db.session.commit()
    response = client.put(
        attendance_url(session_id),
        headers=auth_header(users["manager"]),
        json=bulk_payload(
            attendance_item(attendance_scope["students"][0], "PRESENT", "  Đúng giờ  "),
            attendance_item(
                attendance_scope["students"][1], "EXCUSED_ABSENCE", "Có đơn xin nghỉ"
            ),
        ),
    )
    assert response.status_code == 200
    items = response.get_json()["items"]
    recorded = {
        item["student"]["id"]: item["attendance"]
        for item in items
        if item["attendance"] is not None
    }
    assert recorded[attendance_scope["students"][0]]["status"] == "PRESENT"
    assert recorded[attendance_scope["students"][1]]["status"] == "EXCUSED_ABSENCE"
    assert recorded[attendance_scope["students"][0]]["note"] == "Đúng giờ"
    assert all(item["recorded_by"] == users["manager"] for item in recorded.values())
    with app.app_context():
        audits = db.session.scalars(
            select(AuditLog).where(AuditLog.entity_name == "attendances")
        ).all()
        assert len(audits) == 2
        assert {audit.new_data["student_id"] for audit in audits} == set(
            attendance_scope["students"][:2]
        )


@pytest.mark.parametrize("actor", ["manager", "lecturer", "assistant"])
def test_f44_manager_and_assigned_class_staff_can_record(
    app, client, users, auth_header, attendance_scope, actor
):
    with app.app_context():
        attendance_scope["lecturer_user"] = users["lecturer"]
        attendance_scope["assistant_user"] = users["assistant"]
        session_id = _new_scope_session(attendance_scope)
        db.session.commit()
    response = client.put(
        attendance_url(session_id),
        headers=auth_header(users[actor]),
        json=bulk_payload(attendance_item(attendance_scope["students"][1])),
    )
    assert response.status_code == 200


def test_f44_session_override_staff_can_record(
    app, client, users, auth_header, attendance_scope
):
    with app.app_context():
        session_id = _insert_session(
            attendance_scope["class"],
            attendance_scope["room"],
            attendance_scope["staff_ids"][attendance_scope["override_user"]],
            attendance_scope["staff_ids"][users["assistant"]],
            "2026-02-15",
        )
        db.session.commit()
    response = client.put(
        attendance_url(session_id),
        headers=auth_header(attendance_scope["override_user"]),
        json=bulk_payload(attendance_item(attendance_scope["students"][1])),
    )
    assert response.status_code == 200


def test_f44_unassigned_staff_and_parent_cannot_record(
    app, client, users, auth_header, attendance_scope
):
    with app.app_context():
        attendance_scope["lecturer_user"] = users["lecturer"]
        attendance_scope["assistant_user"] = users["assistant"]
        session_id = _new_scope_session(attendance_scope)
        db.session.commit()
    payload = bulk_payload(attendance_item(attendance_scope["students"][1]))
    assert client.put(
        attendance_url(session_id),
        headers=auth_header(attendance_scope["outsider_user"]),
        json=payload,
    ).status_code == 403
    assert client.put(
        attendance_url(session_id), headers=auth_header(users["student"]), json=payload
    ).status_code == 403


def test_f44_requires_auth_before_payload_validation(client, attendance_scope):
    assert client.put(attendance_url(attendance_scope["session"]), json={}).status_code == 401


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({}, "items"),
        ({"items": []}, "items"),
        (
            bulk_payload(
                attendance_item(1),
                attendance_item(1, "EXCUSED_ABSENCE"),
            ),
            "items",
        ),
        (bulk_payload({"student_id": "1", "status": "PRESENT"}), "student_id"),
        (bulk_payload({"student_id": 1, "status": "LATE"}), "status"),
        (bulk_payload({"student_id": 1, "status": "PRESENT", "note": "x" * 256}), "note"),
    ],
)
def test_f44_validates_bulk_payload(
    client, users, auth_header, attendance_scope, payload, field
):
    response = client.put(
        attendance_url(attendance_scope["session"]),
        headers=auth_header(users["manager"]),
        json=payload,
    )
    assert response.status_code == 422
    errors = response.get_json()["errors"]["json"]
    assert field in str(errors)


@pytest.mark.parametrize("status", ["CANCELLED", "COMPLETED"])
def test_f44_rejects_cancelled_or_completed_session(
    app, client, users, auth_header, attendance_scope, status
):
    with app.app_context():
        attendance_scope["lecturer_user"] = users["lecturer"]
        attendance_scope["assistant_user"] = users["assistant"]
        session_id = _new_scope_session(attendance_scope, status=status)
        db.session.commit()
    response = client.put(
        attendance_url(session_id),
        headers=auth_header(users["manager"]),
        json=bulk_payload(attendance_item(attendance_scope["students"][1])),
    )
    assert response.status_code == 409


def test_f44_rejects_future_session(
    app, client, users, auth_header, attendance_scope
):
    with app.app_context():
        attendance_scope["lecturer_user"] = users["lecturer"]
        attendance_scope["assistant_user"] = users["assistant"]
        session_id = _new_scope_session(attendance_scope, session_date="2026-12-31")
        db.session.commit()
    response = client.put(
        attendance_url(session_id),
        headers=auth_header(users["manager"]),
        json=bulk_payload(attendance_item(attendance_scope["students"][1])),
    )
    assert response.status_code == 409


@pytest.mark.parametrize("student_index", [2, 3])
def test_f44_rejects_student_outside_effective_roster(
    app, client, users, auth_header, attendance_scope, student_index
):
    session_id = attendance_scope["session"]
    invalid_student = attendance_scope["students"][student_index]
    response = client.put(
        attendance_url(session_id),
        headers=auth_header(users["manager"]),
        json=bulk_payload(attendance_item(invalid_student)),
    )
    assert response.status_code == 409
    assert response.get_json()["errors"]["student_ids"] == [invalid_student]


def test_f44_existing_attendance_rejects_entire_batch_without_partial_write(
    app, client, users, auth_header, attendance_scope
):
    response = client.put(
        attendance_url(attendance_scope["session"]),
        headers=auth_header(users["manager"]),
        json=bulk_payload(
            attendance_item(attendance_scope["students"][0]),
            attendance_item(attendance_scope["students"][1]),
        ),
    )
    assert response.status_code == 409
    assert response.get_json()["errors"]["student_ids"] == [
        attendance_scope["students"][0]
    ]
    with app.app_context():
        assert db.session.execute(
            text(
                "SELECT COUNT(*) FROM attendances "
                "WHERE session_id = :session_id AND student_id = :student_id"
            ),
            {
                "session_id": attendance_scope["session"],
                "student_id": attendance_scope["students"][1],
            },
        ).scalar_one() == 0


def test_f44_returns_not_found_for_missing_session(client, users, auth_header):
    response = client.put(
        attendance_url(999999),
        headers=auth_header(users["manager"]),
        json=bulk_payload(attendance_item(1)),
    )
    assert response.status_code == 404


@pytest.mark.parametrize(
    "status",
    ["PRESENT", "EXCUSED_ABSENCE", "UNEXCUSED_ABSENCE"],
)
def test_f45_accepts_exactly_the_three_business_statuses(
    app, client, users, auth_header, attendance_scope, status
):
    with app.app_context():
        attendance_scope["lecturer_user"] = users["lecturer"]
        attendance_scope["assistant_user"] = users["assistant"]
        session_id = _new_scope_session(attendance_scope)
        db.session.commit()
    response = client.put(
        attendance_url(session_id),
        headers=auth_header(users["manager"]),
        json=bulk_payload(attendance_item(attendance_scope["students"][1], status)),
    )
    assert response.status_code == 200
    recorded = next(
        item["attendance"]
        for item in response.get_json()["items"]
        if item["student"]["id"] == attendance_scope["students"][1]
    )
    assert recorded["status"] == status


@pytest.mark.parametrize(
    "status",
    ["LATE", "ABSENT", "EXCUSED", "present", "UNEXCUSED", "", 1, True],
)
def test_f45_rejects_legacy_or_ambiguous_statuses(
    client, users, auth_header, attendance_scope, status
):
    response = client.put(
        attendance_url(attendance_scope["session"]),
        headers=auth_header(users["manager"]),
        json=bulk_payload({"student_id": attendance_scope["students"][1], "status": status}),
    )
    assert response.status_code == 422
    assert "status" in str(response.get_json()["errors"]["json"])


def test_f45_records_late_minutes_in_note_without_creating_late_status(
    app, client, users, auth_header, attendance_scope
):
    with app.app_context():
        attendance_scope["lecturer_user"] = users["lecturer"]
        attendance_scope["assistant_user"] = users["assistant"]
        session_id = _new_scope_session(attendance_scope)
        db.session.commit()
    response = client.put(
        attendance_url(session_id),
        headers=auth_header(users["manager"]),
        json=bulk_payload(
            attendance_item(
                attendance_scope["students"][1],
                "PRESENT",
                "Đến muộn 25 phút, đã được giáo viên xác nhận",
            )
        ),
    )
    assert response.status_code == 200
    recorded = next(
        item["attendance"]
        for item in response.get_json()["items"]
        if item["student"]["id"] == attendance_scope["students"][1]
    )
    assert recorded["status"] == "PRESENT"
    assert "25 phút" in recorded["note"]


@pytest.mark.parametrize("legacy_status", ["LATE", "ABSENT", "EXCUSED"])
def test_f45_database_constraint_rejects_legacy_status(
    app, users, attendance_scope, legacy_status
):
    with app.app_context():
        with pytest.raises(IntegrityError):
            db.session.execute(
                text(
                    """INSERT INTO attendances
                        (session_id, student_id, status, recorded_by, recorded_at)
                       VALUES (:session_id, :student_id, :status, :recorded_by,
                               SYSDATETIMEOFFSET())"""
                ),
                {
                    "session_id": attendance_scope["session"],
                    "student_id": attendance_scope["students"][1],
                    "status": legacy_status,
                    "recorded_by": users["manager"],
                },
            )
            db.session.flush()
        db.session.rollback()


def attendance_record_url(attendance_id):
    return f"/api/v1/attendances/{attendance_id}"


def test_f46_manager_updates_attendance_with_history_and_audit_in_one_transaction(
    app, client, users, auth_header, attendance_scope
):
    response = client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=auth_header(users["manager"]),
        json={
            "status": "EXCUSED_ABSENCE",
            "note": "  Có xác nhận của phụ huynh  ",
            "reason": "  Bổ sung đơn xin nghỉ  ",
        },
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "EXCUSED_ABSENCE"
    assert body["note"] == "Có xác nhận của phụ huynh"
    assert body["recorded_by"] == users["manager"]
    with app.app_context():
        history = db.session.execute(
            text(
                """SELECT old_status, new_status, old_note, new_note,
                          changed_by, reason
                   FROM attendance_histories WHERE attendance_id = :id"""
            ),
            {"id": attendance_scope["attendance"]},
        ).mappings().one()
        audit = db.session.scalars(
            select(AuditLog).where(
                AuditLog.entity_name == "attendances",
                AuditLog.entity_id == attendance_scope["attendance"],
                AuditLog.action == "UPDATE",
            )
        ).one()
    assert dict(history) == {
        "old_status": "PRESENT",
        "new_status": "EXCUSED_ABSENCE",
        "old_note": "Đúng giờ",
        "new_note": "Có xác nhận của phụ huynh",
        "changed_by": users["manager"],
        "reason": "Bổ sung đơn xin nghỉ",
    }
    assert audit.old_data == {"status": "PRESENT", "note": "Đúng giờ"}
    assert audit.new_data["reason"] == "Bổ sung đơn xin nghỉ"


@pytest.mark.parametrize("actor", ["manager", "lecturer", "assistant"])
def test_f46_manager_and_assigned_class_staff_can_update(
    client, users, auth_header, attendance_scope, actor
):
    response = client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=auth_header(users[actor]),
        json={"note": f"Sửa bởi {actor}", "reason": "Điều chỉnh ghi chú"},
    )
    assert response.status_code == 200


def test_f46_session_override_lecturer_can_update(
    client, auth_header, attendance_scope
):
    response = client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=auth_header(attendance_scope["override_user"]),
        json={"note": "GV buổi sửa", "reason": "GV phụ trách buổi xác nhận"},
    )
    assert response.status_code == 200


def test_f46_unassigned_staff_and_parent_cannot_update(
    client, users, auth_header, attendance_scope
):
    payload = {"note": "Không được", "reason": "Không có quyền"}
    assert client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=auth_header(attendance_scope["outsider_user"]),
        json=payload,
    ).status_code == 403
    assert client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=auth_header(users["student"]),
        json=payload,
    ).status_code == 403


def test_f46_requires_auth_before_validation(client, attendance_scope):
    assert client.patch(
        attendance_record_url(attendance_scope["attendance"]), json={}
    ).status_code == 401


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"status": "PRESENT"}, "reason"),
        ({"status": "PRESENT", "reason": "   "}, "reason"),
        ({"reason": "Có reason nhưng không có thay đổi"}, "status"),
        ({"status": "LATE", "reason": "Sai status"}, "status"),
        ({"note": "x" * 256, "reason": "Quá dài"}, "note"),
        ({"note": "x", "reason": "x" * 501}, "reason"),
    ],
)
def test_f46_validates_update_payload(
    client, users, auth_header, attendance_scope, payload, field
):
    response = client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=auth_header(users["manager"]),
        json=payload,
    )
    assert response.status_code == 422
    assert field in str(response.get_json()["errors"]["json"])


def test_f46_rejects_noop_without_creating_history(
    app, client, users, auth_header, attendance_scope
):
    response = client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=auth_header(users["manager"]),
        json={"status": "PRESENT", "note": "Đúng giờ", "reason": "Không đổi"},
    )
    assert response.status_code == 409
    with app.app_context():
        assert db.session.execute(
            text("SELECT COUNT(*) FROM attendance_histories WHERE attendance_id = :id"),
            {"id": attendance_scope["attendance"]},
        ).scalar_one() == 0


def test_f46_can_update_completed_session_attendance(
    app, client, users, auth_header, attendance_scope
):
    with app.app_context():
        db.session.execute(
            text("UPDATE class_sessions SET status = 'COMPLETED' WHERE id = :id"),
            {"id": attendance_scope["session"]},
        )
        db.session.commit()
    response = client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=auth_header(users["manager"]),
        json={"status": "UNEXCUSED_ABSENCE", "reason": "Đối soát sau buổi"},
    )
    assert response.status_code == 200


def test_f46_rejects_cancelled_session_attendance(
    app, client, users, auth_header, attendance_scope
):
    with app.app_context():
        db.session.execute(
            text("UPDATE class_sessions SET status = 'CANCELLED' WHERE id = :id"),
            {"id": attendance_scope["session"]},
        )
        db.session.commit()
    response = client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=auth_header(users["manager"]),
        json={"note": "Không được sửa", "reason": "Buổi đã hủy"},
    )
    assert response.status_code == 409


def test_f46_returns_not_found_for_missing_attendance(client, users, auth_header):
    response = client.patch(
        attendance_record_url(999999),
        headers=auth_header(users["manager"]),
        json={"note": "x", "reason": "Không tồn tại"},
    )
    assert response.status_code == 404


def attendance_history_url(attendance_id):
    return f"{attendance_record_url(attendance_id)}/history"


def _create_attendance_changes(client, users, auth_header, attendance_id):
    first = client.patch(
        attendance_record_url(attendance_id),
        headers=auth_header(users["manager"]),
        json={
            "status": "EXCUSED_ABSENCE",
            "note": "Có phép",
            "reason": "Phụ huynh bổ sung đơn",
        },
    )
    assert first.status_code == 200
    second = client.patch(
        attendance_record_url(attendance_id),
        headers=auth_header(users["lecturer"]),
        json={
            "status": "PRESENT",
            "note": "Có mặt muộn 10 phút",
            "reason": "Đối soát camera lớp",
        },
    )
    assert second.status_code == 200


def test_f47_manager_reads_complete_ordered_immutable_history(
    app, client, users, auth_header, attendance_scope
):
    attendance_id = attendance_scope["attendance"]
    _create_attendance_changes(client, users, auth_header, attendance_id)

    response = client.get(
        attendance_history_url(attendance_id),
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["attendance_id"] == attendance_id
    assert body["session_id"] == attendance_scope["session"]
    assert body["student_id"] == attendance_scope["students"][0]
    assert body["current_status"] == "PRESENT"
    assert body["current_note"] == "Có mặt muộn 10 phút"
    assert [item["reason"] for item in body["items"]] == [
        "Phụ huynh bổ sung đơn",
        "Đối soát camera lớp",
    ]
    assert body["items"][0]["old_status"] == "PRESENT"
    assert body["items"][0]["new_status"] == "EXCUSED_ABSENCE"
    assert body["items"][1]["old_status"] == "EXCUSED_ABSENCE"
    assert body["items"][1]["new_status"] == "PRESENT"
    assert body["items"][0]["changed_by"]["id"] == users["manager"]
    assert body["items"][1]["changed_by"]["id"] == users["lecturer"]

    with app.app_context():
        stored = db.session.execute(
            text(
                "SELECT old_status, new_status, reason FROM attendance_histories "
                "WHERE attendance_id = :id ORDER BY changed_at, id"
            ),
            {"id": attendance_id},
        ).mappings().all()
    assert [dict(row) for row in stored] == [
        {
            "old_status": "PRESENT",
            "new_status": "EXCUSED_ABSENCE",
            "reason": "Phụ huynh bổ sung đơn",
        },
        {
            "old_status": "EXCUSED_ABSENCE",
            "new_status": "PRESENT",
            "reason": "Đối soát camera lớp",
        },
    ]


@pytest.mark.parametrize("actor", ["manager", "lecturer", "assistant"])
def test_f47_manager_and_assigned_class_staff_can_view_history(
    client, users, auth_header, attendance_scope, actor
):
    response = client.get(
        attendance_history_url(attendance_scope["attendance"]),
        headers=auth_header(users[actor]),
    )
    assert response.status_code == 200
    assert response.get_json()["items"] == []


def test_f47_session_override_staff_can_view_history(
    client, auth_header, attendance_scope
):
    response = client.get(
        attendance_history_url(attendance_scope["attendance"]),
        headers=auth_header(attendance_scope["override_user"]),
    )
    assert response.status_code == 200


def test_f47_linked_parent_can_view_own_student_history(
    client, users, auth_header, attendance_scope
):
    response = client.get(
        attendance_history_url(attendance_scope["attendance"]),
        headers=auth_header(users["student"]),
    )
    assert response.status_code == 200
    assert response.get_json()["student_id"] == attendance_scope["students"][0]


def test_f47_denies_unassigned_staff_and_unlinked_parent(
    client, auth_header, attendance_scope
):
    url = attendance_history_url(attendance_scope["attendance"])
    assert client.get(
        url, headers=auth_header(attendance_scope["outsider_user"])
    ).status_code == 403
    assert client.get(
        url, headers=auth_header(attendance_scope["unlinked_parent"])
    ).status_code == 403


def test_f47_requires_authentication(client, attendance_scope):
    assert client.get(
        attendance_history_url(attendance_scope["attendance"])
    ).status_code == 401


def test_f47_returns_not_found_for_missing_attendance(client, users, auth_header):
    assert client.get(
        attendance_history_url(999999), headers=auth_header(users["manager"])
    ).status_code == 404


def test_f48_unassigned_staff_cannot_read_create_or_update_attendance(
    client, auth_header, attendance_scope
):
    outsider_headers = auth_header(attendance_scope["outsider_user"])
    assert client.get(
        attendance_url(attendance_scope["session"]), headers=outsider_headers
    ).status_code == 403
    assert client.put(
        attendance_url(attendance_scope["session"]),
        headers=outsider_headers,
        json=bulk_payload(attendance_item(attendance_scope["students"][1])),
    ).status_code == 403
    assert client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=outsider_headers,
        json={"note": "Không được phép", "reason": "Ngoài lớp phụ trách"},
    ).status_code == 403


def test_f48_parent_is_read_only_and_limited_to_linked_student(
    client, users, auth_header, attendance_scope
):
    parent_headers = auth_header(users["student"])
    roster = client.get(
        attendance_url(attendance_scope["session"]), headers=parent_headers
    )
    assert roster.status_code == 200
    assert [item["student"]["id"] for item in roster.get_json()["items"]] == [
        attendance_scope["students"][0]
    ]
    assert client.get(
        attendance_history_url(attendance_scope["attendance"]), headers=parent_headers
    ).status_code == 200
    assert client.put(
        attendance_url(attendance_scope["session"]),
        headers=parent_headers,
        json=bulk_payload(attendance_item(attendance_scope["students"][1])),
    ).status_code == 403
    assert client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=parent_headers,
        json={"note": "Không được phép", "reason": "Phụ huynh chỉ được xem"},
    ).status_code == 403


def test_f49_status_change_queues_one_transactional_tuition_recalculation(
    app, client, users, auth_header, attendance_scope
):
    response = client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=auth_header(users["manager"]),
        json={
            "status": "UNEXCUSED_ABSENCE",
            "reason": "Đối soát trạng thái để tính lại học phí",
        },
    )
    assert response.status_code == 200
    with app.app_context():
        request_row = db.session.execute(
            text(
                """SELECT r.attendance_id, r.session_id, r.student_id,
                          r.requested_by, r.status, r.processed_at,
                          h.old_status, h.new_status
                   FROM tuition_recalculation_requests r
                   JOIN attendance_histories h ON h.id = r.attendance_history_id
                   WHERE r.attendance_id = :attendance_id"""
            ),
            {"attendance_id": attendance_scope["attendance"]},
        ).mappings().one()
    assert dict(request_row) == {
        "attendance_id": attendance_scope["attendance"],
        "session_id": attendance_scope["session"],
        "student_id": attendance_scope["students"][0],
        "requested_by": users["manager"],
        "status": "PENDING",
        "processed_at": None,
        "old_status": "PRESENT",
        "new_status": "UNEXCUSED_ABSENCE",
    }


def test_f49_note_only_change_does_not_queue_credit_recalculation(
    app, client, users, auth_header, attendance_scope
):
    response = client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=auth_header(users["manager"]),
        json={"note": "Sửa chính tả", "reason": "Không đổi trạng thái có mặt/vắng"},
    )
    assert response.status_code == 200
    with app.app_context():
        assert db.session.execute(
            text("SELECT COUNT(*) FROM tuition_recalculation_requests")
        ).scalar_one() == 0
        assert db.session.execute(
            text("SELECT COUNT(*) FROM attendance_histories")
        ).scalar_one() == 1


def test_f49_recalculation_request_is_idempotent_per_history(
    app, client, users, auth_header, attendance_scope
):
    response = client.patch(
        attendance_record_url(attendance_scope["attendance"]),
        headers=auth_header(users["manager"]),
        json={"status": "EXCUSED_ABSENCE", "reason": "Có đơn xin nghỉ"},
    )
    assert response.status_code == 200
    with app.app_context():
        request_row = db.session.execute(
            text(
                "SELECT attendance_history_id, attendance_id, session_id, student_id, "
                "requested_by FROM tuition_recalculation_requests"
            )
        ).mappings().one()
        with pytest.raises(IntegrityError):
            db.session.execute(
                text(
                    """INSERT INTO tuition_recalculation_requests
                        (attendance_history_id, attendance_id, session_id, student_id,
                         requested_by, status)
                       VALUES (:attendance_history_id, :attendance_id, :session_id,
                               :student_id, :requested_by, 'PENDING')"""
                ),
                dict(request_row),
            )
            db.session.flush()
        db.session.rollback()


def attendance_report_url(**query):
    if not query:
        return "/api/v1/attendances/report"
    return "/api/v1/attendances/report?" + "&".join(
        f"{key}={value}" for key, value in query.items()
    )


def _prepare_report_data(app, users, attendance_scope):
    with app.app_context():
        lecturer_id = attendance_scope["staff_ids"][users["lecturer"]]
        assistant_id = attendance_scope["staff_ids"][users["assistant"]]
        rows = [
            ("2026-01-20", attendance_scope["students"][0], "EXCUSED_ABSENCE"),
            ("2026-01-20", attendance_scope["students"][1], "PRESENT"),
            ("2026-02-10", attendance_scope["students"][0], "UNEXCUSED_ABSENCE"),
        ]
        session_by_date = {}
        for session_date, student_id, status in rows:
            session_id = session_by_date.get(session_date)
            if session_id is None:
                session_id = _insert_session(
                    attendance_scope["class"],
                    attendance_scope["room"],
                    lecturer_id,
                    assistant_id,
                    session_date,
                )
                session_by_date[session_date] = session_id
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
        # Buổi chưa ghi attendance không được ngầm tính thành vắng.
        _insert_session(
            attendance_scope["class"],
            attendance_scope["room"],
            lecturer_id,
            assistant_id,
            "2026-02-11",
        )
        db.session.commit()


def test_f50_manager_report_counts_raw_records_and_rates_without_missing_as_absence(
    app, client, users, auth_header, attendance_scope
):
    _prepare_report_data(app, users, attendance_scope)
    response = client.get(
        attendance_report_url(), headers=auth_header(users["manager"])
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["summary"] == {
        "total_records": 4,
        "present": 2,
        "excused_absence": 1,
        "unexcused_absence": 1,
        "absence_total": 2,
        "presence_rate": 50.0,
        "absence_rate": 50.0,
    }
    assert len(body["by_classes"]) == 1
    by_student = {item["student_id"]: item for item in body["by_students"]}
    assert by_student[attendance_scope["students"][0]]["total_records"] == 3
    assert by_student[attendance_scope["students"][0]]["absence_total"] == 2
    assert by_student[attendance_scope["students"][1]]["total_records"] == 1


@pytest.mark.parametrize(
    ("query", "expected_total"),
    [
        ({"from_date": "2026-01-20"}, 3),
        ({"to_date": "2026-01-20"}, 3),
        ({"from_date": "2026-01-20", "to_date": "2026-01-20"}, 2),
    ],
)
def test_f50_filters_by_time(
    app, client, users, auth_header, attendance_scope, query, expected_total
):
    _prepare_report_data(app, users, attendance_scope)
    response = client.get(
        attendance_report_url(**query), headers=auth_header(users["manager"])
    )
    assert response.status_code == 200
    assert response.get_json()["summary"]["total_records"] == expected_total


def test_f50_filters_by_student_and_class(
    app, client, users, auth_header, attendance_scope
):
    _prepare_report_data(app, users, attendance_scope)
    response = client.get(
        attendance_report_url(
            student_id=attendance_scope["students"][0],
            class_id=attendance_scope["class"],
        ),
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["summary"]["total_records"] == 3
    assert len(body["by_students"]) == 1
    assert len(body["by_classes"]) == 1


@pytest.mark.parametrize("actor", ["lecturer", "assistant"])
def test_f50_assigned_staff_can_report_own_class(
    app, client, users, auth_header, attendance_scope, actor
):
    _prepare_report_data(app, users, attendance_scope)
    response = client.get(
        attendance_report_url(class_id=attendance_scope["class"]),
        headers=auth_header(users[actor]),
    )
    assert response.status_code == 200
    assert response.get_json()["summary"]["total_records"] == 4


def test_f50_parent_report_is_limited_to_linked_student(
    app, client, users, auth_header, attendance_scope
):
    _prepare_report_data(app, users, attendance_scope)
    response = client.get(
        attendance_report_url(), headers=auth_header(users["student"])
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["summary"]["total_records"] == 3
    assert [item["student_id"] for item in body["by_students"]] == [
        attendance_scope["students"][0]
    ]


def test_f50_denies_explicit_out_of_scope_filters(
    client, auth_header, attendance_scope
):
    assert client.get(
        attendance_report_url(class_id=attendance_scope["class"]),
        headers=auth_header(attendance_scope["outsider_user"]),
    ).status_code == 403
    assert client.get(
        attendance_report_url(student_id=attendance_scope["students"][1]),
        headers=auth_header(attendance_scope["unlinked_parent"]),
    ).status_code == 403


def test_f50_empty_report_has_zero_rates(client, users, auth_header):
    response = client.get(
        attendance_report_url(from_date="2030-01-01"),
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 200
    assert response.get_json()["summary"] == {
        "total_records": 0,
        "present": 0,
        "excused_absence": 0,
        "unexcused_absence": 0,
        "absence_total": 0,
        "presence_rate": 0.0,
        "absence_rate": 0.0,
    }


def test_f50_validates_date_range(client, users, auth_header):
    response = client.get(
        attendance_report_url(from_date="2026-02-01", to_date="2026-01-01"),
        headers=auth_header(users["manager"]),
    )
    assert response.status_code == 422
    assert "from_date" in str(response.get_json()["errors"]["query"])


def test_f50_requires_authentication(client):
    assert client.get(attendance_report_url()).status_code == 401
