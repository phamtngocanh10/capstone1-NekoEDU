from datetime import datetime, timezone

from flask import current_app


def get_health_status() -> dict:
    return {
        "status": "ok",
        "service": current_app.config["API_TITLE"],
        "version": current_app.config["API_VERSION"],
        "environment": current_app.config["ENV_NAME"],
        "timestamp": datetime.now(timezone.utc),
    }
