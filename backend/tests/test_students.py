import pytest
from sqlalchemy import select, text

from app.extensions import db
from app.common.security import verify_password
from app.models import AuditLog, RoleCode, StaffPosition, StaffProfile, User

STUDENTS_URL = "/api/v1/students"


@pytest.fixture
def student_scope(app, users, create_staff):
    outsider_user = create_staff("gv09", StaffPosition.LECTURER, "GV09")
    with app.app_context():
        staff_ids = {
            profile.user_id: profile.id
            for profile in db.session.scalars(select(StaffProfile)).all()
        }
        guardian_1 = _insert_id(
            "INSERT INTO guardians (full_name, phone, email, relationship) OUTPUT INSERTED.id "
            "VALUES (N'Nguyễn Phụ Huynh', '0901234567', 'parent1@example.com', 'FATHER')"
        )
        guardian_2 = _insert_id(
            "INSERT INTO guardians (full_name, phone, email, relationship) OUTPUT INSERTED.id "
            "VALUES (N'Trần Người Giám Hộ', '0901234568', NULL, 'GUARDIAN')"
        )
        level_1 = _insert_id(
            "INSERT INTO levels (code, name, min_age, max_age, sort_order) OUTPUT INSERTED.id "
            "VALUES ('KID_1', 'Kid 1', 6, 7, 1)"
        )
        level_2 = _insert_id(
            "INSERT INTO levels (code, name, min_age, max_age, sort_order) OUTPUT INSERTED.id "
            "VALUES ('KID_2', 'Kid 2', 7, 8, 2)"
        )
        student_1 = _insert_student(
            "HS001", "Nguyễn Minh Anh", "Anna", guardian_1, users["student"], level_1, "ACTIVE"
        )
        student_2 = _insert_student(
            "HS002", "Nguyễn Quốc Bảo", "Ben", guardian_1, None, level_2, "ON_HOLD"
        )
        student_3 = _insert_student(
            "HS003", "Trần Gia Hân", None, guardian_2, None, level_1, "ACTIVE"
        )
        course_1 = _insert_course("C1", "Course 1", level_1)
        course_2 = _insert_course("C2", "Course 2", level_2)
        room = _insert_id(
            "INSERT INTO rooms (code, name, capacity, status) OUTPUT INSERTED.id "
            "VALUES ('R1', 'Room 1', 20, 'AVAILABLE')"
        )
        class_1 = _insert_class(
            "L1",
            "Class 1",
            course_1,
            staff_ids[users["lecturer"]],
            staff_ids[users["assistant"]],
            room,
        )
        class_2 = _insert_class(
            "L2", "Class 2", course_2, staff_ids[outsider_user], None, room
        )
        _enroll(class_1, student_1)
        _enroll(class_1, student_2)
        _enroll(class_2, student_3)
        db.session.commit()
    return {
        "students": (student_1, student_2, student_3),
        "levels": (level_1, level_2),
        "classes": (class_1, class_2),
        "outsider": outsider_user,
        "guardians": (guardian_1, guardian_2),
    }


def _insert_id(sql):
    return db.session.execute(text(sql)).scalar_one()


def _insert_student(code, full_name, english_name, guardian, user_id, level, status):
    return db.session.execute(
        text("""INSERT INTO students
            (student_code, full_name, english_name, date_of_birth, guardian_id,
             user_id, current_level_id, enrolled_at, status)
            OUTPUT INSERTED.id
            VALUES (:code, :full_name, :english_name, '2018-01-01', :guardian,
                    :user_id, :level, '2025-01-01', :status)"""),
        {
            "code": code,
            "full_name": full_name,
            "english_name": english_name,
            "guardian": guardian,
            "user_id": user_id,
            "level": level,
            "status": status,
        },
    ).scalar_one()


def _insert_course(code, name, level):
    return db.session.execute(
        text("""INSERT INTO courses
            (course_code, level_id, name, sessions_per_week, session_minutes,
             monthly_fee, status)
            OUTPUT INSERTED.id VALUES (:code, :level, :name, 2, 90, 1000000, 'ACTIVE')"""),
        {"code": code, "level": level, "name": name},
    ).scalar_one()


