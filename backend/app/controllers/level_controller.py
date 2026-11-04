from flask import request
from flask_jwt_extended import current_user

from app.services import level_service


def list_levels():
    return level_service.list_levels()


def update_level(level_id: int, payload: dict):
    return level_service.update_level(
        level_id,
        payload,
        actor=current_user,
        ip_address=request.remote_addr,
    )
