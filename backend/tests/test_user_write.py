from sqlalchemy import select, text

from app.common.security import verify_password
from app.extensions import db
from app.models import AuditAction, AuditLog, RoleCode, User

USERS_URL = "/api/v1/users"


def valid_payload(**overrides):
    payload = {
        "username": "gv09",
        "email": "gv09@neko.edu.vn",
        "password": "Strong@2026",
        "full_name": "Trần Thị Thu Hà",
        "phone": "0901234567",
        "role": "LECTURER",
    }
    payload.update(overrides)
    return payload


def test_manager_creates_staff_account_with_hashed_password_and_audit(
    app, client, users, auth_header
):
    res = client.post(
        USERS_URL,
        headers=auth_header(users["manager"]),
        json=valid_payload(email="  GV09@NEKO.EDU.VN  ", full_name="  Trần Thị Thu Hà  "),
    )

    assert res.status_code == 201
    body = res.get_json()
    assert body["email"] == "gv09@neko.edu.vn"
    assert body["full_name"] == "Trần Thị Thu Hà"
    assert body["role"]["code"] == "LECTURER"
    assert body["status"] == "ACTIVE"
    assert "password" not in body and "password_hash" not in body
    with app.app_context():
        user = db.session.scalar(select(User).where(User.username == "gv09"))
        assert user.password_hash != "Strong@2026"
        assert verify_password("Strong@2026", user.password_hash)
        audit = db.session.scalar(select(AuditLog).where(AuditLog.entity_id == user.id))
        assert audit.action == AuditAction.CREATE
        assert audit.actor_user_id == users["manager"]
        assert audit.old_data is None
        assert audit.new_data["role"] == "LECTURER"
        assert "password" not in audit.new_data and "password_hash" not in audit.new_data


def test_student_account_may_be_created_without_email(client, users, auth_header):
    res = client.post(
        USERS_URL,
        headers=auth_header(users["manager"]),
        json=valid_payload(username="hs099", email=None, role="STUDENT_PARENT"),
    )

    assert res.status_code == 201
    assert res.get_json()["email"] is None


def test_staff_account_requires_email(client, users, auth_header):
    res = client.post(
        USERS_URL,
        headers=auth_header(users["manager"]),
        json=valid_payload(email=None),
    )

    assert res.status_code == 422
    assert "email" in res.get_json()["errors"]["json"]


def test_create_rejects_duplicate_username_and_case_insensitive_email(
    client, users, auth_header
):
    headers = auth_header(users["manager"])

    duplicate_username = client.post(
        USERS_URL, headers=headers, json=valid_payload(username="gv01")
    )
    duplicate_email = client.post(
        USERS_URL,
        headers=headers,
        json=valid_payload(username="gv10", email="GV01@NEKO.EDU.VN"),
    )

    assert duplicate_username.status_code == 409
    assert duplicate_username.get_json()["message"] == "Username đã tồn tại"
    assert duplicate_email.status_code == 409
    assert duplicate_email.get_json()["message"] == "Email đã tồn tại"


def test_username_uniqueness_remains_case_sensitive(client, users, auth_header):
    res = client.post(
        USERS_URL,
        headers=auth_header(users["manager"]),
        json=valid_payload(username="GV01", email="other@neko.edu.vn"),
    )

    assert res.status_code == 201


def test_create_validates_all_account_fields(client, users, auth_header):
    headers = auth_header(users["manager"])
    invalid_payloads = [
        (valid_payload(username="ab"), "username"),
        (valid_payload(username="bad name"), "username"),
        (valid_payload(email="not-an-email"), "email"),
        (valid_payload(password="short"), "password"),
        (valid_payload(password="ệ" * 30), "password"),
        (valid_payload(full_name="   "), "full_name"),
        (valid_payload(phone="123"), "phone"),
        (valid_payload(role="ADMIN"), "role"),
    ]

    for payload, field in invalid_payloads:
        res = client.post(USERS_URL, headers=headers, json=payload)
        assert res.status_code == 422, (field, res.get_json())
        assert field in res.get_json()["errors"]["json"]


