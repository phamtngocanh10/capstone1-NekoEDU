"""Kiểm tra token khi gọi API cần đăng nhập (dùng GET /auth/me)."""

import base64
import json
import time
from datetime import timedelta

import jwt as pyjwt
import pytest
from sqlalchemy import delete, text, update

from app.extensions import db
from app.middlewares.auth import (
    MSG_ACCOUNT_UNAVAILABLE,
    MSG_EXPIRED_TOKEN,
    MSG_INVALID_TOKEN,
    MSG_MISSING_TOKEN,
)
from app.models import StaffProfile, User, UserStatus

ME_URL = "/api/v1/auth/me"


def make_token(app, payload: dict, secret: str | None = None) -> str:
    now = int(time.time())
    claims = {"type": "access", "fresh": False, "jti": "test", "iat": now, "nbf": now, "exp": now + 600}
    return pyjwt.encode({**claims, **payload}, secret or app.config["JWT_SECRET_KEY"], algorithm="HS256")


def assert_401(res, message):
    assert res.status_code == 401
    assert res.get_json() == {"code": 401, "status": "Unauthorized", "message": message}


def test_me_returns_current_user(client, users, auth_header):
    res = client.get(ME_URL, headers=auth_header(users["lecturer"]))

    assert res.status_code == 200
    body = res.get_json()
    assert body["id"] == users["lecturer"]
    assert body["username"] == "gv01"
    assert body["role"]["code"] == "LECTURER"
    assert body["status"] == "ACTIVE"
    assert body["profile"] | {"id": None} == {
        "type": "STAFF",
        "id": None,
        "staff_code": "GV01",
        "position": "LECTURER",
        "specialization": None,
        "hire_date": "2025-01-01",
        "status": "ACTIVE",
    }
    assert "password_hash" not in body


def test_me_returns_student_and_guardian_profile(app, client, users, auth_header):
    with app.app_context():
        guardian_id = db.session.execute(
            text(
                """INSERT INTO guardians
                   (full_name, phone, email, relationship)
                   OUTPUT INSERTED.id
                   VALUES (N'Nguyễn Văn Phụ Huynh', '0901234567',
                           'parent@example.com', 'FATHER')"""
            )
        ).scalar_one()
        level_id = db.session.execute(
            text(
                """INSERT INTO levels (code, name, min_age, max_age, sort_order)
                   OUTPUT INSERTED.id
                   VALUES ('KID_1', N'Kid 1', 6, 7, 1)"""
            )
        ).scalar_one()
        student_id = db.session.execute(
            text(
                """INSERT INTO students
                   (student_code, full_name, english_name, date_of_birth,
                    guardian_id, user_id, current_level_id, enrolled_at, status)
                   OUTPUT INSERTED.id
                   VALUES ('HS001', N'Nguyễn Minh Anh', 'Anna', '2018-05-10',
                           :guardian_id, :user_id, :level_id, '2025-06-01', 'ACTIVE')"""
            ),
            {"guardian_id": guardian_id, "user_id": users["student"], "level_id": level_id},
        ).scalar_one()
        db.session.commit()

    res = client.get(ME_URL, headers=auth_header(users["student"]))

    assert res.status_code == 200
    assert res.get_json()["profile"] == {
        "type": "STUDENT",
        "id": student_id,
        "student_code": "HS001",
        "full_name": "Nguyễn Minh Anh",
        "english_name": "Anna",
        "date_of_birth": "2018-05-10",
        "enrolled_at": "2025-06-01",
        "status": "ACTIVE",
        "level": {"id": level_id, "code": "KID_1", "name": "Kid 1"},
        "guardian": {
            "id": guardian_id,
            "full_name": "Nguyễn Văn Phụ Huynh",
            "phone": "0901234567",
            "email": "parent@example.com",
            "relationship": "FATHER",
        },
    }


def test_me_returns_null_profile_when_account_is_not_linked(client, create_user, auth_header):
    user_id = create_user("mg09")

    res = client.get(ME_URL, headers=auth_header(user_id))

    assert res.status_code == 200
    assert res.get_json()["profile"] is None


