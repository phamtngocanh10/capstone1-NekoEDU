import pytest
from sqlalchemy import select

from app.common.security import verify_password
from app.extensions import db
from app.middlewares.auth import MSG_ACCOUNT_UNAVAILABLE
from app.models import AuditAction, AuditLog, User
from tests.conftest import DEFAULT_PASSWORD

CHANGE_URL = "/api/v1/auth/password"
USERS_URL = "/api/v1/users"
ME_URL = "/api/v1/auth/me"
LOGIN_URL = "/api/v1/auth/login"
NEW_PASSWORD = "NewStrong@2026"


def test_user_changes_password_and_all_old_tokens_are_invalidated(
    app, client, users, auth_header
):
    old_token = auth_header(users["lecturer"])

    res = client.patch(
        CHANGE_URL,
        headers=old_token,
        json={
            "current_password": DEFAULT_PASSWORD,
            "new_password": NEW_PASSWORD,
            "confirm_password": NEW_PASSWORD,
        },
    )

    assert res.status_code == 204
    assert client.get(ME_URL, headers=old_token).status_code == 401
    assert client.post(
        LOGIN_URL, json={"username": "gv01", "password": DEFAULT_PASSWORD}
    ).status_code == 401
    assert client.post(
        LOGIN_URL, json={"username": "gv01", "password": NEW_PASSWORD}
    ).status_code == 200
    with app.app_context():
        user = db.session.get(User, users["lecturer"])
        assert user.auth_version == 1
        assert verify_password(NEW_PASSWORD, user.password_hash)
        audit = db.session.scalar(
            select(AuditLog).where(AuditLog.entity_id == users["lecturer"])
        )
        assert audit.action == AuditAction.UPDATE
        assert audit.actor_user_id == users["lecturer"]
        assert audit.new_data == {"password_changed": True, "mode": "SELF"}
        assert "password_hash" not in audit.new_data


def test_change_password_rejects_wrong_current_password(client, users, auth_header):
    res = client.patch(
        CHANGE_URL,
        headers=auth_header(users["lecturer"]),
        json={
            "current_password": "Wrong@2026",
            "new_password": NEW_PASSWORD,
            "confirm_password": NEW_PASSWORD,
        },
    )

    assert res.status_code == 400
    assert res.get_json()["message"] == "Mật khẩu hiện tại không đúng"


def test_change_password_rejects_reusing_current_password(client, users, auth_header):
    res = client.patch(
        CHANGE_URL,
        headers=auth_header(users["lecturer"]),
        json={
            "current_password": DEFAULT_PASSWORD,
            "new_password": DEFAULT_PASSWORD,
            "confirm_password": DEFAULT_PASSWORD,
        },
    )

    assert res.status_code == 400
    assert "phải khác" in res.get_json()["message"]


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({}, "current_password"),
        ({"current_password": DEFAULT_PASSWORD}, "new_password"),
        (
            {
                "current_password": DEFAULT_PASSWORD,
                "new_password": "short",
                "confirm_password": "short",
            },
            "new_password",
        ),
        (
            {
                "current_password": DEFAULT_PASSWORD,
                "new_password": "ệ" * 30,
                "confirm_password": "ệ" * 30,
            },
            "new_password",
        ),
        (
            {
                "current_password": DEFAULT_PASSWORD,
                "new_password": NEW_PASSWORD,
                "confirm_password": "Different@2026",
            },
            "confirm_password",
        ),
    ],
)
def test_change_password_validates_payload(client, users, auth_header, payload, field):
    res = client.patch(CHANGE_URL, headers=auth_header(users["lecturer"]), json=payload)

    assert res.status_code == 422
    assert field in res.get_json()["errors"]["json"]


def test_change_password_requires_login_before_validation(client):
    assert client.patch(CHANGE_URL, json={}).status_code == 401


def test_manager_resets_another_users_password_and_invalidates_tokens(
    app, client, users, auth_header
):
    old_token = auth_header(users["student"])

    res = client.post(
        f"{USERS_URL}/{users['student']}/reset-password",
        headers=auth_header(users["manager"]),
        json={"new_password": NEW_PASSWORD, "confirm_password": NEW_PASSWORD},
    )

    assert res.status_code == 204
    rejected = client.get(ME_URL, headers=old_token)
    assert rejected.status_code == 401
    assert rejected.get_json()["message"] == MSG_ACCOUNT_UNAVAILABLE
    assert client.post(
        LOGIN_URL, json={"username": "hs001", "password": DEFAULT_PASSWORD}
    ).status_code == 401
    assert client.post(
        LOGIN_URL, json={"username": "hs001", "password": NEW_PASSWORD}
    ).status_code == 200
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_id == users["student"],
                AuditLog.action == AuditAction.UPDATE,
            )
        )
        assert audit.actor_user_id == users["manager"]
        assert audit.new_data["mode"] == "MANAGER_RESET"


def test_manager_cannot_reset_own_password(client, users, auth_header):
    res = client.post(
        f"{USERS_URL}/{users['manager']}/reset-password",
        headers=auth_header(users["manager"]),
        json={"new_password": NEW_PASSWORD, "confirm_password": NEW_PASSWORD},
    )

    assert res.status_code == 403
    assert "chính mình" in res.get_json()["message"]


def test_manager_reset_rejects_reusing_current_password(client, users, auth_header):
    res = client.post(
        f"{USERS_URL}/{users['student']}/reset-password",
        headers=auth_header(users["manager"]),
        json={"new_password": DEFAULT_PASSWORD, "confirm_password": DEFAULT_PASSWORD},
    )

    assert res.status_code == 400
    assert "phải khác" in res.get_json()["message"]


def test_only_manager_can_reset_password(client, users, auth_header):
    url = f"{USERS_URL}/{users['student']}/reset-password"
    assert client.post(url, json={}).status_code == 401
    assert client.post(url, headers=auth_header(users["lecturer"]), json={}).status_code == 403


def test_reset_password_validates_payload_and_unknown_user(client, users, auth_header):
    headers = auth_header(users["manager"])
    url = f"{USERS_URL}/{users['student']}/reset-password"
    assert client.post(url, headers=headers, json={}).status_code == 422
    assert client.post(
        url,
        headers=headers,
        json={"new_password": NEW_PASSWORD, "confirm_password": "Mismatch@2026"},
    ).status_code == 422
    assert client.post(
        f"{USERS_URL}/999999/reset-password",
        headers=headers,
        json={"new_password": NEW_PASSWORD, "confirm_password": NEW_PASSWORD},
    ).status_code == 404
