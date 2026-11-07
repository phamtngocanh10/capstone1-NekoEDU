from flask import request
from flask_jwt_extended import current_user

from app.services import session_service


def list_sessions(query: dict):
    return session_service.list_sessions(actor=current_user, **query)


def get_session(session_id: int):
    return session_service.get_session(session_id, actor=current_user)


def create_exception_session(class_id: int, payload: dict):
    return session_service.create_exception_session(
        class_id, payload, actor=current_user, ip_address=request.remote_addr
    )


def update_exception_session(session_id: int, payload: dict):
    return session_service.update_exception_session(
        session_id, payload, actor=current_user, ip_address=request.remote_addr
    )


def cancel_session(session_id: int, payload: dict):
    return session_service.cancel_session(
        session_id,
        payload["reason"].strip(),
        actor=current_user,
        ip_address=request.remote_addr,
    )


def complete_session(session_id: int):
    return session_service.complete_session(
        session_id, actor=current_user, ip_address=request.remote_addr
    )
