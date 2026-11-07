from flask import request
from flask_jwt_extended import current_user

from app.services import assessment_service


def update_result(result_id: int, payload: dict):
    return assessment_service.update_result(
        result_id, payload, actor=current_user, ip_address=request.remote_addr
    )
