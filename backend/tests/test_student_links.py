import pytest
from sqlalchemy import select, text

from app.extensions import db
from app.models import AuditAction, AuditLog, RoleCode

USERS_URL = "/api/v1/users"
STUDENTS_URL = "/api/v1/students"


@pytest.fixture
def link_scope(app, create_user):
    parent_id = create_user("parent01", RoleCode.STUDENT_PARENT, email=None)
    blocked_parent_id = create_user("parent02", RoleCode.STUDENT_PARENT, email=None)
    with app.app_context():
        guardian_id = db.session.execute(
            text("INSERT INTO guardians (full_name, phone, relationship) OUTPUT INSERTED.id VALUES (N'P', '0901234567', 'FATHER')")
        ).scalar_one()
        level_id = db.session.execute(
            text("INSERT INTO levels (code, name, min_age, max_age, sort_order) OUTPUT INSERTED.id VALUES ('KID_1', 'Kid 1', 6, 7, 2)")
        ).scalar_one()
        student_ids = []
        for index in (1, 2):
            student_ids.append(
                db.session.execute(
                    text("""INSERT INTO students
                        (student_code, full_name, date_of_birth, guardian_id,
                         current_level_id, enrolled_at, status)
                        OUTPUT INSERTED.id
                        VALUES (:code, :name, '2018-01-01', :guardian,
                                :level, '2025-01-01', 'ACTIVE')"""),
                    {
                        "code": f"HS{index:03}", "name": f"Học viên {index}",
                        "guardian": guardian_id, "level": level_id,
                    },
                ).scalar_one()
            )
        db.session.commit()
    return {
        "parent": parent_id,
        "blocked_parent": blocked_parent_id,
        "students": student_ids,
    }


def link_url(scope, student_index=0, parent_key="parent"):
    return (
        f"{USERS_URL}/{scope[parent_key]}/students/"
        f"{scope['students'][student_index]}"
    )


def test_manager_links_one_parent_to_multiple_students_with_relationship_and_audit(
    app, client, users, auth_header, link_scope
):
    headers = auth_header(users["manager"])
    first = client.post(
        link_url(link_scope, 0),
        headers=headers,
        json={"relationship": "FATHER", "can_view": True},
    )
    second = client.post(
        link_url(link_scope, 1),
        headers=headers,
        json={"relationship": "GUARDIAN", "can_view": True},
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.get_json()["relationship"] == "FATHER"
    assert second.get_json()["relationship"] == "GUARDIAN"
    with app.app_context():
        assert db.session.execute(
            text("SELECT COUNT(*) FROM student_user_links WHERE user_id = :id"),
            {"id": link_scope["parent"]},
        ).scalar_one() == 2
        audits = db.session.scalars(
            select(AuditLog).where(AuditLog.entity_name == "student_user_links")
        ).all()
        assert len(audits) == 2
        assert all(a.action == AuditAction.CREATE for a in audits)


def test_parent_list_and_detail_include_all_viewable_linked_students(
    client, users, auth_header, link_scope
):
    manager = auth_header(users["manager"])
    for index in (0, 1):
        assert client.post(
            link_url(link_scope, index),
            headers=manager,
            json={"relationship": "FATHER", "can_view": True},
        ).status_code == 201

    parent_headers = auth_header(link_scope["parent"])
    listing = client.get(STUDENTS_URL, headers=parent_headers)

    assert listing.status_code == 200
    assert [item["student_code"] for item in listing.get_json()["items"]] == ["HS001", "HS002"]
    for student_id in link_scope["students"]:
        assert client.get(f"{STUDENTS_URL}/{student_id}", headers=parent_headers).status_code == 200
    me = client.get("/api/v1/auth/me", headers=parent_headers)
    assert len(me.get_json()["profiles"]) == 2
    assert me.get_json()["profile"]["student_code"] == "HS001"


def test_can_view_false_keeps_relationship_but_denies_data_access(
    client, users, auth_header, link_scope
):
    assert client.post(
        link_url(link_scope),
        headers=auth_header(users["manager"]),
        json={"relationship": "GUARDIAN", "can_view": False},
    ).status_code == 201

    parent_headers = auth_header(link_scope["parent"])
    assert client.get(STUDENTS_URL, headers=parent_headers).get_json()["items"] == []
    assert client.get(
        f"{STUDENTS_URL}/{link_scope['students'][0]}", headers=parent_headers
    ).status_code == 403


def test_link_rejects_duplicate_wrong_role_and_missing_resources(
    client, users, auth_header, link_scope
):
    headers = auth_header(users["manager"])
    payload = {"relationship": "FATHER", "can_view": True}
    assert client.post(link_url(link_scope), headers=headers, json=payload).status_code == 201
    assert client.post(link_url(link_scope), headers=headers, json=payload).status_code == 409
    assert client.post(
        f"{USERS_URL}/{users['lecturer']}/students/{link_scope['students'][0]}",
        headers=headers,
        json=payload,
    ).status_code == 409
    assert client.post(
        f"{USERS_URL}/999999/students/{link_scope['students'][0]}",
        headers=headers,
        json=payload,
    ).status_code == 404
    assert client.post(
        f"{USERS_URL}/{link_scope['parent']}/students/999999",
        headers=headers,
        json=payload,
    ).status_code == 404


@pytest.mark.parametrize(
    ("payload", "field"),
    [({}, "relationship"), ({"relationship": "SIBLING"}, "relationship"), ({"relationship": "FATHER", "can_view": "yes"}, "can_view")],
)
def test_link_validates_payload(client, users, auth_header, link_scope, payload, field):
    res = client.post(
        link_url(link_scope), headers=auth_header(users["manager"]), json=payload
    )
    assert res.status_code == 422
    assert field in res.get_json()["errors"]["json"]


def test_manager_unlinks_student_and_access_is_revoked_immediately(
    app, client, users, auth_header, link_scope
):
    manager = auth_header(users["manager"])
    url = link_url(link_scope)
    assert client.post(
        url, headers=manager, json={"relationship": "FATHER", "can_view": True}
    ).status_code == 201
    parent = auth_header(link_scope["parent"])
    assert client.get(
        f"{STUDENTS_URL}/{link_scope['students'][0]}", headers=parent
    ).status_code == 200

    res = client.delete(url, headers=manager)

    assert res.status_code == 204
    assert client.get(
        f"{STUDENTS_URL}/{link_scope['students'][0]}", headers=parent
    ).status_code == 403
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "student_user_links",
                AuditLog.action == AuditAction.DELETE,
            )
        )
        assert audit.old_data["relationship"] == "FATHER"


def test_unlink_handles_legacy_student_user_id_and_missing_link(
    app, client, users, auth_header, link_scope
):
    with app.app_context():
        db.session.execute(
            text("UPDATE students SET user_id = :user_id WHERE id = :student_id"),
            {"user_id": link_scope["parent"], "student_id": link_scope["students"][0]},
        )
        db.session.commit()
    headers = auth_header(users["manager"])

    assert client.delete(link_url(link_scope), headers=headers).status_code == 204
    assert client.delete(link_url(link_scope), headers=headers).status_code == 404


def test_link_management_is_manager_only_before_validation(
    client, users, auth_header, link_scope
):
    url = link_url(link_scope)
    assert client.post(url, json={}).status_code == 401
    assert client.post(url, headers=auth_header(users["lecturer"]), json={}).status_code == 403
    assert client.delete(url).status_code == 401
