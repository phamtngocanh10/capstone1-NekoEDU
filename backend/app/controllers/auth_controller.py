from flask import request
from flask_jwt_extended import current_user

from app.services import auth_service


def login(payload: dict) -> dict:
    return auth_service.authenticate(
        identifier=payload["username"],
        password=payload["password"],
        ip_address=request.remote_addr,
    )


def get_me():
    # current_user đã được middleware auth_required nạp từ DB
    return current_user
