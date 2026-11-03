import logging
import os

from flask import Flask

from app.common.errors import register_error_handlers
from app.config import config_by_name
from app.extensions import api, cors
from app.routers import register_routers


def create_app(config_name: str | None = None) -> Flask:
    """Application factory: tạo và cấu hình Flask app.

    Luồng xử lý request: router -> controller -> service
    """
    config_name = config_name or os.getenv("APP_ENV", "development")
    config_class = config_by_name.get(config_name)
    if config_class is None:
        raise ValueError(
            f"APP_ENV không hợp lệ: {config_name!r}. Chọn một trong: {', '.join(config_by_name)}"
        )

    app = Flask(__name__)
    app.config.from_object(config_class)

    if not app.config.get("SECRET_KEY"):
        raise RuntimeError("SECRET_KEY chưa được cấu hình (xem .env.example).")

    logging.basicConfig(
        level=app.config["LOG_LEVEL"],
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    api.init_app(app)

    register_routers(api)
    register_error_handlers(app)

    return app
