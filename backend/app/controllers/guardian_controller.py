from flask import request
from flask_jwt_extended import current_user

from app.services import guardian_service


def list_guardians(query: dict):
    return guardian_service.list_guardians(**query)


def get_guardian(guardian_id: int):
    return guardian_service.get_guardian(guardian_id)


def create_guardian(payload: dict):
    return guardian_service.create_guardian(
        payload, actor=current_user, ip_address=request.remote_addr
    )


def update_guardian(guardian_id: int, payload: dict):
    return guardian_service.update_guardian(
        guardian_id,
        payload,
        actor=current_user,
        ip_address=request.remote_addr,
    )
