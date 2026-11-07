from flask import request, send_file
from flask_jwt_extended import current_user

from app.services import assessment_service


def create_assessment(payload: dict):
    return assessment_service.create_assessment(
        payload, actor=current_user, ip_address=request.remote_addr
    )


def list_assessments(query: dict):
    return assessment_service.list_assessments(query, actor=current_user)


def get_assessment(assessment_id: int):
    return assessment_service.get_assessment(assessment_id, actor=current_user)


def update_assessment(assessment_id: int, payload: dict):
    return assessment_service.update_assessment(
        assessment_id, payload, actor=current_user, ip_address=request.remote_addr
    )


def list_assessment_results(assessment_id: int):
    return assessment_service.list_assessment_results(assessment_id, actor=current_user)


def record_assessment_results(assessment_id: int, payload: dict):
    return assessment_service.record_assessment_results(
        assessment_id,
        payload["items"],
        actor=current_user,
        ip_address=request.remote_addr,
    )


def preview_result_import(assessment_id: int):
    return assessment_service.preview_result_import(
        assessment_id,
        uploaded_file=request.files.get("file"),
        mode=request.form.get("mode", "CREATE_ONLY"),
        actor=current_user,
    )


def confirm_result_import(assessment_id: int, payload: dict):
    return assessment_service.confirm_result_import(
        assessment_id,
        preview_id=payload["preview_id"],
        actor=current_user,
        ip_address=request.remote_addr,
    )


def publish_assessment(assessment_id: int):
    return assessment_service.set_assessment_publication(
        assessment_id,
        publish=True,
        actor=current_user,
        ip_address=request.remote_addr,
    )


def unpublish_assessment(assessment_id: int):
    return assessment_service.set_assessment_publication(
        assessment_id,
        publish=False,
        actor=current_user,
        ip_address=request.remote_addr,
    )


def list_student_results(student_id: int):
    return assessment_service.list_student_results(student_id, actor=current_user)


def export_assessment_results(assessment_id: int):
    stream, filename = assessment_service.export_assessment_results(
        assessment_id, actor=current_user
    )
    return send_file(
        stream,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def export_class_results(class_id: int):
    stream, filename = assessment_service.export_class_results(
        class_id, actor=current_user
    )
    return send_file(
        stream,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
