from flask_smorest import Blueprint

from app.controllers import attendance_controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.attendance_schema import (
    AttendanceDetailSchema,
    AttendanceHistoryListSchema,
    AttendanceReportQuerySchema,
    AttendanceReportSchema,
    AttendanceUpdateSchema,
)
from app.schemas.common_schema import ErrorSchema

router = Blueprint("attendances", __name__, description="Quản lý điểm danh")


@router.route("/report", methods=["GET"])
@auth_required()
@router.arguments(AttendanceReportQuerySchema, location="query")
@router.response(200, AttendanceReportSchema)
@router.alt_response(403, schema=ErrorSchema, description="Ngoài phạm vi được xem")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy lớp/học sinh")
def get_attendance_report(query):
    """Thống kê từ attendance gốc; bản ghi chưa điểm danh không bị tính là vắng"""
    return attendance_controller.get_attendance_report(query)


@router.route("/<int:attendance_id>", methods=["PATCH"])
@auth_required(
    RoleCode.MANAGER,
    RoleCode.LECTURER,
    RoleCode.TEACHING_ASSISTANT,
)
@router.arguments(AttendanceUpdateSchema)
@router.response(200, AttendanceDetailSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không được phân công vào buổi/lớp")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy điểm danh")
@router.alt_response(409, schema=ErrorSchema, description="Điểm danh không thể sửa")
def update_attendance(payload, attendance_id):
    """Sửa điểm danh có reason, history và audit trong cùng transaction"""
    return attendance_controller.update_attendance(attendance_id, payload)


@router.route("/<int:attendance_id>/history", methods=["GET"])
@auth_required()
@router.response(200, AttendanceHistoryListSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không có quyền xem điểm danh")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy điểm danh")
def list_attendance_history(attendance_id):
    """Lịch sử sửa điểm danh theo thứ tự thời gian, không thay thế dữ liệu gốc"""
    return attendance_controller.list_attendance_history(attendance_id)
