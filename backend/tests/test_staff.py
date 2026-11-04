STAFF_URL = "/api/v1/staff"


def test_list_staff_excludes_students_and_salary(client, users, auth_header):
    res = client.get(STAFF_URL, headers=auth_header(users["assistant"]))

    assert res.status_code == 200
    body = res.get_json()
    assert [s["staff_code"] for s in body] == ["GV01", "MG01", "TG01"]
    assert body[0]["full_name"] == "User gv01"
    assert body[0]["email"] == "gv01@neko.edu.vn"
    assert all("rate_per_session" not in s for s in body)


def test_filter_staff_by_position(client, users, auth_header):
    res = client.get(STAFF_URL, headers=auth_header(users["lecturer"]), query_string={"position": "LECTURER"})

    assert [s["staff_code"] for s in res.get_json()] == ["GV01"]


def test_invalid_staff_filter_returns_422(client, users, auth_header):
    res = client.get(STAFF_URL, headers=auth_header(users["lecturer"]), query_string={"position": "STUDENT"})

    assert res.status_code == 422
