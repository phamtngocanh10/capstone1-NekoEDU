import pytest
from flask_jwt_extended import decode_token
from sqlalchemy import select

from app.extensions import db
from app.models import AuditAction, AuditLog, RoleCode, User, UserStatus
from app.services.auth_service import (
    MSG_ACCOUNT_INACTIVE,
    MSG_ACCOUNT_LOCKED,
    MSG_INVALID_CREDENTIALS,
)
from tests.conftest import DEFAULT_PASSWORD

LOGIN_URL = "/api/v1/auth/login"


def login(client, username, password=DEFAULT_PASSWORD):
    return client.post(LOGIN_URL, json={"username": username, "password": password})


def get_user(app, user_id) -> User:
    with app.app_context():
        user = db.session.get(User, user_id)
        db.session.expunge(user)
        return user


def audit_logs(app) -> list[AuditLog]:
    with app.app_context():
        return list(db.session.scalars(select(AuditLog)))


# ---------- Đăng nhập thành công ----------


def test_login_with_username_returns_token_and_user(app, client, users):
    res = login(client, "mg01")

    assert res.status_code == 200
    body = res.get_json()
    assert body["token_type"] == "Bearer"
    assert body["expires_in"] == 15 * 60
    assert body["user"]["id"] == users["manager"]
    assert body["user"]["username"] == "mg01"
    assert body["user"]["role"] == {"code": "MANAGER", "name": "Quản lý trung tâm"}
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]

    with app.app_context():
        claims = decode_token(body["access_token"])
    assert claims["sub"] == str(users["manager"])
    assert claims["role"] == "MANAGER"
    assert claims["type"] == "access"


def test_login_updates_last_login_and_writes_audit_log(app, client, users):
    assert get_user(app, users["manager"]).last_login_at is None

    login(client, "mg01")

    user = get_user(app, users["manager"])
    assert user.last_login_at is not None
    # Đăng nhập không được tính là sửa hồ sơ
    assert user.updated_at == user.created_at
    [log] = audit_logs(app)
    assert log.action == AuditAction.LOGIN
    assert log.actor_user_id == users["manager"]
    assert log.entity_name == "users"
    assert log.entity_id == users["manager"]
    assert log.ip_address == "127.0.0.1"


def test_login_with_email_ignores_case_and_surrounding_spaces(client, users):
    res = login(client, "  MG01@Neko.EDU.vn  ")

    assert res.status_code == 200
    assert res.get_json()["user"]["username"] == "mg01"


def test_student_parent_without_email_can_login_by_username(client, users):
    res = login(client, "hs001")

    assert res.status_code == 200
    assert res.get_json()["user"]["role"]["code"] == RoleCode.STUDENT_PARENT
    assert res.get_json()["user"]["email"] is None


# ---------- Sai thông tin đăng nhập ----------


def test_wrong_password_and_unknown_user_return_identical_error(client, users):
    wrong_password = login(client, "mg01", "Sai@2026")
    unknown_user = login(client, "khong-ton-tai", DEFAULT_PASSWORD)
    unknown_email = login(client, "nobody@neko.edu.vn", DEFAULT_PASSWORD)

    for res in (wrong_password, unknown_user, unknown_email):
        assert res.status_code == 401
        assert res.get_json() == {
            "code": 401,
            "status": "Unauthorized",
            "message": MSG_INVALID_CREDENTIALS,
        }


def test_failed_login_does_not_update_last_login_or_audit(app, client, users):
    login(client, "mg01", "Sai@2026")

    assert get_user(app, users["manager"]).last_login_at is None
    assert audit_logs(app) == []


def test_username_is_case_sensitive(client, users):
    assert login(client, "MG01").status_code == 401


def test_password_is_case_sensitive_and_not_trimmed(client, users):
    assert login(client, "mg01", DEFAULT_PASSWORD.lower()).status_code == 401
    assert login(client, "mg01", f" {DEFAULT_PASSWORD} ").status_code == 401


def test_password_longer_than_72_bytes_is_rejected(client, create_user):
    create_user("mg09")
    # 30 ký tự nhưng 90 byte UTF-8: qua được validate độ dài, nhưng bcrypt không xử lý được
    assert login(client, "mg09", "ệ" * 30).status_code == 401


# ---------- Trạng thái tài khoản ----------


@pytest.mark.parametrize(
    ("status", "message"),
    [(UserStatus.LOCKED, MSG_ACCOUNT_LOCKED), (UserStatus.INACTIVE, MSG_ACCOUNT_INACTIVE)],
)
def test_blocked_account_with_correct_password_is_forbidden(app, client, create_user, status, message):
    user_id = create_user("gv09", RoleCode.LECTURER, status=status)

    res = login(client, "gv09")

    assert res.status_code == 403
    assert res.get_json()["message"] == message
    assert get_user(app, user_id).last_login_at is None


def test_blocked_account_with_wrong_password_does_not_reveal_status(client, create_user):
    create_user("gv09", RoleCode.LECTURER, status=UserStatus.LOCKED)

    res = login(client, "gv09", "Sai@2026")

    assert res.status_code == 401
    assert res.get_json()["message"] == MSG_INVALID_CREDENTIALS


# ---------- Validate input ----------


@pytest.mark.parametrize(
    ("payload", "error_fields"),
    [
        ({}, {"username", "password"}),
        ({"username": "mg01"}, {"password"}),
        ({"password": DEFAULT_PASSWORD}, {"username"}),
        ({"username": "   ", "password": DEFAULT_PASSWORD}, {"username"}),
        ({"username": "mg01", "password": ""}, {"password"}),
        ({"username": 123, "password": DEFAULT_PASSWORD}, {"username"}),
        ({"username": "mg01", "password": None}, {"password"}),
        ({"username": "a" * 151, "password": DEFAULT_PASSWORD}, {"username"}),
        ({"username": "mg01", "password": "a" * 73}, {"password"}),
        ({"username": "mg01", "password": DEFAULT_PASSWORD, "role": "MANAGER"}, {"role"}),
    ],
)
def test_invalid_login_payload_returns_422(client, users, payload, error_fields):
    res = client.post(LOGIN_URL, json=payload)

    assert res.status_code == 422
    body = res.get_json()
    assert body["message"] == "Dữ liệu gửi lên không hợp lệ"
    assert set(body["errors"]["json"]) == error_fields


@pytest.mark.parametrize("raw_body", ["[1, 2]", '"mg01"', "null"])
def test_login_body_must_be_json_object(client, raw_body):
    res = client.post(LOGIN_URL, data=raw_body, content_type="application/json")

    assert res.status_code == 422


def test_malformed_json_returns_400(client):
    res = client.post(LOGIN_URL, data='{"username": "mg01",', content_type="application/json")

    assert res.status_code == 400
    assert res.get_json()["message"] == "Request không hợp lệ"


def test_login_only_accepts_post(client):
    assert client.get(LOGIN_URL).status_code == 405
