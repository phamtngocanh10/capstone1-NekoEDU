from datetime import date

import pytest
from flask_migrate import upgrade
from sqlalchemy import select, text
from sqlalchemy.engine import make_url

from app import create_app
from app.common.security import hash_password
from app.extensions import db
from app.models import Role, RoleCode, StaffPosition, StaffProfile, User, UserStatus

DEFAULT_PASSWORD = "Neko@2026"

ROLES = {
    RoleCode.MANAGER: "Quản lý trung tâm",
    RoleCode.LECTURER: "Giảng viên",
    RoleCode.TEACHING_ASSISTANT: "Trợ giảng",
    RoleCode.STUDENT_PARENT: "Học viên / Phụ huynh",
}

_AUTO = object()


@pytest.fixture(scope="session")
def app():
    app = create_app("testing")

    # Test sẽ xóa sạch database, chỉ cho chạy trên DB dành riêng cho test
    db_name = make_url(app.config["SQLALCHEMY_DATABASE_URI"]).database or ""
    if not db_name.endswith("_test"):
        pytest.exit(
            f"TEST_DATABASE_URL phải trỏ tới database có tên kết thúc bằng _test (đang là {db_name!r}).",
            returncode=1,
        )

    with app.app_context():
        with db.engine.begin() as conn:
            conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            conn.execute(text("CREATE SCHEMA public"))
        upgrade()

    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def reset_db(app):
    """Mỗi test bắt đầu với DB chỉ có 4 role, không có tài khoản nào."""
    with app.app_context():
        db.session.execute(text("TRUNCATE roles, users RESTART IDENTITY CASCADE"))
        db.session.add_all(Role(code=code, name=name) for code, name in ROLES.items())
        db.session.commit()


@pytest.fixture
def create_user(app):
    def _create(
        username: str,
        role: RoleCode = RoleCode.MANAGER,
        *,
        password: str = DEFAULT_PASSWORD,
        status: UserStatus = UserStatus.ACTIVE,
        email=_AUTO,
        full_name: str | None = None,
    ) -> int:
        with app.app_context():
            user = User(
                username=username,
                email=f"{username}@neko.edu.vn" if email is _AUTO else email,
                password_hash=hash_password(password),
                full_name=full_name or f"User {username}",
                role=db.session.scalar(select(Role).where(Role.code == role)),
                status=status,
            )
            db.session.add(user)
            db.session.commit()
            return user.id

    return _create


@pytest.fixture
def create_staff(app, create_user):
    def _create(username: str, position: StaffPosition, staff_code: str, **user_kwargs) -> int:
        user_id = create_user(username, RoleCode(position.value), **user_kwargs)
        with app.app_context():
            db.session.add(
                StaffProfile(
                    user_id=user_id,
                    staff_code=staff_code,
                    position=position,
                    rate_per_session=250000,
                    hire_date=date(2025, 1, 1),
                )
            )
            db.session.commit()
        return user_id

    return _create


@pytest.fixture
def users(create_user, create_staff) -> dict[str, int]:
    """Bộ tài khoản chuẩn: mỗi role một người."""
    return {
        "manager": create_staff("mg01", StaffPosition.MANAGER, "MG01"),
        "lecturer": create_staff("gv01", StaffPosition.LECTURER, "GV01"),
        "assistant": create_staff("tg01", StaffPosition.TEACHING_ASSISTANT, "TG01"),
        "student": create_user("hs001", RoleCode.STUDENT_PARENT, email=None),
    }
