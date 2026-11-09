from io import BytesIO

from sqlalchemy import text

from app.extensions import db


def profile(**changes):
    return {"full_name": "Nguyễn Thử Nghiệm", "email": "profile@neko.edu.vn",
            "phone": "0901234567", "address": "Đà Nẵng", **changes}


def test_profile_commit_can_be_reread_by_another_client(app, client, users, auth_header):
    headers = auth_header(users["manager"])
    response = client.put('/api/v1/auth/profile', json=profile(), headers=headers)
    assert response.status_code == 200, response.get_json()
    with app.app_context():
        row = db.session.execute(text('SELECT full_name,email,phone,address FROM users WHERE id=:id'),
                                 {'id': users['manager']}).mappings().one()
        assert dict(row) == profile()
        db.session.remove()
        db.engine.dispose()
    fresh = app.test_client().get('/api/v1/auth/me', headers=headers)
    assert fresh.status_code == 200
    assert fresh.json['address'] == 'Đà Nẵng'
    assert fresh.json['full_name'] == profile()['full_name']


def test_profile_duplicate_email_does_not_partially_update(app, client, users, auth_header):
    response = client.put('/api/v1/auth/profile', json=profile(email='gv01@neko.edu.vn'),
                          headers=auth_header(users['manager']))
    assert response.status_code == 409
    with app.app_context():
        assert db.session.execute(text('SELECT full_name FROM users WHERE id=:id'),
                                  {'id': users['manager']}).scalar_one() == 'User mg01'


def test_profile_requires_authentication(client):
    assert client.put('/api/v1/auth/profile', json=profile()).status_code == 401


def test_profile_rejects_invalid_fields_without_committing(app, client, users, auth_header):
    headers = auth_header(users['manager'])
    for invalid in (profile(phone='abc'), profile(full_name=' '), profile(email='x'),
                    profile(role='LECTURER'), profile(id=users['lecturer'])):
        response = client.put('/api/v1/auth/profile', json=invalid, headers=headers)
        assert response.status_code == 422, response.get_json()
    with app.app_context():
        assert db.session.execute(text('SELECT COUNT(*) FROM audit_logs')).scalar_one() == 0


def test_avatar_bytes_survive_session_recreation_and_remain_private(app, client, users, auth_header):
    content = b'\x89PNG\r\n\x1a\n' + b'avatar-test-bytes'
    headers = auth_header(users['manager'])
    response = client.post('/api/v1/auth/avatar', headers=headers,
                           data={'file': (BytesIO(content), 'photo.png')})
    assert response.status_code == 200, response.get_json()
    assert response.json['avatar_url'] == '/api/v1/auth/avatar'
    with app.app_context():
        row = db.session.execute(text('SELECT content,byte_size,uploaded_by FROM stored_files')).one()
        assert bytes(row.content) == content
        assert row.byte_size == len(content)
        assert row.uploaded_by == users['manager']
        db.session.remove()
        db.engine.dispose()
    download = app.test_client().get('/api/v1/auth/avatar', headers=headers)
    assert download.status_code == 200 and download.data == content
    assert client.get('/api/v1/auth/avatar', headers=auth_header(users['lecturer'])).status_code == 404


def test_avatar_rejects_missing_unsupported_and_oversized_file(app, client, users, auth_header):
    headers = auth_header(users['manager'])
    for data in ({}, {'file': (BytesIO(b'<svg>bad</svg>'), 'x.svg')},
                 {'file': (BytesIO(b'\x89PNG\r\n\x1a\n' + b'x' * (2 * 1024 * 1024)), 'x.png')}):
        assert client.post('/api/v1/auth/avatar', headers=headers, data=data).status_code == 400
    with app.app_context():
        assert db.session.execute(text('SELECT COUNT(*) FROM stored_files')).scalar_one() == 0


def set_permission(app, role, effect, action='VIEW'):
    with app.app_context():
        db.session.execute(text('''INSERT INTO role_permissions(role_id,resource_id,action_code,effect,condition_code)
            SELECT r.id,p.id,:action,:effect,CASE WHEN :effect='CONDITIONAL' THEN 'EXISTING_SCOPE' END
            FROM roles r CROSS JOIN permission_resources p
            WHERE r.code=:role AND p.code='STUDENTS' '''),
            {'role': role, 'effect': effect, 'action': action})
        db.session.commit()


def test_configured_permission_denial_is_enforced_on_existing_api(app, client, users, auth_header):
    headers = auth_header(users['manager'])
    assert client.get('/api/v1/students', headers=headers).status_code == 200
    set_permission(app, 'MANAGER', 'DENY')
    assert app.test_client().get('/api/v1/students', headers=headers).status_code == 403
    # Self-service remains available, so a denied business module does not disable login/profile.
    assert client.get('/api/v1/auth/me', headers=headers).status_code == 200


def test_allow_permission_never_expands_existing_role_authorization(app, client, users, auth_header):
    set_permission(app, 'LECTURER', 'ALLOW', action='DELETE')
    assert client.post('/api/v1/students', json={}, headers=auth_header(users['lecturer'])).status_code == 403
