from datetime import datetime, timezone

from flask import current_app
from flask_jwt_extended import create_access_token
from sqlalchemy import func, select

from app.common.errors import ForbiddenError, UnauthorizedError
from app.common.security import burn_password_check, verify_password
from app.extensions import db
from app.models import AuditAction, AuditLog, User, UserStatus

MSG_INVALID_CREDENTIALS = "Tên đăng nhập/email hoặc mật khẩu không đúng"
MSG_ACCOUNT_LOCKED = "Tài khoản đã bị khóa, vui lòng liên hệ quản lý trung tâm"
MSG_ACCOUNT_INACTIVE = "Tài khoản đã ngừng hoạt động, vui lòng liên hệ quản lý trung tâm"


def find_user_by_identifier(identifier: str) -> User | None:
    """Có '@' thì tìm theo email (không phân biệt hoa thường), ngược lại tìm theo username."""
    if "@" in identifier:
        stmt = select(User).where(func.lower(User.email) == identifier.lower())
    else:
        stmt = select(User).where(User.username == identifier)
    return db.session.scalars(stmt).first()


def authenticate(identifier: str, password: str, ip_address: str | None) -> dict:
    user = find_user_by_identifier(identifier)

    # Sai tài khoản hay sai mật khẩu đều trả cùng một thông báo, không lộ tài khoản nào tồn tại
    if user is None:
        burn_password_check(password)
        raise UnauthorizedError(MSG_INVALID_CREDENTIALS)
    if not verify_password(password, user.password_hash):
        raise UnauthorizedError(MSG_INVALID_CREDENTIALS)

    # Chỉ báo trạng thái khóa khi đã nhập đúng mật khẩu
    if user.status == UserStatus.LOCKED:
        raise ForbiddenError(MSG_ACCOUNT_LOCKED)
    if user.status != UserStatus.ACTIVE:
        raise ForbiddenError(MSG_ACCOUNT_INACTIVE)

    user.last_login_at = datetime.now(timezone.utc)
    db.session.add(
        AuditLog(
            actor_user_id=user.id,
            action=AuditAction.LOGIN,
            entity_name="users",
            entity_id=user.id,
            ip_address=ip_address,
        )
    )
    db.session.commit()

    expires = current_app.config["JWT_ACCESS_TOKEN_EXPIRES"]
    access_token = create_access_token(
        identity=user,
        # Claim chỉ để frontend tiện hiển thị; backend luôn phân quyền theo role trong DB
        additional_claims={"username": user.username, "role": user.role.code},
    )
    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": int(expires.total_seconds()),
        "user": user,
    }
