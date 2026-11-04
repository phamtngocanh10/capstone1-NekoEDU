import pytest

from app.models import RoleCode, UserStatus

USERS_URL = "/api/v1/users"


@pytest.fixture
def manager_headers(users, auth_header):
    return auth_header(users["manager"])


def list_users(client, headers, **params):
    res = client.get(USERS_URL, headers=headers, query_string=params)
    assert res.status_code == 200, res.get_json()
    return res.get_json()


def usernames(body) -> list[str]:
    return [u["username"] for u in body["items"]]


def test_list_users_default_pagination(client, manager_headers):
    body = list_users(client, manager_headers)

    assert usernames(body) == ["mg01", "gv01", "tg01", "hs001"]
    assert body["pagination"] == {"page": 1, "page_size": 20, "total": 4, "total_pages": 1}
    assert all("password_hash" not in u for u in body["items"])


def test_list_users_paging(client, manager_headers):
    page2 = list_users(client, manager_headers, page=2, page_size=3)
    page3 = list_users(client, manager_headers, page=3, page_size=3)

    assert usernames(page2) == ["hs001"]
    assert page2["pagination"] == {"page": 2, "page_size": 3, "total": 4, "total_pages": 2}
    assert page3["items"] == []


def test_filter_by_role_and_status(client, manager_headers, create_user):
    create_user("gv09", RoleCode.LECTURER, status=UserStatus.LOCKED)

    assert usernames(list_users(client, manager_headers, role="LECTURER")) == ["gv01", "gv09"]
    assert usernames(list_users(client, manager_headers, status="LOCKED")) == ["gv09"]
    assert usernames(list_users(client, manager_headers, role="LECTURER", status="ACTIVE")) == ["gv01"]


def test_search_by_username_email_or_full_name(client, manager_headers, create_user):
    create_user("gv09", RoleCode.LECTURER, full_name="Trần Thị Thu Hà", email="thuha@gmail.com")

    assert usernames(list_users(client, manager_headers, q="gv0")) == ["gv01", "gv09"]
    assert usernames(list_users(client, manager_headers, q="GMAIL")) == ["gv09"]
    assert usernames(list_users(client, manager_headers, q="thu hà")) == ["gv09"]


def test_search_treats_like_wildcards_literally(client, manager_headers):
    assert list_users(client, manager_headers, q="%")["items"] == []
    assert list_users(client, manager_headers, q="_")["items"] == []


def test_blank_search_is_ignored(client, manager_headers):
    assert list_users(client, manager_headers, q="   ")["pagination"]["total"] == 4


@pytest.mark.parametrize(
    ("params", "field"),
    [
        ({"page": 0}, "page"),
        ({"page": -1}, "page"),
        ({"page": "abc"}, "page"),
        ({"page_size": 0}, "page_size"),
        ({"page_size": 101}, "page_size"),
        ({"role": "ADMIN"}, "role"),
        ({"status": "DELETED"}, "status"),
        ({"q": "x" * 101}, "q"),
    ],
)
def test_invalid_query_params_return_422(client, manager_headers, params, field):
    res = client.get(USERS_URL, headers=manager_headers, query_string=params)

    assert res.status_code == 422
    assert field in res.get_json()["errors"]["query"]


def test_unknown_query_params_are_ignored(client, manager_headers):
    assert list_users(client, manager_headers, _="1727942400")["pagination"]["total"] == 4


def test_get_user_detail(client, users, manager_headers):
    res = client.get(f"{USERS_URL}/{users['student']}", headers=manager_headers)

    assert res.status_code == 200
    assert res.get_json()["username"] == "hs001"


def test_get_unknown_user_returns_404(client, manager_headers):
    res = client.get(f"{USERS_URL}/999999", headers=manager_headers)

    assert res.status_code == 404
    assert res.get_json()["message"] == "Không tìm thấy tài khoản"