def test_non_manager_cannot_create_even_with_invalid_payload(client, users, auth_header):
    assert client.post(USERS_URL, json={}).status_code == 401
    assert client.post(
        USERS_URL, headers=auth_header(users["lecturer"]), json={}
    ).status_code == 403


def test_manager_updates_account_and_writes_before_after_audit(
    app, client, users, auth_header, create_user
):
    user_id = create_user("hs099", RoleCode.STUDENT_PARENT, email=None)

    res = client.patch(
        f"{USERS_URL}/{user_id}",
        headers=auth_header(users["manager"]),
        json={
            "username": "hs100",
            "email": " HS100@EXAMPLE.COM ",
            "full_name": "  Nguyễn Minh Anh  ",
            "phone": "0912345678",
            "role": "LECTURER",
        },
    )

    assert res.status_code == 200
    body = res.get_json()
    assert body["username"] == "hs100"
    assert body["email"] == "hs100@example.com"
    assert body["role"]["code"] == "LECTURER"
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.action == AuditAction.UPDATE,
                AuditLog.entity_id == user_id,
            )
        )
        assert audit.old_data["username"] == "hs099"
        assert audit.new_data["username"] == "hs100"
        assert audit.new_data["role"] == "LECTURER"


def test_update_rejects_duplicate_identifiers(client, users, auth_header):
    headers = auth_header(users["manager"])

    assert client.patch(
        f"{USERS_URL}/{users['student']}", headers=headers, json={"username": "gv01"}
    ).status_code == 409
    assert client.patch(
        f"{USERS_URL}/{users['student']}",
        headers=headers,
        json={"email": "GV01@NEKO.EDU.VN"},
    ).status_code == 409


def test_update_staff_cannot_remove_email(client, users, auth_header):
    res = client.patch(
        f"{USERS_URL}/{users['lecturer']}",
        headers=auth_header(users["manager"]),
        json={"email": None},
    )

    assert res.status_code == 409
    assert res.get_json()["message"] == "Email là bắt buộc với tài khoản nhân sự"


def test_update_role_must_match_linked_staff_profile(client, users, auth_header):
    res = client.patch(
        f"{USERS_URL}/{users['lecturer']}",
        headers=auth_header(users["manager"]),
        json={"role": "MANAGER"},
    )

    assert res.status_code == 409
    assert "hồ sơ nhân sự" in res.get_json()["message"]


def test_update_role_must_remain_student_when_linked(app, client, users, auth_header):
    with app.app_context():
        guardian_id = db.session.execute(
            text("INSERT INTO guardians (full_name, phone, relationship) OUTPUT INSERTED.id VALUES (N'P', '0901234567', 'FATHER')")
        ).scalar_one()
        level_id = db.session.execute(
            text("INSERT INTO levels (code, name, min_age, max_age, sort_order) OUTPUT INSERTED.id VALUES ('KID_1', 'Kid 1', 6, 7, 2)")
        ).scalar_one()
        db.session.execute(
            text("""INSERT INTO students
                (student_code, full_name, date_of_birth, guardian_id, user_id,
                 current_level_id, enrolled_at, status)
                VALUES ('HS1', N'Học sinh', '2018-01-01', :guardian, :user,
                        :level, '2025-01-01', 'ACTIVE')"""),
            {"guardian": guardian_id, "user": users["student"], "level": level_id},
        )
        db.session.commit()

    res = client.patch(
        f"{USERS_URL}/{users['student']}",
        headers=auth_header(users["manager"]),
        json={"role": "LECTURER", "email": "hs001@neko.edu.vn"},
    )

    assert res.status_code == 409
    assert "liên kết học viên" in res.get_json()["message"]


def test_update_rejects_empty_body_password_status_and_unknown_user(
    client, users, auth_header
):
    headers = auth_header(users["manager"])
    assert client.patch(f"{USERS_URL}/{users['student']}", headers=headers, json={}).status_code == 422
    assert client.patch(
        f"{USERS_URL}/{users['student']}", headers=headers, json={"password": "NewPass@2026"}
    ).status_code == 422
    assert client.patch(
        f"{USERS_URL}/{users['student']}", headers=headers, json={"status": "LOCKED"}
    ).status_code == 422
    assert client.patch(f"{USERS_URL}/999999", headers=headers, json={"full_name": "X"}).status_code == 404
