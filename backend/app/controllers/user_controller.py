from flask import request
from flask_jwt_extended import current_user

from app.services import user_service


def list_users(query: dict) -> dict:
    return user_service.list_users(**query)


def get_user(user_id: int):
    return user_service.get_user(user_id)


def create_user(payload: dict):
    return user_service.create_user(
        payload,
        actor=current_user,
        ip_address=request.remote_addr,
    )


def update_user(user_id: int, payload: dict):
    return user_service.update_user(
        user_id,
        payload,
        actor=current_user,
        ip_address=request.remote_addr,
    )


def update_user_status(user_id: int, status: str):
    return user_service.update_user_status(
        user_id,
        status,
        actor=current_user,
        ip_address=request.remote_addr,
    )


def reset_user_password(user_id: int, new_password: str):
    user_service.reset_password(
        user_id,
        new_password,
        actor=current_user,
        ip_address=request.remote_addr,
    )
    return "", 204


def link_student(user_id: int, student_id: int, payload: dict):
    return user_service.link_student(
        user_id,
        student_id,
        relationship=payload["relationship"],
        can_view=payload["can_view"],
        actor=current_user,
        ip_address=request.remote_addr,
    )


def unlink_student(user_id: int, student_id: int):
    user_service.unlink_student(
        user_id,
        student_id,
        actor=current_user,
        ip_address=request.remote_addr,
    )
    return "", 204
