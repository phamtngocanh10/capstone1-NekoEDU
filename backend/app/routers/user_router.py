from flask_smorest import Blueprint

from app.controllers import user_controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.common_schema import ErrorSchema
from app.schemas.user_schema import UserListSchema, UserQuerySchema, UserSchema

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
