"""Migration và dữ liệu seed."""

from flask_migrate import check, downgrade, upgrade
from sqlalchemy import func, inspect, select, text

from app.extensions import db
from app.models import User
from scripts.prepare_database import expected_schema, scripts


def test_models_match_database_schema(app):
    # Tương đương `flask db check`: model khai báo lệch với schema thì test fail
    with app.app_context():
        check()


def test_migration_can_downgrade_and_upgrade(app):
    with app.app_context():
        downgrade(revision="base")
        assert inspect(db.engine).get_table_names() == ["alembic_version"]

        upgrade()
        expected_tables, expected_foreign_keys = expected_schema()
        assert set(inspect(db.engine).get_table_names(schema="dbo")) == expected_tables
        assert db.session.execute(text("SELECT version_num FROM dbo.alembic_version")).scalar_one() == scripts().get_current_head()
        foreign_keys = set(db.session.execute(text("SELECT name FROM sys.foreign_keys")).scalars())
        assert expected_foreign_keys <= foreign_keys
        assert db.session.execute(text(
            "SELECT COUNT(*) FROM sys.foreign_keys WHERE is_disabled = 1 OR is_not_trusted = 1"
        )).scalar_one() == 0
        assert db.session.execute(text("SELECT COUNT(*) FROM dbo.course_groups")).scalar_one() == 3
        assert db.session.execute(text("SELECT COUNT(*) FROM dbo.permission_resources")).scalar_one() == 9


def test_seed_command_loads_sample_data(app, client):
    result = app.test_cli_runner().invoke(args=["seed", "--yes"])

    assert result.exit_code == 0, result.output
    with app.app_context():
        assert db.session.scalar(select(func.count()).select_from(User)) == 185
        assert db.session.execute(text("SELECT COUNT(*) FROM dbo.course_groups")).scalar_one() == 3
        assert db.session.execute(text("SELECT COUNT(*) FROM dbo.permission_resources")).scalar_one() == 9
        assert db.session.execute(text(
            "SELECT COUNT(*) FROM dbo.courses WHERE group_id IS NULL OR curriculum_level IS NULL"
        )).scalar_one() == 0
        assert db.session.execute(text(
            "SELECT COUNT(*) FROM dbo.tuition_invoice_items"
        )).scalar_one() == db.session.execute(text("SELECT COUNT(*) FROM dbo.tuition_invoices")).scalar_one()
        assert db.session.execute(text(
            "SELECT COUNT(*) FROM dbo.tuition_invoice_items item "
            "JOIN dbo.tuition_invoices invoice ON invoice.id = item.invoice_id "
            "WHERE item.amount <> invoice.base_amount OR item.item_type <> 'TUITION' OR item.line_no <> 1"
        )).scalar_one() == 0

    # Lệnh seed thay placeholder bằng BCrypt hash ($2b$), backend phải kiểm tra được
    res = client.post("/api/v1/auth/login", json={"username": "gv01@neko.edu.vn", "password": "Neko@2026"})
    assert res.status_code == 200


def test_seed_command_asks_for_confirmation(app, create_user):
    create_user("mg01")

    result = app.test_cli_runner().invoke(args=["seed"], input="n\n")

    assert result.exit_code != 0
    with app.app_context():
        assert db.session.scalar(select(func.count()).select_from(User)) == 1
