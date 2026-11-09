from urllib.parse import parse_qs, urlparse

from sqlalchemy import text

from app.extensions import db
from app.services import recovery_service


def test_recovery_without_mail_provider_returns_error_without_claiming_delivery(client):
    response = client.post('/api/v1/auth/recovery', json={'email': 'mg01@neko.edu.vn'})
    assert response.status_code == 503
    assert 'Chưa cấu hình' in response.json['message']


def test_recovery_reset_link_updates_sql_once_and_invalidates_old_tokens(app, client, users, auth_header, monkeypatch):
    monkeypatch.setitem(app.config, 'MAIL_SERVER', 'local-test.invalid')
    monkeypatch.setitem(app.config, 'MAIL_FROM', 'test@neko.edu.vn')
    delivered = []
    monkeypatch.setattr(recovery_service, '_send_recovery', lambda recipient, link: delivered.append((recipient, link)))
    old_token = auth_header(users['lecturer'])
    response = client.post('/api/v1/auth/recovery', json={'email': 'GV01@neko.edu.vn'})
    assert response.status_code == 202
    assert delivered[0][0] == 'gv01@neko.edu.vn'
    token = parse_qs(urlparse(delivered[0][1]).query)['token'][0]
    payload = {'token': token, 'new_password': 'Changed@2026', 'confirm_password': 'Changed@2026'}
    assert client.post('/api/v1/auth/reset-password', json=payload).status_code == 204
    assert client.get('/api/v1/auth/me', headers=old_token).status_code == 401
    with app.app_context():
        assert db.session.execute(text('SELECT auth_version FROM users WHERE id=:id'),
                                  {'id': users['lecturer']}).scalar_one() == 1
        assert db.session.execute(text("SELECT COUNT(*) FROM audit_logs WHERE entity_name='users'")).scalar_one() == 1
        db.session.remove()
        db.engine.dispose()
    assert app.test_client().post('/api/v1/auth/login', json={'username': 'gv01', 'password': 'Changed@2026'}).status_code == 200
    assert client.post('/api/v1/auth/reset-password', json=payload).status_code == 400


def test_recovery_unknown_account_has_same_public_result_without_sending(app, client, users, monkeypatch):
    monkeypatch.setitem(app.config, 'MAIL_SERVER', 'local-test.invalid')
    monkeypatch.setitem(app.config, 'MAIL_FROM', 'test@neko.edu.vn')
    delivered = []
    monkeypatch.setattr(recovery_service, '_send_recovery', lambda *args: delivered.append(args))
    unknown = client.post('/api/v1/auth/recovery', json={'email': 'unknown@neko.edu.vn'})
    known = client.post('/api/v1/auth/recovery', json={'email': 'mg01@neko.edu.vn'})
    assert unknown.status_code == known.status_code == 202
    assert unknown.json == known.json
    assert len(delivered) == 1


def test_password_reset_rejects_invalid_missing_token_or_mismatch(app, client, users):
    for payload in ({}, {'token': 'invalid', 'new_password': 'Changed@2026', 'confirm_password': 'Changed@2026'},
                    {'token': 'invalid', 'new_password': 'Changed@2026', 'confirm_password': 'Other@2026'}):
        assert client.post('/api/v1/auth/reset-password', json=payload).status_code in (400, 422)
    with app.app_context():
        assert db.session.execute(text('SELECT SUM(auth_version) FROM users')).scalar_one() == 0
