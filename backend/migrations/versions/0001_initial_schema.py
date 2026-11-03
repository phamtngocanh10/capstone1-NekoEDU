"""Initial schema: 27 bảng từ 01_schema.sql của team Database

Revision ID: 0001
Revises:
Create Date: 2026-10-03

File SQL gốc: migrations/sql/0001_initial_schema.sql. KHÔNG sửa file này khi schema thay đổi;
mọi thay đổi sau đó phải tạo migration mới (flask db revision / flask db migrate).
"""

from pathlib import Path

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parent.parent / "sql" / "0001_initial_schema.sql"

# Thứ tự xóa ngược với thứ tự tạo (bảng phụ thuộc xóa trước)
TABLES = [
    "audit_logs",
    "policy_documents",
    "ai_alerts",
    "notifications",
    "finance_transactions",
    "finance_categories",
    "staff_payrolls",
    "receipts",
    "payments",
    "tuition_invoices",
    "student_discounts",
    "discount_policies",
    "student_requests",
    "attendances",
    "class_sessions",
    "class_enrollments",
    "class_schedules",
    "classes",
    "rooms",
    "courses",
    "admission_leads",
    "students",
    "levels",
    "guardians",
    "staff_profiles",
    "users",
    "roles",
]


def _execute_sql_script(sql: str) -> None:
    # Chạy bằng cursor của psycopg (không truyền tham số) để chạy được nhiều câu lệnh một lần
    # và ký tự '%' trong COMMENT không bị hiểu là placeholder.
    cursor = op.get_bind().connection.dbapi_connection.cursor()
    try:
        cursor.execute(sql)
    finally:
        cursor.close()


def upgrade():
    _execute_sql_script(SQL_FILE.read_text(encoding="utf-8"))


def downgrade():
    for table in TABLES:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