def _insert_class(code, name, course, lecturer, assistant, room):
    return db.session.execute(
        text("""INSERT INTO classes
            (class_code, name, course_id, lecturer_id, assistant_id,
             default_room_id, max_students, start_date, end_date, status)
            OUTPUT INSERTED.id
            VALUES (:code, :name, :course, :lecturer, :assistant,
                    :room, 20, '2026-01-01', '2026-12-31', 'ONGOING')"""),
        {
            "code": code,
            "name": name,
            "course": course,
            "lecturer": lecturer,
            "assistant": assistant,
            "room": room,
        },
    ).scalar_one()


def _enroll(class_id, student_id):
    db.session.execute(
        text("INSERT INTO class_enrollments (class_id, student_id, enrolled_date, status) "
             "VALUES (:class_id, :student_id, '2026-01-01', 'ACTIVE')"),
        {"class_id": class_id, "student_id": student_id},
    )


def get_students(client, headers, **query):
    res = client.get(STUDENTS_URL, headers=headers, query_string=query)
    assert res.status_code == 200, res.get_json()
    return res.get_json()


def codes(body):
    return [item["student_code"] for item in body["items"]]


def test_manager_sees_all_students_with_related_data(client, users, auth_header, student_scope):
    body = get_students(client, auth_header(users["manager"]))

    assert codes(body) == ["HS001", "HS002", "HS003"]
    assert body["pagination"] == {"page": 1, "page_size": 20, "total": 3, "total_pages": 1}
    assert body["items"][0]["level"] == {
        "id": student_scope["levels"][0], "code": "KID_1", "name": "Kid 1"
    }
    assert body["items"][0]["guardian"]["full_name"] == "Nguyễn Phụ Huynh"
    assert "note" not in body["items"][0]


@pytest.mark.parametrize("actor", ["lecturer", "assistant"])
def test_assigned_staff_only_see_students_in_their_classes(
    client, users, auth_header, student_scope, actor
):
    body = get_students(client, auth_header(users[actor]))
    assert codes(body) == ["HS001", "HS002"]


def test_unassigned_staff_only_sees_own_class_students(client, auth_header, student_scope):
    body = get_students(client, auth_header(student_scope["outsider"]))
    assert codes(body) == ["HS003"]


def test_student_parent_only_sees_linked_student(client, users, auth_header, student_scope):
    body = get_students(client, auth_header(users["student"]))
    assert codes(body) == ["HS001"]


def test_student_filters_work_inside_authorized_scope(client, users, auth_header, student_scope):
    manager = auth_header(users["manager"])
    assert codes(get_students(client, manager, level_id=student_scope["levels"][1])) == ["HS002"]
    assert codes(get_students(client, manager, status="ON_HOLD")) == ["HS002"]
    assert codes(get_students(client, manager, class_id=student_scope["classes"][1])) == ["HS003"]
    lecturer = auth_header(users["lecturer"])
    assert get_students(client, lecturer, class_id=student_scope["classes"][1])["items"] == []


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("hs002", ["HS002"]),
        ("minh anh", ["HS001"]),
        ("BEN", ["HS002"]),
        ("phụ huynh", ["HS001", "HS002"]),
    ],
)
def test_student_searches_all_required_fields(
    client, users, auth_header, student_scope, query, expected
):
    assert codes(get_students(client, auth_header(users["manager"]), q=query)) == expected


def test_student_search_treats_wildcards_literally(client, users, auth_header, student_scope):
    headers = auth_header(users["manager"])
    assert get_students(client, headers, q="%")["items"] == []
    assert get_students(client, headers, q="_")["items"] == []


def test_student_pagination(client, users, auth_header, student_scope):
    body = get_students(client, auth_header(users["manager"]), page=2, page_size=2)
    assert codes(body) == ["HS003"]
    assert body["pagination"] == {"page": 2, "page_size": 2, "total": 3, "total_pages": 2}


