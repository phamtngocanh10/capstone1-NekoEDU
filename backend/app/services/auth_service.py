from datetime import datetime, timezone

from flask import current_app
from flask_jwt_extended import create_access_token
from sqlalchemy import func, select, text

from app.common.errors import AppError, ForbiddenError, UnauthorizedError
from app.common.security import burn_password_check, hash_password, verify_password
from app.extensions import db
from app.models import AuditAction, AuditLog, RevokedToken, User, UserStatus

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
        additional_claims={
            "username": user.username,
            "role": user.role.code,
            "ver": user.auth_version,
        },
    )
    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": int(expires.total_seconds()),
        "user": user,
    }


def get_current_user(user: User) -> dict:
    """Trả tài khoản cùng hồ sơ nghiệp vụ gắn với role hiện tại."""
    if user.role.code == "STUDENT_PARENT":
        profiles = db.session.execute(
            text(
                """
                SELECT DISTINCT s.id, s.student_code, s.full_name, s.english_name,
                       s.date_of_birth, s.enrolled_at, s.status,
                       l.id AS level_id, l.code AS level_code, l.name AS level_name,
                       g.id AS guardian_id, g.full_name AS guardian_name,
                       g.phone AS guardian_phone, g.email AS guardian_email,
                       g.relationship AS guardian_relationship
                FROM students AS s
                JOIN levels AS l ON l.id = s.current_level_id
                JOIN guardians AS g ON g.id = s.guardian_id
                WHERE s.user_id = :user_id OR EXISTS (
                    SELECT 1 FROM student_user_links sul
                    WHERE sul.student_id = s.id AND sul.user_id = :user_id
                      AND sul.can_view = 1
                )
                ORDER BY s.student_code
                """
            ),
            {"user_id": user.id},
        ).mappings().all()
        related_profiles = [_student_profile(profile) for profile in profiles]
        related_profile = related_profiles[0] if related_profiles else None
    else:
        profile = db.session.execute(
            text(
                """
                SELECT id, staff_code, position, specialization, hire_date, status
                FROM staff_profiles
                WHERE user_id = :user_id
                """
            ),
            {"user_id": user.id},
        ).mappings().one_or_none()
        related_profile = (
            {
                "type": "STAFF",
                "id": profile["id"],
                "staff_code": profile["staff_code"],
                "position": profile["position"],
                "specialization": profile["specialization"],
                "hire_date": profile["hire_date"].isoformat(),
                "status": profile["status"],
            }
            if profile
            else None
        )
        related_profiles = []

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "status": user.status,
        "role": user.role,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
        "profile": related_profile,
        "profiles": related_profiles,
    }


def _student_profile(row) -> dict:
    return {
        "type": "STUDENT",
        "id": row["id"],
        "student_code": row["student_code"],
        "full_name": row["full_name"],
        "english_name": row["english_name"],
        "date_of_birth": row["date_of_birth"].isoformat(),
        "enrolled_at": row["enrolled_at"].isoformat(),
        "status": row["status"],
        "level": {
            "id": row["level_id"],
            "code": row["level_code"],
            "name": row["level_name"],
        },
        "guardian": {
            "id": row["guardian_id"],
            "full_name": row["guardian_name"],
            "phone": row["guardian_phone"],
            "email": row["guardian_email"],
            "relationship": row["guardian_relationship"],
        },
    }


def logout(user: User, *, jti: str, expires_at: int, ip_address: str | None) -> None:
    db.session.add(
        RevokedToken(
            jti=jti,
            user_id=user.id,
            expires_at=datetime.fromtimestamp(expires_at, tz=timezone.utc),
        )
    )
    db.session.add(
        AuditLog(
            actor_user_id=user.id,
            action=AuditAction.LOGOUT,
            entity_name="users",
            entity_id=user.id,
            ip_address=ip_address,
        )
    )
    db.session.commit()


def change_password(
    user: User,
    *,
    current_password: str,
    new_password: str,
    ip_address: str | None,
) -> None:
    if not verify_password(current_password, user.password_hash):
        raise AppError("Mật khẩu hiện tại không đúng")
    if verify_password(new_password, user.password_hash):
        raise AppError("Mật khẩu mới phải khác mật khẩu hiện tại")

    user.password_hash = hash_password(new_password)
    user.auth_version += 1
    user.updated_at = datetime.now(timezone.utc)
    db.session.add(
        AuditLog(
            actor_user_id=user.id,
            action=AuditAction.UPDATE,
            entity_name="users",
            entity_id=user.id,
            old_data={"password_changed": False},
            new_data={"password_changed": True, "mode": "SELF"},
            ip_address=ip_address,
        )
    )
    db.session.commit()
