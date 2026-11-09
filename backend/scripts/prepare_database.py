"""Inspect the demo DB or prepare isolated migration/test runs without leaking URLs.

The default command is read-only. ``upgrade`` always takes and verifies a new
COPY_ONLY backup before applying explicitly approved pending revision IDs.
Test commands create a fresh database and retain it for subsequent inspection.
"""
from __future__ import annotations

import argparse
import ast
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys

from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
LIVE_DATABASE = "NEKO_EDU"
LIVE_INSTANCE = "SQLEXPRESS"


class PreparationError(RuntimeError):
    """A deliberately safe, non-secret diagnostic."""


def report(event: str, **values) -> None:
    print(json.dumps({"event": event, **values}, ensure_ascii=False), flush=True)


def engine_for(url):
    return create_engine(url, pool_pre_ping=True, hide_parameters=True,
                         fast_executemany=True, connect_args={"timeout": 5})


def clone_database_url(url, database: str):
    """Clone an explicit URL or ODBC string without duplicate DB attributes.

    ODBC values may contain semicolons in braces and escape a closing brace as
    ``}}``. Keep every non-database attribute verbatim, including credentials.
    No connection string is returned in user-facing diagnostics.
    """
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,127}", database):
        raise PreparationError("Invalid target database identifier.")
    raw = url.query.get("odbc_connect")
    if raw is None:
        if not url.database:
            raise PreparationError("The configured URL has no explicit database.")
        return url.set(database=database)
    if not isinstance(raw, str):
        raise PreparationError("Multiple ODBC connection strings are ambiguous.")
    attributes = []
    database_positions = []
    position = 0
    while position < len(raw):
        while position < len(raw) and (raw[position].isspace() or raw[position] == ";"):
            position += 1
        if position == len(raw):
            break
        start = position
        while position < len(raw) and raw[position] not in "=;":
            position += 1
        if position == len(raw) or raw[position] != "=":
            raise PreparationError("Malformed ODBC connection attribute.")
        key = raw[start:position].strip()
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_ ]*", key):
            raise PreparationError("Malformed ODBC connection key.")
        position += 1
        while position < len(raw) and raw[position].isspace():
            position += 1
        if position < len(raw) and raw[position] == "{":
            position += 1
            closed = False
            while position < len(raw):
                if raw[position] == "}":
                    if position + 1 < len(raw) and raw[position + 1] == "}":
                        position += 2
                    else:
                        position += 1
                        closed = True
                        break
                else:
                    position += 1
            if not closed:
                raise PreparationError("Unclosed braced ODBC value.")
            while position < len(raw) and raw[position].isspace():
                position += 1
            if position < len(raw) and raw[position] != ";":
                raise PreparationError("Unexpected text after a braced ODBC value.")
        else:
            while position < len(raw) and raw[position] != ";":
                position += 1
        if key.casefold() in {"database", "initial catalog"}:
            database_positions.append(len(attributes))
            attributes.append(f"{key}={{{database}}}")
        else:
            attributes.append(raw[start:position])
    if len(database_positions) > 1:
        raise PreparationError("Multiple Database/Initial Catalog attributes are ambiguous.")
    if not database_positions:
        attributes.append(f"DATABASE={{{database}}}")
    query = dict(url.query)
    query["odbc_connect"] = ";".join(attributes) + ";"
    return url.set(database=database, query=query)


def identity(connection) -> dict:
    row = connection.execute(text(
        "SELECT DB_NAME(), CAST(SERVERPROPERTY('InstanceName') AS nvarchar(128)), "
        "CAST(SERVERPROPERTY('ServerName') AS nvarchar(128))"
    )).one()
    return {"database": row[0], "instance": row[1], "server": row[2]}


def require_identity(actual: dict, database: str, server: str | None = None) -> None:
    if actual["database"].casefold() != database.casefold():
        raise PreparationError("Unexpected database identity; no changes made.")
    if (actual["instance"] or "").casefold() != LIVE_INSTANCE.casefold():
        raise PreparationError("Unexpected SQL instance; no changes made.")
    if server is not None and actual["server"] != server:
        raise PreparationError("Unexpected SQL server; no changes made.")


