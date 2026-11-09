from datetime import date
from graphlib import TopologicalSorter
import os
import re

import pytest
from flask_jwt_extended import create_access_token
from flask_migrate import downgrade, upgrade
from sqlalchemy import inspect, select, text
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

STATIC_CATALOGS = {"course_groups", "permission_resources"}


@pytest.fixture(scope="session")
def app():
    app = create_app("testing")

    # Never use TestingConfig's fallback URL for a destructive test run.
    if not os.environ.get("TEST_DATABASE_URL"):
        pytest.exit("Cần đặt TEST_DATABASE_URL rõ ràng cho database test riêng.", returncode=1)
    db_name = make_url(app.config["SQLALCHEMY_DATABASE_URI"]).database or ""
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*_test", db_name, re.I):
        pytest.exit(
            f"TEST_DATABASE_URL phải trỏ tới database có tên kết thúc bằng _test (đang là {db_name!r}).",
            returncode=1,
        )

    with app.app_context():
        # Verify the actual target too; URL text alone cannot establish identity.
        with db.engine.connect() as connection:
            actual_name = connection.execute(text("SELECT DB_NAME()")).scalar_one()
        if actual_name.casefold() != db_name.casefold() or not actual_name.casefold().endswith("_test"):
            pytest.exit("Database thực tế không khớp database test đã cấu hình.", returncode=1)
        downgrade(revision="base")
        upgrade()

    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(scope="session")
def cleanup_plan(app):
    """Derive dependencies and identity columns once from the migrated schema."""
    with app.app_context():
        inspector = inspect(db.engine)
        tables = set(inspector.get_table_names(schema="dbo")) - {
            "alembic_version", "sysdiagrams", *STATIC_CATALOGS,
        }
        dependencies = {
            table: {
                fk["referred_table"] for fk in inspector.get_foreign_keys(table, schema="dbo")
                if fk["referred_table"] in tables and fk["referred_table"] != table
                and fk.get("referred_schema") in (None, "dbo")
            }
            for table in sorted(tables)
        }
        child_first = tuple(reversed(tuple(TopologicalSorter(dependencies).static_order())))
        identities = {
            table for table in tables
            if any(column.get("identity") is not None
                   for column in inspector.get_columns(table, schema="dbo"))
        }
        return child_first, identities


@pytest.fixture(autouse=True)
def reset_db(app, cleanup_plan):
    """Keep migration catalogs; reset mutable data and restore the four roles."""
    tables, identities = cleanup_plan
    with app.app_context():
        for table in tables:
            quoted = "[dbo].[" + table.replace("]", "]]") + "]"
            db.session.execute(text(f"DELETE FROM {quoted}"))
        for table in tables:
            if table in identities:
                quoted = "[dbo].[" + table.replace("]", "]]") + "]"
                literal = quoted.replace("'", "''")
                db.session.execute(text(f"DBCC CHECKIDENT ('{literal}', RESEED, 0) WITH NO_INFOMSGS"))
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


@pytest.fixture
def auth_header(app):
    """auth_header(user_id) -> {"Authorization": "Bearer <token>"}"""

    def _header(user_id: int, **token_kwargs) -> dict[str, str]:
        with app.app_context():
            user = db.session.get(User, user_id)
            token = create_access_token(
                identity=user,
                additional_claims={"ver": user.auth_version},
                **token_kwargs,
            )
        return {"Authorization": f"Bearer {token}"}

    return _header
