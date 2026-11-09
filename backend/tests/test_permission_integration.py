def test_saved_lecturer_matrix_keeps_assistant_catalog_in_assistant_scope(client, users, auth_header):
    manager = auth_header(users['manager'])
    lecturer = auth_header(users['lecturer'])
    response = client.get('/api/v1/manager/roles/Lecturer/permissions?defaults=true', headers=manager)
    assert response.status_code == 200
    rows = [{'perms': row['perms'], 'note': row['note']} for row in response.json['rows']]
    assert rows[-1]['perms'] == [0, 0, 0, 0]
    saved = client.put('/api/v1/manager/roles/Lecturer/permissions', json={'rows': rows}, headers=manager)
    assert saved.status_code == 200, saved.json
    # The catalog belongs to Assistants, even though Center administration is denied.
    assert client.get('/api/v1/lecturer/assistant-candidates', headers=lecturer).status_code == 200
    assert client.get('/api/v1/manager/accounts', headers=lecturer).status_code == 403


def test_saved_defaults_authorize_grade_import_and_conditional_assistant_requests(client, users, auth_header):
    manager = auth_header(users['manager'])
    for role in ('Manager', 'Teaching%20Assistant'):
        response = client.get(f'/api/v1/manager/roles/{role}/permissions?defaults=true', headers=manager)
        assert response.status_code == 200
        rows = [{'perms': row['perms'], 'note': row['note']} for row in response.json['rows']]
        assert client.put(f'/api/v1/manager/roles/{role}/permissions', headers=manager, json={'rows': rows}).status_code == 200
    # Import modifies grades; Manager's CREATE=DENY must not reject it as a new module record.
    assert client.post('/api/v1/manager/grades/import', headers=manager).status_code == 422
    # A TA's conditional grade action reaches the real class/grant validation.
    assistant = auth_header(users['assistant'])
    response = client.post('/api/v1/lecturer/classes/999999/assistants/999999/requests',
                           headers=assistant, json={'assessmentId': 999999})
    assert response.status_code == 403, response.json
    assert response.json['message'] == 'Không được phân công trợ giảng cho lớp'
