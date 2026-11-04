from flask import request
from flask_jwt_extended import current_user

from app.services import student_service


def list_students(query: dict):
    return student_service.list_students(actor=current_user, **query)


def create_student(payload: dict):
    return student_service.create_student(
        payload,
        actor=current_user,
        ip_address=request.remote_addr,
    )


def get_student(student_id: int):
    return student_service.get_student(student_id, actor=current_user)


def update_student(student_id: int, payload: dict):
    return student_service.update_student(
        student_id,
        payload,
        actor=current_user,
        ip_address=request.remote_addr,
    )
