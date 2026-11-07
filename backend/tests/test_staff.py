STAFF_URL = "/api/v1/staff"


def test_list_staff_excludes_students_and_salary(client, users, auth_header):
    res = client.get(STAFF_URL, headers=auth_header(users["assistant"]))

    assert res.status_code == 200
    body = res.get_json()
    assert [s["staff_code"] for s in body] == ["GV01", "MG01", "TG01"]
    assert body[0]["full_name"] == "User gv01"
    assert body[0]["email"] == "gv01@neko.edu.vn"
    assert body[0]["hire_date"] == "2025-01-01"
    assert body[0]["account_status"] == "ACTIVE"
    assert all("rate_per_session" not in s for s in body)


def test_manager_can_view_rate_per_session(client, users, auth_header):
    res = client.get(STAFF_URL, headers=auth_header(users["manager"]))

    assert res.status_code == 200
    assert {item["rate_per_session"] for item in res.get_json()} == {250000}


def test_lecturer_and_assistant_cannot_view_rate(client, users, auth_header):
    for actor in ("lecturer", "assistant"):
        res = client.get(STAFF_URL, headers=auth_header(users[actor]))
        assert res.status_code == 200
        assert all("rate_per_session" not in item for item in res.get_json())


def test_filter_staff_by_position(client, users, auth_header):
    res = client.get(STAFF_URL, headers=auth_header(users["lecturer"]), query_string={"position": "LECTURER"})

    assert [s["staff_code"] for s in res.get_json()] == ["GV01"]


def test_filter_staff_by_status_and_combined_filters(app, client, users, auth_header):
    from sqlalchemy import update

    from app.extensions import db
    from app.models import StaffProfile

    with app.app_context():
        db.session.execute(
            update(StaffProfile)
            .where(StaffProfile.user_id == users["assistant"])
            .values(status="INACTIVE")
        )
        db.session.commit()

    headers = auth_header(users["lecturer"])
    inactive = client.get(STAFF_URL, headers=headers, query_string={"status": "INACTIVE"})
    active_lecturers = client.get(
        STAFF_URL,
        headers=headers,
        query_string={"status": "ACTIVE", "position": "LECTURER"},
    )

    assert [item["staff_code"] for item in inactive.get_json()] == ["TG01"]
    assert [item["staff_code"] for item in active_lecturers.get_json()] == ["GV01"]


def test_invalid_staff_filter_returns_422(client, users, auth_header):
    res = client.get(STAFF_URL, headers=auth_header(users["lecturer"]), query_string={"position": "STUDENT"})

    assert res.status_code == 422


def test_student_and_anonymous_cannot_view_staff_directory(client, users, auth_header):
    assert client.get(STAFF_URL).status_code == 401
    assert client.get(STAFF_URL, headers=auth_header(users["student"])).status_code == 403


def test_staff_authorization_happens_before_filter_validation(client, users, auth_header):
    assert client.get(f"{STAFF_URL}?position=INVALID").status_code == 401
    assert client.get(
        f"{STAFF_URL}?position=INVALID", headers=auth_header(users["student"])
    ).status_code == 403
