"""Lệnh CLI của dự án (chạy bằng `flask <lệnh>`)."""

from pathlib import Path

import click
import psycopg
from flask import Flask, current_app

from app.extensions import db

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SEED_FILE = BACKEND_DIR / "seeds" / "03_seed.sql"


def run_sql_script(sql: str) -> None:
    """Chạy nguyên một file SQL nhiều câu lệnh.

    Dùng psycopg trực tiếp (autocommit) vì file seed tự quản lý transaction (BEGIN/COMMIT)
    và có ký tự '%' trong dữ liệu, không chạy qua SQLAlchemy được.
    """
    conninfo = db.engine.url.set(drivername="postgresql").render_as_string(hide_password=False)
    with psycopg.connect(conninfo, autocommit=True) as conn:
        conn.execute(sql)


def register_commands(app: Flask) -> None:
    @app.cli.command("seed")
    @click.option(
        "--file",
        "file_path",
        type=click.Path(exists=True, dir_okay=False, path_type=Path),
        default=DEFAULT_SEED_FILE,
        show_default=True,
        help="File SQL dữ liệu mẫu",
    )
    @click.option("--yes", is_flag=True, help="Không hỏi xác nhận")
    def seed(file_path: Path, yes: bool):
        """Nạp dữ liệu mẫu. CẢNH BÁO: xóa toàn bộ dữ liệu hiện có trước khi nạp."""
        if current_app.config["ENV_NAME"] == "production":
            raise click.ClickException("Không được chạy seed trên môi trường production.")

        db_name = db.engine.url.database
        if not yes:
            click.confirm(
                f"Toàn bộ dữ liệu trong database '{db_name}' sẽ bị XÓA và nạp lại từ "
                f"{file_path.name}. Tiếp tục?",
                abort=True,
            )

        try:
            run_sql_script(file_path.read_text(encoding="utf-8"))
        except psycopg.errors.UndefinedTable as exc:
            raise click.ClickException(
                f"Chưa có bảng trong database, hãy chạy `flask db upgrade` trước. ({exc})"
            ) from exc

        click.echo(f"Đã nạp dữ liệu mẫu vào database '{db_name}'.")
