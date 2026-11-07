from flask import request
from flask_jwt_extended import current_user

from app.services import tuition_service


def generate_cycle(payload: dict):
    return tuition_service.generate_cycle(
        payload["enrollment_id"], actor=current_user, ip_address=request.remote_addr
    )


def get_cycle(cycle_id: int):
    return tuition_service.get_cycle(cycle_id, actor=current_user)


def issue_cycle(cycle_id: int):
    return tuition_service.issue_cycle(
        cycle_id, actor=current_user, ip_address=request.remote_addr
    )


def calculate_cycle(cycle_id: int):
    return tuition_service.calculate_cycle(
        cycle_id, actor=current_user, ip_address=request.remote_addr
    )


def create_sibling_relationship(student_id: int, payload: dict):
    return tuition_service.create_sibling_relationship(
        student_id, payload, actor=current_user, ip_address=request.remote_addr
    )


def create_manual_adjustment(cycle_id: int, payload: dict):
    return tuition_service.create_manual_adjustment(
        cycle_id, payload, actor=current_user, ip_address=request.remote_addr
    )


def list_student_cycles(student_id: int):
    return tuition_service.list_student_cycles(student_id, actor=current_user)


def list_adjustments(cycle_id: int):
    return tuition_service.list_adjustments(cycle_id, actor=current_user)


def create_policy(payload: dict):
    return tuition_service.create_policy(
        payload, actor=current_user, ip_address=request.remote_addr
    )


def list_policies():
    return tuition_service.list_policies()
