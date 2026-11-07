from flask_smorest import Blueprint

from app.controllers import class_controller
from app.controllers import assessment_controller
from app.middlewares.auth import auth_required
from app.models import STAFF_ROLES, RoleCode
from app.schemas.class_schema import ClassStaffAssignmentSchema, ClassStaffResponseSchema
from app.schemas.common_schema import ErrorSchema
from app.schemas.schedule_schema import (
    ClassScheduleInputSchema,
    ClassScheduleListSchema,
    ClassScheduleSchema,
)
from app.controllers import schedule_controller
from app.schemas.session_schema import (
    ClassSessionSchema,
    SessionCreateSchema,
    SessionGenerationInputSchema,
    SessionGenerationResultSchema,
)
from app.controllers import session_controller

router = Blueprint("classes", __name__, description="Quản lý lớp học")


@router.route("/<int:class_id>/staff", methods=["GET"])
@auth_required(*STAFF_ROLES)
@router.response(200, ClassStaffResponseSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không được phân công vào lớp")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy lớp")
def get_staff_assignment(class_id):
    """Xem phân công của lớp trong phạm vi được giao"""
    return class_controller.get_staff_assignment(class_id)


@router.route("/<int:class_id>/staff", methods=["PATCH"])
@auth_required(RoleCode.MANAGER)
@router.arguments(ClassStaffAssignmentSchema)
@router.response(200, ClassStaffResponseSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy lớp hoặc nhân sự")
@router.alt_response(409, schema=ErrorSchema, description="Phân công không hợp lệ")
def assign_staff(payload, class_id):
    """Phân công giảng viên chính và trợ giảng cho lớp"""
    return class_controller.assign_staff(class_id, payload)


@router.route("/<int:class_id>/schedules", methods=["GET"])
@auth_required()
@router.response(200, ClassScheduleListSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không có quyền xem lớp")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy lớp")
def list_class_schedules(class_id):
    """Danh sách lịch định kỳ trong phạm vi lớp được phép"""
    return schedule_controller.list_class_schedules(class_id)


@router.route("/<int:class_id>/schedules", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(ClassScheduleInputSchema)
@router.response(201, ClassScheduleSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy lớp/phòng")
@router.alt_response(409, schema=ErrorSchema, description="Lịch hoặc phòng không hợp lệ")
def create_class_schedule(payload, class_id):
    """Tạo lịch học định kỳ cho lớp"""
    return schedule_controller.create_class_schedule(class_id, payload)


@router.route("/<int:class_id>/sessions/generate", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(SessionGenerationInputSchema)
@router.response(201, SessionGenerationResultSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy lớp")
@router.alt_response(409, schema=ErrorSchema, description="Không thể sinh buổi")
def generate_class_sessions(payload, class_id):
    """Sinh idempotent các buổi học từ lịch định kỳ trong khoảng ngày của lớp"""
    return schedule_controller.generate_class_sessions(class_id, payload)


@router.route("/<int:class_id>/sessions", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(SessionCreateSchema)
@router.response(201, ClassSessionSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy lớp/phòng/nhân sự")
@router.alt_response(409, schema=ErrorSchema, description="Buổi học hoặc tài nguyên xung đột")
def create_exception_session(payload, class_id):
    """Tạo buổi học ngoại lệ hoặc học bù"""
    return session_controller.create_exception_session(class_id, payload)


@router.route("/<int:class_id>/results/export", methods=["GET"])
@auth_required(RoleCode.MANAGER, RoleCode.LECTURER)
def export_class_results(class_id):
    """Xuất Excel tất cả đợt đánh giá của lớp"""
    return assessment_controller.export_class_results(class_id)
