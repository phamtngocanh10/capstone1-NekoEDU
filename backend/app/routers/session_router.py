from flask_smorest import Blueprint

from app.controllers import session_controller
from app.controllers import attendance_controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.common_schema import ErrorSchema
from app.schemas.attendance_schema import AttendanceBulkInputSchema, SessionAttendanceListSchema
from app.schemas.session_schema import (
    ClassSessionSchema,
    SessionListSchema,
    SessionQuerySchema,
    SessionCancelSchema,
    SessionUpdateSchema,
)

router = Blueprint("sessions", __name__, description="Quản lý buổi học")


@router.route("", methods=["GET"])
@auth_required()
@router.arguments(SessionQuerySchema, location="query")
@router.response(200, SessionListSchema)
@router.alt_response(401, schema=ErrorSchema, description="Chưa đăng nhập")
def list_sessions(query):
    """Danh sách buổi học theo bộ lọc và phạm vi người dùng"""
    return session_controller.list_sessions(query)


@router.route("/<int:session_id>", methods=["GET"])
@auth_required()
@router.response(200, ClassSessionSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không có quyền xem buổi học")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy buổi học")
def get_session(session_id):
    """Chi tiết buổi học trong phạm vi được phép"""
    return session_controller.get_session(session_id)


@router.route("/<int:session_id>", methods=["PATCH"])
@auth_required(RoleCode.MANAGER)
@router.arguments(SessionUpdateSchema)
@router.response(200, ClassSessionSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy buổi/phòng/nhân sự")
@router.alt_response(409, schema=ErrorSchema, description="Buổi học hoặc tài nguyên xung đột")
def update_exception_session(payload, session_id):
    """Cập nhật buổi học ngoại lệ khi còn SCHEDULED"""
    return session_controller.update_exception_session(session_id, payload)


@router.route("/<int:session_id>/cancel", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(SessionCancelSchema)
@router.response(200, ClassSessionSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy buổi học")
@router.alt_response(409, schema=ErrorSchema, description="Buổi học không thể hủy")
def cancel_session(payload, session_id):
    """Hủy buổi học, lưu lý do và actor, không tạo điểm danh vắng"""
    return session_controller.cancel_session(session_id, payload)


@router.route("/<int:session_id>/complete", methods=["POST"])
@auth_required(RoleCode.MANAGER, RoleCode.LECTURER)
@router.response(200, ClassSessionSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không phải giảng viên của buổi/lớp")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy buổi học")
@router.alt_response(409, schema=ErrorSchema, description="Buổi chưa thể hoàn thành")
def complete_session(session_id):
    """Hoàn thành buổi đã diễn ra sau khi đủ điểm danh"""
    return session_controller.complete_session(session_id)


@router.route("/<int:session_id>/attendances", methods=["GET"])
@auth_required()
@router.response(200, SessionAttendanceListSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không có quyền xem điểm danh")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy buổi học")
def list_session_attendances(session_id):
    """Roster và điểm danh theo enrollment có hiệu lực tại ngày của buổi"""
    return attendance_controller.list_session_attendances(session_id)


@router.route("/<int:session_id>/attendances", methods=["PUT"])
@auth_required(
    RoleCode.MANAGER,
    RoleCode.LECTURER,
    RoleCode.TEACHING_ASSISTANT,
)
@router.arguments(AttendanceBulkInputSchema)
@router.response(200, SessionAttendanceListSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không được phân công vào buổi/lớp")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy buổi học")
@router.alt_response(409, schema=ErrorSchema, description="Điểm danh không hợp lệ hoặc đã tồn tại")
def record_bulk_attendances(payload, session_id):
    """Ghi điểm danh hàng loạt theo roster, toàn bộ hoặc không dòng nào"""
    return attendance_controller.record_bulk_attendances(session_id, payload)
