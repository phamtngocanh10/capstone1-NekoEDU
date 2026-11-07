from flask import request
from flask_jwt_extended import current_user

from app.services import attendance_service


def list_session_attendances(session_id: int):
    return attendance_service.list_session_attendances(session_id, actor=current_user)


def record_bulk_attendances(session_id: int, payload: dict):
    return attendance_service.record_bulk_attendances(
        session_id,
        payload["items"],
        actor=current_user,
        ip_address=request.remote_addr,
    )


def update_attendance(attendance_id: int, payload: dict):
    return attendance_service.update_attendance(
        attendance_id,
        payload,
        actor=current_user,
        ip_address=request.remote_addr,
    )


def list_attendance_history(attendance_id: int):
    return attendance_service.list_attendance_history(
        attendance_id,
        actor=current_user,
    )


def get_attendance_report(query: dict):
    return attendance_service.get_attendance_report(query, actor=current_user)
