"""Phân quyền theo role: Manager-only (/users) và Staff (/staff)."""

import pytest
from sqlalchemy import select, update

from app.extensions import db
from app.middlewares.auth import MSG_FORBIDDEN, auth_required
from app.models import Role, RoleCode, User

USERS_URL = "/api/v1/users"
STAFF_URL = "/api/v1/staff"


@pytest.mark.parametrize(
    ("actor", "users_status", "staff_status"),
    [
        ("manager", 200, 200),
        ("lecturer", 403, 200),
        ("assistant", 403, 200),
        ("student", 403, 403),
    ],
)
def test_role_matrix(client, users, auth_header, actor, users_status, staff_status):
    headers = auth_header(users[actor])

    assert client.get(USERS_URL, headers=headers).status_code == users_status
    assert client.get(f"{USERS_URL}/{users['student']}", headers=headers).status_code == users_status
    assert client.get(STAFF_URL, headers=headers).status_code == staff_status


def test_forbidden_response_body(client, users, auth_header):
    res = client.get(USERS_URL, headers=auth_header(users["lecturer"]))

    assert res.get_json() == {"code": 403, "status": "Forbidden", "message": MSG_FORBIDDEN}


@pytest.mark.parametrize("url", [USERS_URL, f"{USERS_URL}/1", STAFF_URL])
def test_private_apis_require_login(client, url):
    assert client.get(url).status_code == 401


def test_permission_uses_current_role_in_db_not_role_in_token(app, client, users, auth_header):
    manager_headers = auth_header(users["manager"])
    lecturer_headers = auth_header(users["lecturer"])

    # Đổi role sau khi token đã được cấp: Manager -> Giảng viên, Giảng viên -> Manager
    with app.app_context():
        role_id = {r.code: r.id for r in db.session.scalars(select(Role))}
        db.session.execute(update(User).where(User.id == users["manager"]).values(role_id=role_id[RoleCode.LECTURER]))
        db.session.execute(update(User).where(User.id == users["lecturer"]).values(role_id=role_id[RoleCode.MANAGER]))
        db.session.commit()

    assert client.get(USERS_URL, headers=manager_headers).status_code == 403
    assert client.get(USERS_URL, headers=lecturer_headers).status_code == 200


def test_auth_is_checked_before_input_validation(client, users, auth_header):
    # Chưa đăng nhập / không đủ quyền thì không được biết request có hợp lệ hay không
    assert client.get(f"{USERS_URL}?page=abc").status_code == 401
    assert client.get(f"{USERS_URL}?page=abc", headers=auth_header(users["lecturer"])).status_code == 403
    assert client.get(f"{USERS_URL}?page=abc", headers=auth_header(users["manager"])).status_code == 422


def test_auth_required_rejects_unknown_role():
    with pytest.raises(ValueError):
        auth_required("ADMIN")