@pytest.mark.parametrize(
    ("query", "field"),
    [
        ({"page": 0}, "page"),
        ({"page_size": 101}, "page_size"),
        ({"level_id": 0}, "level_id"),
        ({"class_id": "abc"}, "class_id"),
        ({"status": "UNKNOWN"}, "status"),
        ({"q": "x" * 101}, "q"),
    ],
)
def test_student_list_validates_filters(client, users, auth_header, student_scope, query, field):
    res = client.get(STUDENTS_URL, headers=auth_header(users["manager"]), query_string=query)
    assert res.status_code == 422
    assert field in res.get_json()["errors"]["query"]


def test_student_list_requires_auth_before_filter_validation(client):
    assert client.get(f"{STUDENTS_URL}?page=bad").status_code == 401


def student_payload(scope, **overrides):
    payload = {
        "student_code": "HS010",
        "full_name": "Lê Minh Khang",
        "english_name": "Kevin",
        "date_of_birth": "2018-05-10",
        "current_level_id": scope["levels"][0],
        "enrolled_at": "2026-01-05",
        "guardian_id": scope["guardians"][0],
        "status": "ACTIVE",
        "note": "Học buổi tối",
    }
    payload.update(overrides)
    return payload


def test_manager_creates_student_with_existing_guardian(
    app, client, users, auth_header, student_scope
):
    res = client.post(
        STUDENTS_URL,
        headers=auth_header(users["manager"]),
        json=student_payload(student_scope, full_name="  Lê Minh Khang  "),
    )

    assert res.status_code == 201
    body = res.get_json()
    assert body["student_code"] == "HS010"
    assert body["full_name"] == "Lê Minh Khang"
    assert body["guardian"]["id"] == student_scope["guardians"][0]
    assert body["level"]["id"] == student_scope["levels"][0]
    assert body["note"] == "Học buổi tối"
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "students",
                AuditLog.entity_id == body["id"],
            )
        )
        assert audit.actor_user_id == users["manager"]
        assert audit.new_data["student_code"] == "HS010"


def test_create_student_can_create_guardian_in_same_transaction(
    app, client, users, auth_header, student_scope
):
    payload = student_payload(student_scope)
    payload.pop("guardian_id")
    payload["guardian"] = {
        "full_name": "  Phạm Thị Phụ Huynh  ",
        "phone": "0912345678",
        "email": " PARENT@EXAMPLE.COM ",
        "relationship": "MOTHER",
        "address": "Đà Nẵng",
    }

    res = client.post(
        STUDENTS_URL, headers=auth_header(users["manager"]), json=payload
    )

    assert res.status_code == 201
    assert res.get_json()["guardian"]["full_name"] == "Phạm Thị Phụ Huynh"
    assert res.get_json()["guardian"]["email"] == "parent@example.com"
    with app.app_context():
        actions = db.session.scalars(
            select(AuditLog.entity_name).order_by(AuditLog.id)
        ).all()
        assert actions == ["guardians", "students"]


def test_create_student_links_existing_student_parent_account(
    client, users, auth_header, student_scope, create_user
):
    user_id = create_user("hs010", RoleCode.STUDENT_PARENT, email=None)

    res = client.post(
        STUDENTS_URL,
        headers=auth_header(users["manager"]),
        json=student_payload(student_scope, user_id=user_id),
    )

    assert res.status_code == 201
    assert res.get_json()["user_id"] == user_id


def test_create_student_can_create_login_account_atomically(
    app, client, users, auth_header, student_scope
):
    payload = student_payload(
        student_scope,
        account={
            "username": "hs010",
            "email": None,
            "password": "Student@2026",
            "full_name": "Phụ huynh HS010",
            "phone": "0923456789",
        },
    )

    res = client.post(
        STUDENTS_URL, headers=auth_header(users["manager"]), json=payload
    )

    assert res.status_code == 201
    with app.app_context():
        account = db.session.scalar(select(User).where(User.username == "hs010"))
        assert account.role.code == RoleCode.STUDENT_PARENT
        assert verify_password("Student@2026", account.password_hash)
        assert res.get_json()["user_id"] == account.id
        assert db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "users", AuditLog.entity_id == account.id
            )
        ) is not None
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "hs010", "password": "Student@2026"},
    )
    assert login.status_code == 200


