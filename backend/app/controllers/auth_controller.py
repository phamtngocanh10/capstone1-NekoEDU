from flask import request
from flask_jwt_extended import current_user, get_jwt

from app.services import auth_service


def login(payload: dict) -> dict:
    return auth_service.authenticate(
        identifier=payload["username"],
        password=payload["password"],
        ip_address=request.remote_addr,
    )


def get_me():
    # current_user đã được middleware auth_required nạp từ DB
    return auth_service.get_current_user(current_user)


def logout():
    claims = get_jwt()
    auth_service.logout(
        current_user,
        jti=claims["jti"],
        expires_at=claims["exp"],
        ip_address=request.remote_addr,
    )
    return "", 204


def change_password(payload: dict):
    auth_service.change_password(
        current_user,
        current_password=payload["current_password"],
        new_password=payload["new_password"],
        ip_address=request.remote_addr,
    )
    return "", 204