def test_login_then_call_private_api(client, users):
    login = client.post("/api/v1/auth/login", json={"username": "tg01", "password": "Neko@2026"})
    token = login.get_json()["access_token"]

    res = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    assert res.get_json()["username"] == "tg01"


def test_missing_token(client):
    assert_401(client.get(ME_URL), MSG_MISSING_TOKEN)


@pytest.mark.parametrize("header", ["Basic bWcwMTpOZWtvQDIwMjY=", "Token abc", "abc"])
def test_non_bearer_authorization_header(client, header):
    assert_401(client.get(ME_URL, headers={"Authorization": header}), MSG_MISSING_TOKEN)


@pytest.mark.parametrize("header", ["Bearer", "Bearer ", "Bearer abc", "Bearer a.b.c", "Bearer a b"])
def test_malformed_bearer_token(client, header):
    assert_401(client.get(ME_URL, headers={"Authorization": header}), MSG_INVALID_TOKEN)


def test_token_in_query_string_is_not_accepted(app, client, users):
    token = make_token(app, {"sub": str(users["manager"])})

    assert_401(client.get(f"{ME_URL}?jwt={token}"), MSG_MISSING_TOKEN)


def test_expired_token(client, users, auth_header):
    headers = auth_header(users["manager"], expires_delta=timedelta(seconds=-1))

    assert_401(client.get(ME_URL, headers=headers), MSG_EXPIRED_TOKEN)


def test_token_signed_with_another_secret(app, client, users):
    token = make_token(app, {"sub": str(users["manager"])}, secret="another-secret-key-with-at-least-32-bytes")

    assert_401(client.get(ME_URL, headers={"Authorization": f"Bearer {token}"}), MSG_INVALID_TOKEN)


def test_tampered_token_payload(app, client, users):
    # Lấy token hợp lệ của Trợ giảng, sửa payload thành user Manager nhưng giữ nguyên chữ ký
    token = make_token(app, {"sub": str(users["assistant"])})
    header, payload, signature = token.split(".")
    claims = json.loads(base64.urlsafe_b64decode(payload + "=="))
    claims["sub"] = str(users["manager"])
    forged = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()

    res = client.get(ME_URL, headers={"Authorization": f"Bearer {header}.{forged}.{signature}"})

    assert_401(res, MSG_INVALID_TOKEN)


def test_unsigned_token_alg_none(client, users):
    token = pyjwt.encode({"sub": str(users["manager"]), "type": "access"}, key=None, algorithm="none")

    assert_401(client.get(ME_URL, headers={"Authorization": f"Bearer {token}"}), MSG_INVALID_TOKEN)


@pytest.mark.parametrize("sub", ["abc", "999999"])
def test_token_for_unknown_user(app, client, sub):
    token = make_token(app, {"sub": sub})

    assert_401(client.get(ME_URL, headers={"Authorization": f"Bearer {token}"}), MSG_ACCOUNT_UNAVAILABLE)


def test_token_of_deleted_user_is_rejected(app, client, users, auth_header):
    headers = auth_header(users["lecturer"])
    with app.app_context():
        db.session.execute(delete(StaffProfile).where(StaffProfile.user_id == users["lecturer"]))
        db.session.execute(delete(User).where(User.id == users["lecturer"]))
        db.session.commit()

    assert_401(client.get(ME_URL, headers=headers), MSG_ACCOUNT_UNAVAILABLE)


@pytest.mark.parametrize("status", [UserStatus.LOCKED, UserStatus.INACTIVE])
def test_token_of_user_locked_after_login_is_rejected(app, client, users, auth_header, status):
    headers = auth_header(users["lecturer"])
    assert client.get(ME_URL, headers=headers).status_code == 200

    with app.app_context():
        db.session.execute(update(User).where(User.id == users["lecturer"]).values(status=status))
        db.session.commit()

    assert_401(client.get(ME_URL, headers=headers), MSG_ACCOUNT_UNAVAILABLE)
