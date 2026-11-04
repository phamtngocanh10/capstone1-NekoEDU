from flask_smorest import Blueprint

from app.controllers import class_controller
from app.middlewares.auth import auth_required
from app.models import STAFF_ROLES, RoleCode
from app.schemas.class_schema import ClassStaffAssignmentSchema, ClassStaffResponseSchema
from app.schemas.common_schema import ErrorSchema

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
