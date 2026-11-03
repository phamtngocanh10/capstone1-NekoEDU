"""Migration và dữ liệu seed."""

from flask_migrate import check, downgrade, upgrade
from sqlalchemy import func, inspect, select

from app.extensions import db
from app.models import User


def test_models_match_database_schema(app):
    # Tương đương `flask db check`: model khai báo lệch với schema thì test fail
    with app.app_context():
        check()


def test_migration_can_downgrade_and_upgrade(app):
    with app.app_context():
        downgrade(revision="base")
        assert inspect(db.engine).get_table_names() == ["alembic_version"]

        upgrade()
        assert len(inspect(db.engine).get_table_names()) == 28  # 27 bảng + alembic_version


def test_seed_command_loads_sample_data(app):
    result = app.test_cli_runner().invoke(args=["seed", "--yes"])

    assert result.exit_code == 0, result.output
    with app.app_context():
        assert db.session.scalar(select(func.count()).select_from(User)) == 185


def test_seed_command_asks_for_confirmation(app, create_user):
    create_user("mg01")

    result = app.test_cli_runner().invoke(args=["seed"], input="n\n")

    assert result.exit_code != 0
    with app.app_context():
        assert db.session.scalar(select(func.count()).select_from(User)) == 1
