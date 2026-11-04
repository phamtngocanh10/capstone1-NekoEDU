from flask import request
from flask_jwt_extended import current_user

from app.services import class_service


def assign_staff(class_id: int, payload: dict):
    return class_service.assign_staff(
        class_id,
        lecturer_id=payload["lecturer_id"],
        assistant_id=payload.get("assistant_id"),
        actor=current_user,
        ip_address=request.remote_addr,
    )


def get_staff_assignment(class_id: int):
    return class_service.get_staff_assignment(class_id, actor=current_user)