def test_create_student_rejects_duplicate_code_and_guardian_phone(
    client, users, auth_header, student_scope
):
    headers = auth_header(users["manager"])
    duplicate_code = client.post(
        STUDENTS_URL,
        headers=headers,
        json=student_payload(student_scope, student_code="hs001"),
    )
    payload = student_payload(student_scope)
    payload.pop("guardian_id")
    payload["guardian"] = {
        "full_name": "Người khác",
        "phone": "0901234567",
        "relationship": "GUARDIAN",
    }
    duplicate_phone = client.post(STUDENTS_URL, headers=headers, json=payload)

    assert duplicate_code.status_code == 409
    assert duplicate_phone.status_code == 409
    assert "guardian_id" in duplicate_phone.get_json()["message"]


def test_create_student_rejects_wrong_role_and_allows_one_parent_multiple_students(
    client, users, auth_header, student_scope, create_user
):
    headers = auth_header(users["manager"])
    wrong_role = client.post(
        STUDENTS_URL,
        headers=headers,
        json=student_payload(student_scope, user_id=users["lecturer"]),
    )
    linked_user = create_user("hs010", RoleCode.STUDENT_PARENT, email=None)
    first = client.post(
        STUDENTS_URL,
        headers=headers,
        json=student_payload(student_scope, user_id=linked_user),
    )
    second = client.post(
        STUDENTS_URL,
        headers=headers,
        json=student_payload(student_scope, student_code="HS011", user_id=linked_user),
    )

    assert wrong_role.status_code == 409
    assert first.status_code == 201
    assert second.status_code == 201
    assert second.get_json()["user_id"] == linked_user


@pytest.mark.parametrize(
    "overrides",
    [
        {"date_of_birth": "2999-01-01"},
        {"enrolled_at": "2017-01-01"},
        {"enrolled_at": "2999-01-01"},
    ],
)
def test_create_student_validates_business_dates(
    client, users, auth_header, student_scope, overrides
):
    res = client.post(
        STUDENTS_URL,
        headers=auth_header(users["manager"]),
        json=student_payload(student_scope, **overrides),
    )
    assert res.status_code == 400


def test_create_student_requires_exactly_one_guardian_and_account_choice(
    client, users, auth_header, student_scope
):
    headers = auth_header(users["manager"])
    neither = student_payload(student_scope)
    neither.pop("guardian_id")
    both = student_payload(
        student_scope,
        guardian={
            "full_name": "P", "phone": "0934567890", "relationship": "FATHER"
        },
    )
    account_both = student_payload(
        student_scope,
        user_id=users["student"],
        account={
            "username": "hs010", "password": "Student@2026", "full_name": "P"
        },
    )

    assert client.post(STUDENTS_URL, headers=headers, json=neither).status_code == 422
    assert client.post(STUDENTS_URL, headers=headers, json=both).status_code == 422
    assert client.post(STUDENTS_URL, headers=headers, json=account_both).status_code == 422


def test_create_student_handles_missing_references(client, users, auth_header, student_scope):
    headers = auth_header(users["manager"])
    assert client.post(
        STUDENTS_URL,
        headers=headers,
        json=student_payload(student_scope, current_level_id=999999),
    ).status_code == 404
    assert client.post(
        STUDENTS_URL,
        headers=headers,
        json=student_payload(student_scope, guardian_id=999999),
    ).status_code == 404
    assert client.post(
        STUDENTS_URL,
        headers=headers,
        json=student_payload(student_scope, user_id=999999),
    ).status_code == 404


def test_create_student_is_manager_only_before_validation(client, users, auth_header):
    assert client.post(STUDENTS_URL, json={}).status_code == 401
    assert client.post(
        STUDENTS_URL, headers=auth_header(users["lecturer"]), json={}
    ).status_code == 403


def test_student_detail_respects_manager_staff_and_owner_scope(
    client, users, auth_header, student_scope
):
    student_1, student_2, student_3 = student_scope["students"]
    assert client.get(
        f"{STUDENTS_URL}/{student_3}", headers=auth_header(users["manager"])
    ).status_code == 200
    assert client.get(
        f"{STUDENTS_URL}/{student_1}", headers=auth_header(users["lecturer"])
    ).status_code == 200
    assert client.get(
        f"{STUDENTS_URL}/{student_2}", headers=auth_header(users["assistant"])
    ).status_code == 200
    assert client.get(
        f"{STUDENTS_URL}/{student_3}", headers=auth_header(users["lecturer"])
    ).status_code == 403
    owner = client.get(
        f"{STUDENTS_URL}/{student_1}", headers=auth_header(users["student"])
    )
    assert owner.status_code == 200
    assert owner.get_json()["note"] is None
    assert client.get(
        f"{STUDENTS_URL}/{student_2}", headers=auth_header(users["student"])
    ).status_code == 403


