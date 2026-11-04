from flask_smorest import Blueprint

from app.controllers import user_controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.common_schema import ErrorSchema
from app.schemas.user_schema import (
    UserListSchema,
    UserQuerySchema,
    ResetPasswordSchema,
    UserSchema,
    UserStatusSchema,
    UserUpdateSchema,
    UserWriteSchema,
)
from app.schemas.student_schema import StudentLinkResponseSchema, StudentLinkSchema

router = Blueprint("users", __name__, description="Quản lý tài khoản (chỉ Manager)")


@router.route("", methods=["GET"])
@auth_required(RoleCode.MANAGER)
@router.arguments(UserQuerySchema, location="query")
@router.response(200, UserListSchema)
@router.alt_response(401, schema=ErrorSchema, description="Chưa đăng nhập")
@router.alt_response(403, schema=ErrorSchema, description="Không phải Manager")
def list_users(query):
    """Danh sách tài khoản (phân trang, lọc theo role/trạng thái, tìm kiếm)"""
    return user_controller.list_users(query)


@router.route("/<int:user_id>", methods=["GET"])
@auth_required(RoleCode.MANAGER)
@router.response(200, UserSchema)
@router.alt_response(401, schema=ErrorSchema, description="Chưa đăng nhập")
@router.alt_response(403, schema=ErrorSchema, description="Không phải Manager")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy tài khoản")
def get_user(user_id):
    """Chi tiết một tài khoản"""
    return user_controller.get_user(user_id)


@router.route("", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(UserWriteSchema)
@router.response(201, UserSchema)
@router.alt_response(409, schema=ErrorSchema, description="Username hoặc email đã tồn tại")
def create_user(payload):
    """Tạo tài khoản"""
    return user_controller.create_user(payload)


@router.route("/<int:user_id>", methods=["PATCH"])
@auth_required(RoleCode.MANAGER)
@router.arguments(UserUpdateSchema)
@router.response(200, UserSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy tài khoản")
@router.alt_response(409, schema=ErrorSchema, description="Dữ liệu tài khoản bị trùng hoặc xung đột hồ sơ")
def update_user(payload, user_id):
    """Cập nhật thông tin và role tài khoản; mật khẩu/trạng thái có API riêng"""
    return user_controller.update_user(user_id, payload)


@router.route("/<int:user_id>/status", methods=["PATCH"])
@auth_required(RoleCode.MANAGER)
@router.arguments(UserStatusSchema)
@router.response(200, UserSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không được đổi trạng thái chính mình")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy tài khoản")
def update_user_status(payload, user_id):
    """Khóa, mở khóa hoặc ngừng hoạt động tài khoản"""
    return user_controller.update_user_status(user_id, payload["status"])


@router.route("/<int:user_id>/reset-password", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(ResetPasswordSchema)
@router.response(204)
@router.alt_response(403, schema=ErrorSchema, description="Không được reset mật khẩu chính mình")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy tài khoản")
def reset_user_password(payload, user_id):
    """Manager đặt lại mật khẩu tài khoản khác"""
    return user_controller.reset_user_password(user_id, payload["new_password"])


@router.route("/<int:user_id>/students/<int:student_id>", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(StudentLinkSchema)
@router.response(201, StudentLinkResponseSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy user/student")
@router.alt_response(409, schema=ErrorSchema, description="Liên kết đã tồn tại hoặc role sai")
def link_student(payload, user_id, student_id):
    """Liên kết tài khoản Student/Parent với học viên"""
    return user_controller.link_student(user_id, student_id, payload)


@router.route("/<int:user_id>/students/<int:student_id>", methods=["DELETE"])
@auth_required(RoleCode.MANAGER)
@router.response(204)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy liên kết")
def unlink_student(user_id, student_id):
    """Gỡ liên kết tài khoản và học viên"""
    return user_controller.unlink_student(user_id, student_id)