def table_counts(connection) -> dict[str, int]:
    tables = connection.execute(text(
        "SELECT name FROM sys.tables WHERE is_ms_shipped = 0 "
        "AND schema_id = SCHEMA_ID('dbo') AND name <> 'sysdiagrams' ORDER BY name"
    )).scalars().all()
    return {name: connection.execute(text(
        f"SELECT COUNT_BIG(*) FROM dbo.[{name.replace(']', ']]')}]"
    )).scalar_one() for name in tables}


def financial_totals(connection) -> dict[str, int]:
    """Track legacy money columns; new invoice-detail rows are excluded."""
    columns = {
        "tuition_invoices": ("base_amount", "final_amount", "paid_amount"),
        "payments": ("amount",),
        "finance_transactions": ("amount",),
        "staff_payrolls": ("total_amount",),
    }
    totals = {}
    for table, names in columns.items():
        expressions = ", ".join(f"COALESCE(SUM([{name}]), 0)" for name in names)
        row = connection.execute(text(f"SELECT {expressions} FROM dbo.[{table}]")).one()
        totals.update({f"{table}.{name}": int(value) for name, value in zip(names, row)})
    return totals


def revision(connection) -> str | None:
    if not connection.execute(text(
        "SELECT OBJECT_ID(N'dbo.alembic_version', N'U')"
    )).scalar_one():
        return None
    versions = connection.execute(text("SELECT version_num FROM dbo.alembic_version")).scalars().all()
    if len(versions) != 1:
        raise PreparationError("Expected exactly one Alembic revision.")
    return versions[0]


