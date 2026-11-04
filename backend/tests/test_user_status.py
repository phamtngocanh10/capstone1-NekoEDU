import pytest
from sqlalchemy import select

from app.extensions import db
from app.middlewares.auth import MSG_ACCOUNT_UNAVAILABLE
from app.models import AuditAction, AuditLog, User, UserStatus

USERS_URL = "/api/v1/users"
ME_URL = "/api/v1/auth/me"


@pytest.mark.parametrize("status", [UserStatus.LOCKED, UserStatus.INACTIVE])
def test_manager_blocks_account_and_invalidates_existing_token(
    app, client, users, auth_header, status
):
    old_token = auth_header(users["lecturer"])

    res = client.patch(
        f"{USERS_URL}/{users['lecturer']}/status",
        headers=auth_header(users["manager"]),
        json={"status": status},
    )

    assert res.status_code == 200
    assert res.get_json()["status"] == status
    rejected = client.get(ME_URL, headers=old_token)
    assert rejected.status_code == 401
    assert rejected.get_json()["message"] == MSG_ACCOUNT_UNAVAILABLE
    with app.app_context():
        user = db.session.get(User, users["lecturer"])
        assert user.auth_version == 1
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.action == AuditAction.UPDATE,
                AuditLog.entity_id == users["lecturer"],
            )
        )
        assert audit.old_data["status"] == "ACTIVE"
        assert audit.new_data["status"] == status
        assert audit.actor_user_id == users["manager"]


def test_unlock_requires_new_token_after_status_cycle(app, client, users, auth_header):
    old_token = auth_header(users["lecturer"])
    manager = auth_header(users["manager"])
    url = f"{USERS_URL}/{users['lecturer']}/status"

    assert client.patch(url, headers=manager, json={"status": "LOCKED"}).status_code == 200
    assert client.patch(url, headers=manager, json={"status": "ACTIVE"}).status_code == 200

    assert client.get(ME_URL, headers=old_token).status_code == 401
    assert client.get(ME_URL, headers=auth_header(users["lecturer"])).status_code == 200
    with app.app_context():
        assert db.session.get(User, users["lecturer"]).auth_version == 2


def test_same_status_is_idempotent_and_does_not_write_audit(
    app, client, users, auth_header
):
    res = client.patch(
        f"{USERS_URL}/{users['lecturer']}/status",
        headers=auth_header(users["manager"]),
        json={"status": "ACTIVE"},
    )

    assert res.status_code == 200
    with app.app_context():
        assert db.session.scalar(select(AuditLog)) is None
        assert db.session.get(User, users["lecturer"]).auth_version == 0


def test_manager_cannot_change_own_status(client, users, auth_header):
    res = client.patch(
        f"{USERS_URL}/{users['manager']}/status",
        headers=auth_header(users["manager"]),
        json={"status": "LOCKED"},
    )

    assert res.status_code == 403
    assert "chính mình" in res.get_json()["message"]


@pytest.mark.parametrize("payload", [{}, {"status": "DELETED"}, {"status": None}])
def test_status_payload_is_validated(client, users, auth_header, payload):
    res = client.patch(
        f"{USERS_URL}/{users['lecturer']}/status",
        headers=auth_header(users["manager"]),
        json=payload,
    )

    assert res.status_code == 422
    assert "status" in res.get_json()["errors"]["json"]


def test_status_endpoint_requires_manager_before_validation(client, users, auth_header):
    url = f"{USERS_URL}/{users['lecturer']}/status"
    assert client.patch(url, json={}).status_code == 401
    assert client.patch(url, headers=auth_header(users["assistant"]), json={}).status_code == 403


def test_status_unknown_user_returns_404(client, users, auth_header):
    res = client.patch(
        f"{USERS_URL}/999999/status",
        headers=auth_header(users["manager"]),
        json={"status": "LOCKED"},
    )

    assert res.status_code == 404
