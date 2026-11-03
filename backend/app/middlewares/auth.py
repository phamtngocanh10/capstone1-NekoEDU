"""Xác thực (JWT) và phân quyền theo role.

Dùng ở router, đặt ngay dưới @router.route để kiểm tra quyền TRƯỚC khi validate input:

    @router.route("", methods=["GET"])
    @auth_required(RoleCode.MANAGER)          # chỉ Manager
    @router.arguments(...)
    def ...

    @auth_required()                          # mọi tài khoản đã đăng nhập
    @auth_required(*STAFF_ROLES)              # Manager, Giảng viên, Trợ giảng
"""

from functools import wraps

from flask_jwt_extended import JWTManager, current_user, verify_jwt_in_request

from app.common.errors import ForbiddenError, error_response
from app.extensions import db
from app.models import RoleCode, User

MSG_MISSING_TOKEN = "Bạn chưa đăng nhập hoặc thiếu access token"
MSG_INVALID_TOKEN = "Access token không hợp lệ"
MSG_EXPIRED_TOKEN = "Access token đã hết hạn, vui lòng đăng nhập lại"
MSG_ACCOUNT_UNAVAILABLE = "Tài khoản không tồn tại hoặc đã bị khóa"
MSG_FORBIDDEN = "Bạn không có quyền thực hiện chức năng này"


def auth_required(*roles: RoleCode):
    unknown = set(roles) - set(RoleCode)
    if unknown:
        raise ValueError(f"Role không hợp lệ: {unknown}")

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Kiểm tra token + nạp user từ DB (xem load_user bên dưới); lỗi -> 401
            verify_jwt_in_request()
            # Lấy role hiện tại trong DB, không tin role trong token (role có thể đã bị đổi)
            if roles and current_user.role.code not in roles:
                raise ForbiddenError(MSG_FORBIDDEN)
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def register_jwt_callbacks(manager: JWTManager) -> None:
    @manager.user_identity_loader
    def user_identity(user: User) -> str:
        # Claim "sub" của JWT phải là chuỗi
        return str(user.id)

    @manager.user_lookup_loader
    def load_user(_jwt_header, jwt_data) -> User | None:
        try:
            user_id = int(jwt_data["sub"])
        except (KeyError, TypeError, ValueError):
            return None
        user = db.session.get(User, user_id)
        # Tài khoản bị xóa/khóa sau khi đăng nhập thì token cũ không dùng được nữa
        if user is None or not user.is_active:
            return None
        return user

    @manager.unauthorized_loader
    def missing_token(_reason):
        return error_response(401, MSG_MISSING_TOKEN)

    @manager.invalid_token_loader
    def invalid_token(_reason):
        return error_response(401, MSG_INVALID_TOKEN)

    @manager.expired_token_loader
    def expired_token(_jwt_header, _jwt_data):
        return error_response(401, MSG_EXPIRED_TOKEN)

    @manager.user_lookup_error_loader
    def user_unavailable(_jwt_header, _jwt_data):
        return error_response(401, MSG_ACCOUNT_UNAVAILABLE)
