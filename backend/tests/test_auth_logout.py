from sqlalchemy import select

from app.extensions import db
from app.models import AuditAction, AuditLog, RevokedToken
from app.middlewares.auth import MSG_MISSING_TOKEN, MSG_REVOKED_TOKEN

LOGOUT_URL = "/api/v1/auth/logout"
ME_URL = "/api/v1/auth/me"


def test_logout_revokes_current_access_token(app, client, users, auth_header):
    headers = auth_header(users["manager"])

    res = client.post(LOGOUT_URL, headers=headers)

    assert res.status_code == 204
    assert res.data == b""
    rejected = client.get(ME_URL, headers=headers)
    assert rejected.status_code == 401
    assert rejected.get_json()["message"] == MSG_REVOKED_TOKEN
    with app.app_context():
        revoked = db.session.scalar(select(RevokedToken))
        assert revoked.user_id == users["manager"]
        assert revoked.jti
        assert revoked.expires_at is not None
        [audit] = db.session.scalars(select(AuditLog)).all()
        assert audit.action == AuditAction.LOGOUT
        assert audit.actor_user_id == users["manager"]
        assert audit.ip_address == "127.0.0.1"


def test_logout_only_revokes_token_used_for_request(client, users, auth_header):
    first = auth_header(users["manager"])
    second = auth_header(users["manager"])

    assert client.post(LOGOUT_URL, headers=first).status_code == 204

    assert client.get(ME_URL, headers=first).status_code == 401
    assert client.get(ME_URL, headers=second).status_code == 200


def test_logout_requires_access_token(client):
    res = client.post(LOGOUT_URL)

    assert res.status_code == 401
    assert res.get_json()["message"] == MSG_MISSING_TOKEN


def test_revoked_token_cannot_logout_twice(client, users, auth_header):
    headers = auth_header(users["manager"])
    assert client.post(LOGOUT_URL, headers=headers).status_code == 204

    res = client.post(LOGOUT_URL, headers=headers)

    assert res.status_code == 401
    assert res.get_json()["message"] == MSG_REVOKED_TOKEN


def test_logout_only_accepts_post(client, users, auth_header):
    assert client.get(LOGOUT_URL, headers=auth_header(users["manager"])).status_code == 405
