from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.extensions import db


def lock(app, user_id, until):
    with app.app_context():
        db.session.execute(text("""UPDATE users SET status='LOCKED',locked_at=:start,
            locked_until=:finish,lock_reason=N'Test giới hạn thời gian' WHERE id=:id"""),
            {'id': user_id, 'start': datetime.now(timezone.utc) - timedelta(days=8), 'finish': until})
        db.session.commit()


def test_expired_lock_allows_new_login_but_old_token_stays_invalid(app, client, users, auth_header):
    old = auth_header(users['lecturer'])
    lock(app, users['lecturer'], datetime.now(timezone.utc)-timedelta(days=1))
    response = client.post('/api/v1/auth/login', json={'username': 'gv01', 'password': 'Neko@2026'})
    assert response.status_code == 200, response.json
    assert client.get('/api/v1/auth/me', headers=old).status_code == 401
    assert client.get('/api/v1/auth/me', headers={'Authorization': 'Bearer '+response.json['access_token']}).status_code == 200
    with app.app_context():
        row = db.session.execute(text('SELECT status,locked_until,lock_reason FROM users WHERE id=:id'),
                                 {'id': users['lecturer']}).one()
        assert tuple(row) == ('ACTIVE', None, None)


def test_future_and_permanent_locks_stay_locked(app, client, users):
    for until in (None, datetime.now(timezone.utc)+timedelta(days=1)):
        lock(app, users['lecturer'], until)
        assert client.post('/api/v1/auth/login', json={'username': 'gv01', 'password': 'Neko@2026'}).status_code == 403
