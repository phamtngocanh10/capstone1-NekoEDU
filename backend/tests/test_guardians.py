import pytest
from sqlalchemy import select, text

from app.extensions import db
from app.models import AuditAction, AuditLog

GUARDIANS_URL = "/api/v1/guardians"


@pytest.fixture
def guardians(app):
    with app.app_context():
        ids = []
        for values in (
            ("Nguyễn Văn An", "0901234567", "an@example.com", "FATHER", "Đà Nẵng"),
            ("Trần Thị Bình", "0901234568", None, "MOTHER", "Huế"),
            ("Lê Minh Châu", "0901234569", "chau@example.com", "GUARDIAN", None),
        ):
            ids.append(
                db.session.execute(
                    text("""INSERT INTO guardians
                        (full_name, phone, email, relationship, address)
                        OUTPUT INSERTED.id VALUES (:name, :phone, :email, :relationship, :address)"""),
                    {
                        "name": values[0], "phone": values[1], "email": values[2],
                        "relationship": values[3], "address": values[4],
                    },
                ).scalar_one()
            )
        db.session.commit()
    return ids


def manager_headers(users, auth_header):
    return auth_header(users["manager"])


def test_manager_lists_searches_filters_and_pages_guardians(
    client, users, auth_header, guardians
):
    headers = manager_headers(users, auth_header)
    all_items = client.get(GUARDIANS_URL, headers=headers).get_json()
    by_name = client.get(GUARDIANS_URL, headers=headers, query_string={"q": "văn an"}).get_json()
    by_phone = client.get(GUARDIANS_URL, headers=headers, query_string={"q": "4568"}).get_json()
    by_email = client.get(GUARDIANS_URL, headers=headers, query_string={"q": "CHAU@"}).get_json()
    mothers = client.get(
        GUARDIANS_URL, headers=headers, query_string={"relationship": "MOTHER"}
    ).get_json()
    page = client.get(
        GUARDIANS_URL, headers=headers, query_string={"page": 2, "page_size": 2}
    ).get_json()

    assert len(all_items["items"]) == 3
    assert all_items["pagination"]["total"] == 3
    assert [item["full_name"] for item in by_name["items"]] == ["Nguyễn Văn An"]
    assert [item["full_name"] for item in by_phone["items"]] == ["Trần Thị Bình"]
    assert [item["full_name"] for item in by_email["items"]] == ["Lê Minh Châu"]
    assert [item["relationship"] for item in mothers["items"]] == ["MOTHER"]
    assert len(page["items"]) == 1
    assert page["pagination"] == {"page": 2, "page_size": 2, "total": 3, "total_pages": 2}


def test_guardian_search_escapes_wildcards(client, users, auth_header, guardians):
    headers = manager_headers(users, auth_header)
    assert client.get(GUARDIANS_URL, headers=headers, query_string={"q": "%"}).get_json()["items"] == []
    assert client.get(GUARDIANS_URL, headers=headers, query_string={"q": "_"}).get_json()["items"] == []


@pytest.mark.parametrize(
    ("query", "field"),
    [
        ({"page": 0}, "page"),
        ({"page_size": 101}, "page_size"),
        ({"relationship": "SIBLING"}, "relationship"),
        ({"q": "x" * 101}, "q"),
    ],
)
def test_guardian_list_validates_query(client, users, auth_header, guardians, query, field):
    res = client.get(GUARDIANS_URL, headers=manager_headers(users, auth_header), query_string=query)
    assert res.status_code == 422
    assert field in res.get_json()["errors"]["query"]


def test_guardian_management_is_manager_only_before_validation(client, users, auth_header):
    assert client.get(f"{GUARDIANS_URL}?page=bad").status_code == 401
    assert client.get(
        f"{GUARDIANS_URL}?page=bad", headers=auth_header(users["lecturer"])
    ).status_code == 403
    assert client.post(
        GUARDIANS_URL, headers=auth_header(users["student"]), json={}
    ).status_code == 403


