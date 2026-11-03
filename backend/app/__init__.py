import logging
import os
from pathlib import Path

from flask import Flask

from app import models  # noqa: F401  (nạp model để Flask-Migrate nhận diện)
from app.commands import register_commands
from app.common.errors import register_error_handlers
from app.config import config_by_name
from app.extensions import api, cors, db, migrate
from app.routers import register_routers

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def create_app(config_name: str | None = None) -> Flask:
    """Application factory: tạo và cấu hình Flask app.

    Luồng xử lý request: router -> controller -> service -> model
    """
    config_name = config_name or os.getenv("APP_ENV", "development")
    config_class = config_by_name.get(config_name)
    if config_class is None:
        raise ValueError(
            f"APP_ENV không hợp lệ: {config_name!r}. Chọn một trong: {', '.join(config_by_name)}"
        )

    app = Flask(__name__)
    app.config.from_object(config_class)
    _validate_config(app)
    # Trả tiếng Việt nguyên dạng trong JSON thay vì \uXXXX
    app.json.ensure_ascii = False

    logging.basicConfig(
        level=app.config["LOG_LEVEL"],
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    db.init_app(app)
    migrate.init_app(app, db, directory=str(MIGRATIONS_DIR))
    api.init_app(app)

    register_routers(api)
    register_error_handlers(app)
    register_commands(app)

    return app


def _validate_config(app: Flask) -> None:
    missing = [
        env_name
        for config_key, env_name in (
            ("SECRET_KEY", "SECRET_KEY"),
            ("SQLALCHEMY_DATABASE_URI", "DATABASE_URL"),
        )
        if not app.config.get(config_key)
    ]
    if missing:
        raise RuntimeError(f"Thiếu cấu hình: {', '.join(missing)} (xem .env.example).")
