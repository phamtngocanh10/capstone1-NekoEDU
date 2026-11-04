from flask import request
from flask_jwt_extended import current_user

from app.services import staff_service


def list_staff(query: dict) -> list:
    return staff_service.list_staff(actor=current_user, **query)


def create_staff(payload: dict):
    return staff_service.create_staff(
        payload,
        actor=current_user,
        ip_address=request.remote_addr,
    )


def get_staff(staff_id: int):
    return staff_service.get_staff_detail(staff_id)


def update_staff(staff_id: int, payload: dict):
    return staff_service.update_staff(
        staff_id,
        payload,
        actor=current_user,
        ip_address=request.remote_addr,
    )
