from flask_smorest import Blueprint
from flask import request, send_file
from flask_jwt_extended import current_user
from io import BytesIO

from app.controllers import auth_controller
from app.middlewares.auth import auth_required
from app.schemas.auth_schema import (
    ChangePasswordSchema,
    CurrentUserSchema,
    LoginResponseSchema,
    LoginSchema,
    ProfileUpdateSchema,
    RecoveryRequestSchema,
    PasswordResetSchema,
)
from app.schemas.common_schema import ErrorSchema
from app.services import profile_service
from app.services import recovery_service

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


@router.route("/profile", methods=["PUT"])
@auth_required()
@router.arguments(ProfileUpdateSchema)
@router.response(200, CurrentUserSchema)
def update_profile(payload):
    return profile_service.update_profile(current_user, payload, ip_address=request.remote_addr)


@router.route("/avatar", methods=["POST"])
@auth_required()
@router.response(200, CurrentUserSchema)
def upload_avatar():
    return profile_service.save_avatar(current_user, request.files.get("file"),
                                       ip_address=request.remote_addr)


@router.route("/avatar", methods=["GET"])
@auth_required()
def avatar():
    stored = profile_service.get_avatar(current_user)
    response = send_file(BytesIO(bytes(stored["content"])), mimetype=stored["mime_type"])
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@router.route('/recovery', methods=['POST'])
@router.doc(security=[])
@router.arguments(RecoveryRequestSchema)
@router.response(202)
def recovery(payload):
    return recovery_service.request_reset(payload['email'])


@router.route('/reset-password', methods=['POST'])
@router.doc(security=[])
@router.arguments(PasswordResetSchema)
@router.response(204)
def reset_password(payload):
    recovery_service.reset_password(payload, ip_address=request.remote_addr)
    return '', 204
