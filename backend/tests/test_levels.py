import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import AuditAction, AuditLog
from app.services.level_service import LEVEL_CODES

LEVELS_URL = "/api/v1/levels"


@pytest.fixture
def levels(app):
    definitions = (
        ("KINDY", "Kindy", 3, 5, 1),
        ("KID_1", "Kid 1", 5, 6, 2),
        ("KID_2", "Kid 2", 6, 7, 3),
        ("KID_3", "Kid 3", 7, 8, 4),
        ("KID_4", "Kid 4", 8, 9, 5),
        ("TEEN_1", "Teen 1", 10, 11, 6),
        ("TEEN_2", "Teen 2", 11, 12, 7),
        ("TEEN_3", "Teen 3", 12, 14, 8),
    )
    ids = []
    with app.app_context():
        for code, name, min_age, max_age, sort_order in definitions:
            ids.append(
                db.session.execute(
                    text("""INSERT INTO levels (code, name, min_age, max_age, sort_order)
                        OUTPUT INSERTED.id VALUES (:code, :name, :min_age, :max_age, :sort_order)"""),
                    {
                        "code": code, "name": name, "min_age": min_age,
                        "max_age": max_age, "sort_order": sort_order,
                    },
                ).scalar_one()
            )
        db.session.commit()
    return ids


@pytest.mark.parametrize("actor", ["manager", "lecturer", "assistant", "student"])
def test_all_authenticated_roles_can_list_exactly_eight_levels(
    client, users, auth_header, levels, actor
):
    res = client.get(LEVELS_URL, headers=auth_header(users[actor]))

    assert res.status_code == 200
    body = res.get_json()
    assert tuple(item["code"] for item in body) == LEVEL_CODES
    assert [item["sort_order"] for item in body] == list(range(1, 9))


def test_levels_require_login(client, levels):
    assert client.get(LEVELS_URL).status_code == 401


def test_manager_updates_level_name_and_age_range_with_audit(
    app, client, users, auth_header, levels
):
    level_id = levels[1]
    res = client.patch(
        f"{LEVELS_URL}/{level_id}",
        headers=auth_header(users["manager"]),
        json={"name": "Kid One", "min_age": 5, "max_age": 7},
    )

    assert res.status_code == 200
    assert res.get_json() == {
        "id": level_id,
        "code": "KID_1",
        "name": "Kid One",
        "min_age": 5,
        "max_age": 7,
        "sort_order": 2,
    }
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "levels", AuditLog.entity_id == level_id
            )
        )
        assert audit.action == AuditAction.UPDATE
        assert audit.old_data == {"name": "Kid 1", "max_age": 6}
        assert audit.new_data == {"name": "Kid One", "max_age": 7}


def test_same_level_update_does_not_write_audit(
    app, client, users, auth_header, levels
):
    res = client.patch(
        f"{LEVELS_URL}/{levels[0]}",
        headers=auth_header(users["manager"]),
        json={"name": "Kindy"},
    )
    assert res.status_code == 200
    with app.app_context():
        assert db.session.scalar(select(AuditLog)) is None


def test_level_update_validates_age_range(client, users, auth_header, levels):
    headers = auth_header(users["manager"])
    url = f"{LEVELS_URL}/{levels[0]}"
    assert client.patch(url, headers=headers, json={"min_age": 8, "max_age": 5}).status_code == 422
    assert client.patch(url, headers=headers, json={"min_age": 8}).status_code == 400
    assert client.patch(url, headers=headers, json={"max_age": -1}).status_code == 422


def test_level_code_and_sort_order_are_immutable(client, users, auth_header, levels):
    headers = auth_header(users["manager"])
    url = f"{LEVELS_URL}/{levels[0]}"
    assert client.patch(url, headers=headers, json={"code": "OTHER"}).status_code == 422
    assert client.patch(url, headers=headers, json={"sort_order": 9}).status_code == 422


def test_level_update_is_manager_only_before_validation(client, users, auth_header, levels):
    url = f"{LEVELS_URL}/{levels[0]}"
    assert client.patch(url, json={}).status_code == 401
    assert client.patch(url, headers=auth_header(users["lecturer"]), json={}).status_code == 403


def test_level_update_handles_empty_and_unknown(client, users, auth_header, levels):
    headers = auth_header(users["manager"])
    assert client.patch(f"{LEVELS_URL}/{levels[0]}", headers=headers, json={}).status_code == 422
    assert client.patch(f"{LEVELS_URL}/999999", headers=headers, json={"name": "X"}).status_code == 404


def test_database_rejects_level_codes_outside_fixed_catalog(app):
    with app.app_context():
        with pytest.raises(IntegrityError):
            db.session.execute(
                text("INSERT INTO levels (code, name, min_age, max_age, sort_order) VALUES ('OTHER', 'Other', 1, 2, 9)")
            )
            db.session.commit()
        db.session.rollback()


def test_no_create_or_delete_level_api(client, users, auth_header, levels):
    headers = auth_header(users["manager"])
    assert client.post(LEVELS_URL, headers=headers, json={}).status_code == 405
    assert client.delete(f"{LEVELS_URL}/{levels[0]}", headers=headers).status_code == 405
