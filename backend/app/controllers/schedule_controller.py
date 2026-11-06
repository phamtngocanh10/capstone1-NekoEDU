from flask import request
from flask_jwt_extended import current_user

from app.services import schedule_service
from app.services import session_service


def list_class_schedules(class_id: int):
    return schedule_service.list_class_schedules(class_id, actor=current_user)


def create_class_schedule(class_id: int, payload: dict):
    return schedule_service.create_class_schedule(
        class_id, payload, actor=current_user, ip_address=request.remote_addr
    )


def update_class_schedule(schedule_id: int, payload: dict):
    return schedule_service.update_class_schedule(
        schedule_id, payload, actor=current_user, ip_address=request.remote_addr
    )


def delete_class_schedule(schedule_id: int):
    schedule_service.delete_class_schedule(
        schedule_id, actor=current_user, ip_address=request.remote_addr
    )
    return "", 204


def generate_class_sessions(class_id: int, payload: dict):
    return session_service.generate_class_sessions(
        class_id, payload, actor=current_user, ip_address=request.remote_addr
    )
