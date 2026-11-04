from flask_smorest import Blueprint

from app.controllers import auth_controller
from app.middlewares.auth import auth_required
from app.schemas.auth_schema import (
    ChangePasswordSchema,
    CurrentUserSchema,
    LoginResponseSchema,
    LoginSchema,
)
from app.schemas.common_schema import ErrorSchema

router = Blueprint("auth", __name__, description="Xác thực: đăng nhập, thông tin tài khoản hiện tại")


@router.route("/login", methods=["POST"])
@router.doc(security=[])
@router.arguments(LoginSchema)
@router.response(200, LoginResponseSchema)
@router.alt_response(401, schema=ErrorSchema, description="Sai username/email hoặc mật khẩu")
@router.alt_response(403, schema=ErrorSchema, description="Tài khoản bị khóa hoặc ngừng hoạt động")
def login(payload):
    """Đăng nhập bằng username hoặc email

    Trả về access token (JWT). Gửi token ở header: `Authorization: Bearer <access_token>`.
    """
    return auth_controller.login(payload)


@router.route("/me", methods=["GET"])
@auth_required()
@router.response(200, CurrentUserSchema)
@router.alt_response(401, schema=ErrorSchema, description="Chưa đăng nhập, token không hợp lệ hoặc hết hạn")
def get_me():
    """Thông tin tài khoản đang đăng nhập"""
    return auth_controller.get_me()


@router.route("/logout", methods=["POST"])
@auth_required()
@router.response(204)
@router.alt_response(401, schema=ErrorSchema, description="Token thiếu, không hợp lệ hoặc đã thu hồi")
def logout():
    """Thu hồi access token hiện tại"""
    return auth_controller.logout()


@router.route("/password", methods=["PATCH"])
@auth_required()
@router.arguments(ChangePasswordSchema)
@router.response(204)
@router.alt_response(400, schema=ErrorSchema, description="Mật khẩu hiện tại sai hoặc mật khẩu mới không hợp lệ")
def change_password(payload):
    """Đổi mật khẩu của tài khoản hiện tại"""
    return auth_controller.change_password(payload)