def scripts() -> ScriptDirectory:
    config = AlembicConfig(str(BACKEND / "migrations/alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "migrations"))
    directory = ScriptDirectory.from_config(config)
    if len(directory.get_heads()) != 1:
        raise PreparationError("Expected one migration head; review migration branches first.")
    return directory


def expected_schema() -> tuple[set[str], set[str]]:
    """Read SQL and upgrade AST literals; never count downgrade-only objects."""
    sources = [(BACKEND / "migrations/sql/0001_initial_schema.sql").read_text(encoding="utf-8")]
    names = {"alembic_version"}
    for migration in (BACKEND / "migrations/versions").glob("*.py"):
        module = ast.parse(migration.read_text(encoding="utf-8"))
        for function in module.body:
            if not isinstance(function, (ast.FunctionDef, ast.AsyncFunctionDef)) or function.name != "upgrade":
                continue
            for node in ast.walk(function):
                if isinstance(node, ast.Constant) and isinstance(node.value, str):
                    sources.append(node.value)
                if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                        and node.func.attr == "create_table" and node.args
                        and isinstance(node.args[0], ast.Constant)
                        and isinstance(node.args[0].value, str)):
                    names.add(node.args[0].value)
    schema = "\n".join(sources)
    names.update(re.findall(r"CREATE\s+TABLE\s+(?:dbo\.)?\[?(\w+)", schema, re.I))
    foreign_keys = set(re.findall(r"CONSTRAINT\s+\[?(\w+)\]?\s+FOREIGN\s+KEY", schema, re.I))
    return names, foreign_keys


def expected_tables() -> set[str]:
    """Check SQL-managed tables too; most existing tables have no ORM model."""
    return expected_schema()[0]


def inspect_database(engine) -> dict:
    with engine.connect() as connection:
        actual = identity(connection)
        require_identity(actual, LIVE_DATABASE)
        return {**actual, "revision": revision(connection), "rows": table_counts(connection),
                "financial_totals": financial_totals(connection)}


def verify_database(engine, database: str, server: str, target: str,
                    previous: dict[str, int] | None = None,
                    previous_financial_totals: dict[str, int] | None = None) -> dict:
    with engine.connect() as connection:
        actual = identity(connection)
        require_identity(actual, database, server)
        current = revision(connection)
        counts = table_counts(connection)
        totals = financial_totals(connection)
        tables, expected_foreign_keys = expected_schema()
        missing = sorted(tables - counts.keys())
        actual_foreign_keys = set(connection.execute(text("SELECT name FROM sys.foreign_keys")).scalars())
        missing_foreign_keys = sorted(expected_foreign_keys - actual_foreign_keys)
        bad_foreign_keys = connection.execute(text(
            "SELECT COUNT_BIG(*) FROM sys.foreign_keys WHERE is_disabled = 1 OR is_not_trusted = 1"
        )).scalar_one()
        bad_checks = connection.execute(text(
            "SELECT COUNT_BIG(*) FROM sys.check_constraints WHERE is_disabled = 1 OR is_not_trusted = 1"
        )).scalar_one()
        shrunk = sorted(name for name, count in (previous or {}).items()
                        if name not in counts or counts[name] < count)
        changed_financial_totals = sorted(
            name for name in set(previous_financial_totals or {}) | set(totals)
            if previous_financial_totals is not None
            and previous_financial_totals.get(name) != totals.get(name)
        )
        if (current != target or missing or missing_foreign_keys or bad_foreign_keys
                or bad_checks or shrunk or changed_financial_totals):
            report("verification_failed", revision=current, expected_revision=target,
                   missing_tables=missing, missing_foreign_keys=missing_foreign_keys,
                   disabled_or_untrusted_foreign_keys=bad_foreign_keys,
                   disabled_or_untrusted_checks=bad_checks, tables_with_fewer_rows=shrunk,
                   changed_financial_totals=changed_financial_totals)
            raise PreparationError("Database verification failed; keep the backup and review the database.")
        return {**actual, "revision": current, "table_count": len(counts), "rows": counts,
                "financial_totals": totals,
                "disabled_or_untrusted_foreign_keys": bad_foreign_keys,
                "disabled_or_untrusted_checks": bad_checks}


def migrate(url, environment: str) -> None:
    # Set before importing app.config: its config classes read environment at import.
    os.environ["APP_ENV"] = environment
    key = "TEST_DATABASE_URL" if environment == "testing" else "DATABASE_URL"
    os.environ[key] = url.render_as_string(hide_password=False)
    from app import create_app
    from flask_migrate import upgrade
    app = create_app(environment)
    with app.app_context():
        upgrade(directory=str(BACKEND / "migrations"), revision="head")


def execute_autocommit(engine, sql: str, params: tuple = ()) -> None:
    # BACKUP/RESTORE cannot run in an implicit transaction. Consume all ODBC
    # result sets so SQL Server completes the operation before verification.
    raw = engine.raw_connection()
    cursor = None
    original_autocommit = raw.driver_connection.autocommit
    try:
        raw.driver_connection.autocommit = True
        cursor = raw.cursor()
        cursor.execute(sql, params)
        while cursor.nextset():
            pass
    finally:
        if cursor is not None:
            cursor.close()
        raw.driver_connection.autocommit = original_autocommit
        raw.close()


def backup_and_verify(engine, server: str) -> str:
    with engine.connect() as connection:
        require_identity(identity(connection), LIVE_DATABASE, server)
        folder = connection.execute(text(
            "SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000))"
        )).scalar_one()
    if not folder:
        raise PreparationError("SQL Server did not return its default backup directory.")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup = str(folder).rstrip("\\/") + f"\\{LIVE_DATABASE}_BeforeUpgrade_{stamp}_{secrets.token_hex(6)}.bak"
    report("backup_started", database=LIVE_DATABASE, backup_file=backup)
    execute_autocommit(engine, f"BACKUP DATABASE [{LIVE_DATABASE}] TO DISK = ? WITH COPY_ONLY, CHECKSUM", (backup,))
    execute_autocommit(engine, "RESTORE VERIFYONLY FROM DISK = ? WITH CHECKSUM", (backup,))
    report("backup_verified", database=LIVE_DATABASE, backup_file=backup)
    return backup


def prepare_test(live_url, server: str):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    name = f"NEKO_EDU_{stamp}_{secrets.token_hex(6)}_test"
    master = engine_for(clone_database_url(live_url, "master"))
    try:
        with master.connect() as connection:
            require_identity(identity(connection), "master", server)
            if connection.execute(text("SELECT DB_ID(:name)"), {"name": name}).scalar_one() is not None:
                raise PreparationError("Generated test database already exists; no database was reused.")
        execute_autocommit(master, f"CREATE DATABASE [{name}]")
    finally:
        master.dispose()
    report("test_database_created", database=name, retained=True)
    test_url = clone_database_url(live_url, name)
    test_engine = engine_for(test_url)
    try:
        with test_engine.connect() as connection:
            require_identity(identity(connection), name, server)
            if not name.endswith("_test") or table_counts(connection):
                raise PreparationError("New test database is not empty; refusing migration or tests.")
        migrate(test_url, "testing")
        report("test_database_verified", **verify_database(test_engine, name, server, scripts().get_current_head()))
    finally:
        test_engine.dispose()
    return name, test_url


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command")
    commands.add_parser("inspect", help="Read-only identity, revision and table counts (default)")
    commands.add_parser("prepare-test", help="Create, migrate and retain a unique isolated test DB")
    test_parser = commands.add_parser("test", help="Prepare an isolated DB and run pytest in it")
    test_parser.add_argument("--reuse-database", help="Reuse an existing disposable database created by this utility")
    test_parser.add_argument("pytest_args", nargs=argparse.REMAINDER)
    upgrade_parser = commands.add_parser("upgrade", help="Backup, verify and apply approved revisions to NEKO_EDU")
    upgrade_parser.add_argument("--expected-revision", default="0009")
    upgrade_parser.add_argument("--approved-revision", action="append", default=[],
                                help="An exact pending revision ID reviewed by the caller; repeat for each revision")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = dotenv_values(BACKEND / ".env")
    value = config.get("DATABASE_URL")
    if not value:
        raise PreparationError("Missing DATABASE_URL in backend/.env.")
    inherited = os.environ.get("DATABASE_URL")
    if inherited is not None and inherited != value:
        raise PreparationError("Inherited DATABASE_URL differs from backend/.env; resolve it before continuing.")
    live_url = make_url(value)
    if not live_url.drivername.startswith("mssql"):
        raise PreparationError("This utility requires Microsoft SQL Server.")
    live = engine_for(live_url)
    try:
        snapshot = inspect_database(live)
        report("live_database_inspected", **snapshot)
        command = args.command or "inspect"
        if command == "inspect":
            return 0
        if command in {"prepare-test", "test"}:
            reuse_name = getattr(args, "reuse_database", None)
            if reuse_name:
                if not re.fullmatch(r"NEKO_EDU_[0-9]{8}_[0-9]{6}_[0-9a-f]{12}_test", reuse_name):
                    raise PreparationError("Only a previously generated disposable test database can be reused.")
                name = reuse_name
                test_url = clone_database_url(live_url, name)
                reused_engine = engine_for(test_url)
                try:
                    report("test_database_reused", **verify_database(
                        reused_engine, name, snapshot["server"], scripts().get_current_head()))
                finally:
                    reused_engine.dispose()
            else:
                name, test_url = prepare_test(live_url, snapshot["server"])
            if command == "test":
                pytest_args = args.pytest_args
                if pytest_args[:1] == ["--"]:
                    pytest_args = pytest_args[1:]
                env = os.environ.copy()
                env["APP_ENV"] = "testing"
                env["TEST_DATABASE_URL"] = test_url.render_as_string(hide_password=False)
                report("pytest_started", database=name, retained=True)
                result = subprocess.run([sys.executable, "-m", "pytest", *pytest_args], cwd=BACKEND, env=env, check=False)
                report("pytest_finished", database=name, exit_code=result.returncode, retained=True)
                return result.returncode
            return 0
        directory = scripts()
        target = directory.get_current_head()
        if snapshot["revision"] == target:
            report("already_current", database=LIVE_DATABASE, revision=target)
            return 0
        if snapshot["revision"] != args.expected_revision:
            raise PreparationError("Live revision differs from --expected-revision; review it before upgrading.")
        pending = list(directory.iterate_revisions(target, snapshot["revision"]))
        pending_ids = {item.revision for item in pending}
        if pending_ids != set(args.approved_revision):
            report("migration_review_required", pending_revisions=sorted(pending_ids))
            raise PreparationError("Pass each reviewed pending revision with --approved-revision.")
        backup = backup_and_verify(live, snapshot["server"])
        # Verify identity/revision again after backup, before any migration DDL.
        latest = inspect_database(live)
        if latest["server"] != snapshot["server"] or latest["revision"] != snapshot["revision"]:
            raise PreparationError("Database identity/revision changed during backup; refusing migration.")
        report("migration_started", database=LIVE_DATABASE, pending_revisions=sorted(pending_ids), backup_file=backup)
        migrate(live_url, "development")
        report("live_database_verified", backup_file=backup,
               **verify_database(live, LIVE_DATABASE, snapshot["server"], target, latest["rows"],
                                 latest["financial_totals"]))
        return 0
    finally:
        live.dispose()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except PreparationError as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
    except Exception as error:
        # SQL/driver exceptions can contain connection strings and bound values.
        print(f"FAIL: {type(error).__name__}; connection details omitted. Review locally.", file=sys.stderr)
        raise SystemExit(1)