def test_student_detail_requires_auth_and_handles_unknown(client, users, auth_header):
    assert client.get(f"{STUDENTS_URL}/999999").status_code == 401
    assert client.get(
        f"{STUDENTS_URL}/999999", headers=auth_header(users["manager"])
    ).status_code == 404


def test_manager_updates_student_administrative_fields_with_audit(
    app, client, users, auth_header, student_scope
):
    student_id = student_scope["students"][0]
    res = client.patch(
        f"{STUDENTS_URL}/{student_id}",
        headers=auth_header(users["manager"]),
        json={
            "student_code": "HS099",
            "full_name": "  Nguyễn Minh Anh Mới  ",
            "english_name": None,
            "date_of_birth": "2018-02-02",
            "enrolled_at": "2025-02-01",
            "guardian_id": student_scope["guardians"][1],
            "status": "ON_HOLD",
            "note": "  Tạm nghỉ  ",
        },
    )

    assert res.status_code == 200
    body = res.get_json()
    assert body["student_code"] == "HS099"
    assert body["full_name"] == "Nguyễn Minh Anh Mới"
    assert body["english_name"] is None
    assert body["guardian"]["id"] == student_scope["guardians"][1]
    assert body["status"] == "ON_HOLD"
    assert body["note"] == "Tạm nghỉ"
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "students",
                AuditLog.entity_id == student_id,
                AuditLog.action == "UPDATE",
            )
        )
        assert audit.old_data["student_code"] == "HS001"
        assert audit.new_data["student_code"] == "HS099"
        assert audit.old_data["guardian_id"] == student_scope["guardians"][0]


def test_update_student_rejects_duplicate_code_missing_guardian_and_invalid_dates(
    client, users, auth_header, student_scope
):
    url = f"{STUDENTS_URL}/{student_scope['students'][0]}"
    headers = auth_header(users["manager"])
    assert client.patch(url, headers=headers, json={"student_code": "hs002"}).status_code == 409
    assert client.patch(url, headers=headers, json={"guardian_id": 999999}).status_code == 404
    assert client.patch(url, headers=headers, json={"date_of_birth": "2025-01-02"}).status_code == 400
    assert client.patch(url, headers=headers, json={"enrolled_at": "2999-01-01"}).status_code == 400


def test_update_student_forbids_level_and_account_changes(
    client, users, auth_header, student_scope
):
    url = f"{STUDENTS_URL}/{student_scope['students'][0]}"
    headers = auth_header(users["manager"])
    for payload in (
        {"current_level_id": student_scope["levels"][1]},
        {"user_id": users["student"]},
        {"guardian": {"full_name": "P"}},
    ):
        assert client.patch(url, headers=headers, json=payload).status_code == 422


def test_update_student_empty_and_same_value_are_safe(
    app, client, users, auth_header, student_scope
):
    url = f"{STUDENTS_URL}/{student_scope['students'][0]}"
    headers = auth_header(users["manager"])
    assert client.patch(url, headers=headers, json={}).status_code == 422
    assert client.patch(url, headers=headers, json={"full_name": "Nguyễn Minh Anh"}).status_code == 200
    with app.app_context():
        assert db.session.scalar(select(AuditLog)) is None


def test_update_student_is_manager_only_before_validation_and_handles_unknown(
    client, users, auth_header, student_scope
):
    url = f"{STUDENTS_URL}/{student_scope['students'][0]}"
    assert client.patch(url, json={}).status_code == 401
    assert client.patch(url, headers=auth_header(users["lecturer"]), json={}).status_code == 403
    assert client.patch(
        f"{STUDENTS_URL}/999999",
        headers=auth_header(users["manager"]),
        json={"status": "ON_HOLD"},
    ).status_code == 404
