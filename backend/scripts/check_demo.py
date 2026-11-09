"""Read-only SQL Server/local-demo diagnostics; never logs secrets or signs in."""
from __future__ import annotations

from importlib.metadata import version
import json
import os
from pathlib import Path
import re
import sys
from time import perf_counter
from zoneinfo import ZoneInfo

from dotenv import dotenv_values
from sqlalchemy import create_engine, text

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from scripts.prepare_database import expected_schema, scripts


def main() -> int:
    config = dotenv_values(BACKEND / ".env")
    if not config.get("DATABASE_URL"):
        raise RuntimeError("Missing local DATABASE_URL")
    inherited_matches = os.environ.get("DATABASE_URL") in (None, config["DATABASE_URL"])
    import_started = perf_counter()
    from app import create_app
    import_seconds = perf_counter() - import_started
    factory_started = perf_counter()
    app = create_app("development")
    actual_url = app.config["SQLALCHEMY_DATABASE_URI"]
    print(json.dumps({
        "inherited_database_url_matches_file_or_unset": inherited_matches,
        "app_database_url_matches_file": actual_url == config["DATABASE_URL"],
        "timezone": str(ZoneInfo("Asia/Ho_Chi_Minh")),
        "tzdata": version("tzdata"),
        "app_import_seconds": round(import_seconds, 3),
        "app_factory_seconds": round(perf_counter() - factory_started, 3),
    }), flush=True)
    if not inherited_matches or actual_url != config["DATABASE_URL"]:
        raise RuntimeError("Application URL differs from the local demo configuration")

    # Bound the connection attempt for diagnosis; use the app's exact URL/dialect/options.
    started = perf_counter()
    engine = create_engine(actual_url, pool_pre_ping=True, fast_executemany=True,
                           connect_args={"timeout": 5}, hide_parameters=True)
    print("Connecting through SQLAlchemy (5 second login timeout)...", flush=True)
    with engine.connect() as connection:
        identity = connection.execute(text("SELECT DB_NAME(), CAST(SERVERPROPERTY('InstanceName') AS nvarchar(100))")).one()
        if identity[0].casefold() != "neko_edu":
            raise RuntimeError("Unexpected database; refusing demo checks")
        if identity[1] != "SQLEXPRESS":
            raise RuntimeError("Unexpected SQL instance; refusing demo checks")
        revision = connection.execute(text("SELECT version_num FROM dbo.alembic_version")).scalar_one()
        if revision != scripts().get_current_head():
            raise RuntimeError("Unexpected migration revision")
        print(json.dumps({"database": identity[0], "instance": identity[1],
                          "revision": revision, "connect_seconds": round(perf_counter() - started, 3)}), flush=True)
        table_names = connection.execute(text("SELECT name FROM sys.tables WHERE is_ms_shipped = 0 AND SCHEMA_NAME(schema_id) = 'dbo' AND name <> 'sysdiagrams' ORDER BY name")).scalars().all()
        counts = {name: connection.execute(text(f"SELECT COUNT_BIG(*) FROM dbo.[{name.replace(']', ']]')}]")).scalar_one()
                  for name in table_names}
        print(json.dumps({"table_count": len(table_names), "rows": counts}), flush=True)
        foreign_keys = connection.execute(text("SELECT name, is_disabled, is_not_trusted FROM sys.foreign_keys")).all()
        bad_foreign_keys = sum(bool(row[1] or row[2]) for row in foreign_keys)
        expected_tables, expected_foreign_keys = expected_schema()
        missing_tables = sorted(expected_tables - set(table_names))
        unexpected_tables = sorted(set(table_names) - expected_tables)
        missing_foreign_keys = sorted(expected_foreign_keys - {row[0] for row in foreign_keys})
        print(json.dumps({"foreign_keys": len(foreign_keys), "disabled_or_untrusted_foreign_keys": bad_foreign_keys,
                          "missing_tables": missing_tables, "unexpected_tables": unexpected_tables,
                          "missing_foreign_keys": missing_foreign_keys}), flush=True)
        if missing_tables or unexpected_tables or missing_foreign_keys or bad_foreign_keys:
            raise RuntimeError("Unexpected schema/FK state")
        password_hashes = connection.execute(text("SELECT TOP 3 password_hash FROM users ORDER BY id")).scalars().all()
        for password_hash in password_hashes:
            if not isinstance(password_hash, str) or not re.fullmatch(r"\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}", password_hash):
                raise RuntimeError("Account password hash is not bcrypt")
        print(json.dumps({"bcrypt_format_samples_checked": len(password_hashes),
                          "bcrypt_format_valid": True}), flush=True)
    engine.dispose()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        # SQL errors may contain connection secrets/bound values: output type only.
        print(f"FAIL: {type(error).__name__}; inspect locally; secrets omitted.", file=sys.stderr)
        raise SystemExit(1)