def test_manager_creates_guardian_with_normalization_and_audit(
    app, client, users, auth_header
):
    res = client.post(
        GUARDIANS_URL,
        headers=manager_headers(users, auth_header),
        json={
            "full_name": "  Phạm Thị Dung  ",
            "phone": "0912345678",
            "email": " DUNG@EXAMPLE.COM ",
            "relationship": "MOTHER",
            "address": "  Quảng Nam  ",
        },
    )

    assert res.status_code == 201
    body = res.get_json()
    assert body["full_name"] == "Phạm Thị Dung"
    assert body["email"] == "dung@example.com"
    assert body["address"] == "Quảng Nam"
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "guardians", AuditLog.entity_id == body["id"]
            )
        )
        assert audit.action == AuditAction.CREATE
        assert audit.actor_user_id == users["manager"]


def test_create_guardian_rejects_duplicate_phone_without_auto_merging(
    client, users, auth_header, guardians
):
    res = client.post(
        GUARDIANS_URL,
        headers=manager_headers(users, auth_header),
        json={
            "full_name": "Người hoàn toàn khác",
            "phone": "0901234567",
            "relationship": "GUARDIAN",
        },
    )

    assert res.status_code == 409
    assert "không tự động gộp" in res.get_json()["message"]


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({}, "full_name"),
        ({"full_name": "P", "phone": "123", "relationship": "FATHER"}, "phone"),
        ({"full_name": "P", "phone": "0912345678", "relationship": "SIBLING"}, "relationship"),
        ({"full_name": "P", "phone": "0912345678", "relationship": "FATHER", "email": "bad"}, "email"),
    ],
)
def test_create_guardian_validates_payload(client, users, auth_header, payload, field):
    res = client.post(GUARDIANS_URL, headers=manager_headers(users, auth_header), json=payload)
    assert res.status_code == 422
    assert field in res.get_json()["errors"]["json"]


def test_manager_gets_and_updates_guardian_with_audit(
    app, client, users, auth_header, guardians
):
    guardian_id = guardians[0]
    headers = manager_headers(users, auth_header)
    assert client.get(f"{GUARDIANS_URL}/{guardian_id}", headers=headers).status_code == 200

    res = client.patch(
        f"{GUARDIANS_URL}/{guardian_id}",
        headers=headers,
        json={
            "full_name": "Nguyễn Văn An Mới",
            "phone": "0987654321",
            "email": None,
            "relationship": "GUARDIAN",
            "address": None,
        },
    )

    assert res.status_code == 200
    assert res.get_json()["phone"] == "0987654321"
    assert res.get_json()["email"] is None
    with app.app_context():
        audit = db.session.scalar(
            select(AuditLog).where(
                AuditLog.entity_name == "guardians",
                AuditLog.entity_id == guardian_id,
                AuditLog.action == AuditAction.UPDATE,
            )
        )
        assert audit.old_data["phone"] == "0901234567"
        assert audit.new_data["phone"] == "0987654321"


def test_update_guardian_rejects_duplicate_empty_and_unknown(
    app, client, users, auth_header, guardians
):
    headers = manager_headers(users, auth_header)
    url = f"{GUARDIANS_URL}/{guardians[0]}"
    assert client.patch(url, headers=headers, json={"phone": "0901234568"}).status_code == 409
    assert client.patch(url, headers=headers, json={}).status_code == 422
    assert client.patch(
        f"{GUARDIANS_URL}/999999", headers=headers, json={"full_name": "X"}
    ).status_code == 404
    assert client.get(f"{GUARDIANS_URL}/999999", headers=headers).status_code == 404


def test_same_guardian_update_does_not_write_audit(
    app, client, users, auth_header, guardians
):
    res = client.patch(
        f"{GUARDIANS_URL}/{guardians[0]}",
        headers=manager_headers(users, auth_header),
        json={"full_name": "Nguyễn Văn An"},
    )
    assert res.status_code == 200
    with app.app_context():
        assert db.session.scalar(select(AuditLog)) is None
