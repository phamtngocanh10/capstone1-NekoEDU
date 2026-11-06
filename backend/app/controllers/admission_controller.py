from flask import request
from flask_jwt_extended import current_user

from app.services import admission_service


def list_admission_leads(query: dict):
    return admission_service.list_admission_leads(**query)


def create_admission_lead(payload: dict):
    return admission_service.create_admission_lead(
        payload, actor=current_user, ip_address=request.remote_addr
    )


def update_admission_lead(lead_id: int, payload: dict):
    return admission_service.update_admission_lead(
        lead_id, payload, actor=current_user, ip_address=request.remote_addr
    )


def convert_admission_lead(lead_id: int, payload: dict):
    return admission_service.convert_admission_lead(
        lead_id, payload, actor=current_user, ip_address=request.remote_addr
    )
