"""Lệnh CLI của dự án (chạy bằng `flask <lệnh>`)."""

from pathlib import Path

import click
import pyodbc
from flask import Flask, current_app

from app.common.security import hash_password
from app.extensions import db

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SEED_FILE = BACKEND_DIR / "seeds" / "03_seed.sql"


def run_sql_script(sql: str) -> None:
    """Chạy nguyên một file SQL nhiều câu lệnh.

    Dùng DBAPI cursor của pyodbc vì file seed là một T-SQL batch tự quản lý transaction.
    """
    connection = db.engine.raw_connection()
    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute(sql)
        while cursor.nextset():
            pass
        connection.commit()
        # SET options are scoped to the pooled SQL Server connection.
        cursor.execute("SET NOCOUNT OFF")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        if cursor is not None:
            cursor.close()
        connection.close()


def register_commands(app: Flask) -> None:
    @app.cli.command('process-pending-work')
    @click.option('--watch', is_flag=True, help='Theo dõi liên tục khi chạy demo')
    @click.option('--interval', type=click.IntRange(min=5, max=3600), default=30, show_default=True)
    def process_pending_work(watch, interval):
        """Phát hành điểm, nhắc hạn và gửi thông báo nội bộ đã đến giờ."""
        import json
        import time
        from app.services.lecturer_service import process_deadlines
        from app.services.operations_service import process_due_announcements
        while True:
            try:
                grades = process_deadlines()
                announcements = process_due_announcements()
                if not watch or any(grades.values()) or any(announcements.values()):
                    click.echo(json.dumps({'grades': grades, 'announcements': announcements}, ensure_ascii=False))
                if announcements['failed'] and not watch:
                    raise click.ClickException('Có thông báo đến hạn chưa xử lý được; xem các mã ở trên.')
            except Exception as error:
                db.session.rollback()
                if not watch:
                    raise
                current_app.logger.error('Pending-work processing failed: %s', type(error).__name__)
            finally:
                db.session.remove()
            if not watch:
                return
            time.sleep(interval)

    @app.cli.command('process-pending-work')
    @click.option('--watch', is_flag=True, help='Theo dõi liên tục khi chạy demo')
    @click.option('--interval', type=click.IntRange(min=5, max=3600), default=30, show_default=True)
    def process_pending_work(watch, interval):
        """Phát hành điểm, nhắc hạn và gửi thông báo nội bộ đã đến giờ."""
        import json
        import time
        from app.services.lecturer_service import process_deadlines
        from app.services.operations_service import process_due_announcements
        while True:
            try:
                grades = process_deadlines()
                announcements = process_due_announcements()
                if not watch or any(grades.values()) or any(announcements.values()):
                    click.echo(json.dumps({'grades': grades, 'announcements': announcements}, ensure_ascii=False))
                if announcements['failed'] and not watch:
                    raise click.ClickException('Có thông báo đến hạn chưa xử lý được; xem các mã ở trên.')
            except Exception as error:
                db.session.rollback()
                if not watch:
                    raise
                current_app.logger.error('Pending-work processing failed: %s', type(error).__name__)
            finally:
                db.session.remove()
            if not watch:
                return
            time.sleep(interval)

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
            sql = file_path.read_text(encoding="utf-8").replace(
                "__PW__", hash_password("Neko@2026")
            )
            run_sql_script(sql)
        except pyodbc.Error:
            raise click.ClickException(
                "Không thể nạp seed. Hãy kiểm tra database và chạy `flask db upgrade` trước. "
                "Chi tiết kết nối và dữ liệu SQL đã được ẩn."
            ) from None

        click.echo(f"Đã nạp dữ liệu mẫu vào database '{db_name}'.")
