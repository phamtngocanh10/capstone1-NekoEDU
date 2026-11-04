import math
from datetime import datetime, timezone

from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import contains_eager

from app.common.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.common.security import hash_password, verify_password
from app.extensions import db
from app.models import AuditAction, AuditLog, Role, RoleCode, User


def _escape_like(value: str) -> str:
    """Escape ký tự đặc biệt của LIKE để người dùng tìm '%' hay '_' đúng nghĩa đen."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_users(
    *,
    page: int,
    page_size: int,
    role: str | None = None,
    status: str | None = None,
    q: str | None = None,
) -> dict:
    stmt = select(User).join(User.role).options(contains_eager(User.role))

    if role:
        stmt = stmt.where(Role.code == role)
    if status:
        stmt = stmt.where(User.status == status)
    keyword = (q or "").strip()
    if keyword:
        pattern = f"%{_escape_like(keyword)}%"
        stmt = stmt.where(
            or_(
                User.username.ilike(pattern, escape="\\"),
                User.email.ilike(pattern, escape="\\"),
                User.full_name.ilike(pattern, escape="\\"),
            )
        )

    total = db.session.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.session.scalars(
        stmt.order_by(User.id).limit(page_size).offset((page - 1) * page_size)
    ).all()

    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size),
        },
    }


def get_user(user_id: int) -> User:
    user = db.session.get(User, user_id)
    if user is None:
        raise NotFoundError("Không tìm thấy tài khoản")
    return user


def create_user(payload: dict, *, actor: User, ip_address: str | None) -> User:
    role = _get_role(payload["role"])
    _ensure_unique_identifiers(payload["username"], payload.get("email"))
    user = User(
        username=payload["username"],
        email=payload.get("email"),
        password_hash=hash_password(payload["password"]),
        full_name=payload["full_name"],
        phone=payload.get("phone"),
        role=role,
    )
    db.session.add(user)
    try:
        db.session.flush()
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="users",
                entity_id=user.id,
                new_data=_audit_snapshot(user),
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Username hoặc email đã tồn tại") from exc
    return user


def update_user(
    user_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> User:
    user = get_user(user_id)
    old_data = _audit_snapshot(user)
    new_role_code = payload.get("role", user.role.code)
    new_email = payload.get("email", user.email)
    if new_role_code != RoleCode.STUDENT_PARENT and not new_email:
        raise ConflictError("Email là bắt buộc với tài khoản nhân sự")
    _ensure_profile_role_compatible(user.id, new_role_code)
    _ensure_unique_identifiers(
        payload.get("username", user.username),
        new_email,
        exclude_user_id=user.id,
    )

    if "username" in payload:
        user.username = payload["username"]
    if "email" in payload:
        user.email = payload["email"]
    if "full_name" in payload:
        user.full_name = payload["full_name"]
    if "phone" in payload:
        user.phone = payload["phone"]
    if "role" in payload:
        if user.role.code != payload["role"]:
            user.auth_version += 1
        user.role = _get_role(payload["role"])
    user.updated_at = datetime.now(timezone.utc)

    try:
        db.session.flush()
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.UPDATE,
                entity_name="users",
                entity_id=user.id,
                old_data=old_data,
                new_data=_audit_snapshot(user),
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Username hoặc email đã tồn tại") from exc
    return user


def _get_role(role_code: str) -> Role:
    role = db.session.scalar(select(Role).where(Role.code == role_code))
    if role is None:
        raise ConflictError("Role không tồn tại trong hệ thống")
    return role


def _ensure_unique_identifiers(
    username: str,
    email: str | None,
    *,
    exclude_user_id: int | None = None,
) -> None:
    username_stmt = select(User.id).where(User.username == username)
    if exclude_user_id is not None:
        username_stmt = username_stmt.where(User.id != exclude_user_id)
    if db.session.scalar(username_stmt) is not None:
        raise ConflictError("Username đã tồn tại")

    if email:
        email_stmt = select(User.id).where(func.lower(User.email) == email.lower())
        if exclude_user_id is not None:
            email_stmt = email_stmt.where(User.id != exclude_user_id)
        if db.session.scalar(email_stmt) is not None:
            raise ConflictError("Email đã tồn tại")


def _ensure_profile_role_compatible(user_id: int, role_code: str) -> None:
    staff_position = db.session.execute(
        text("SELECT position FROM staff_profiles WHERE user_id = :user_id"),
        {"user_id": user_id},
    ).scalar_one_or_none()
    if staff_position is not None and staff_position != role_code:
        raise ConflictError("Role phải khớp với chức vụ trong hồ sơ nhân sự")
    has_student = db.session.execute(
        text(
            """SELECT 1 WHERE
               EXISTS (SELECT 1 FROM students WHERE user_id = :user_id)
               OR EXISTS (SELECT 1 FROM student_user_links WHERE user_id = :user_id)"""
        ),
        {"user_id": user_id},
    ).scalar_one_or_none()
    if has_student and role_code != RoleCode.STUDENT_PARENT:
        raise ConflictError("Tài khoản đã liên kết học viên nên phải giữ role STUDENT_PARENT")


def _audit_snapshot(user: User) -> dict:
    return {
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role.code,
        "status": user.status,
    }


def update_user_status(
    user_id: int,
    status: str,
    *,
    actor: User,
    ip_address: str | None,
) -> User:
    user = get_user(user_id)
    if user.id == actor.id:
        raise ForbiddenError("Không thể thay đổi trạng thái tài khoản của chính mình")
    if user.status == status:
        return user

    old_data = _audit_snapshot(user)
    user.status = status
    user.auth_version += 1
    user.updated_at = datetime.now(timezone.utc)
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.UPDATE,
            entity_name="users",
            entity_id=user.id,
            old_data=old_data,
            new_data=_audit_snapshot(user),
            ip_address=ip_address,
        )
    )
    db.session.commit()
    return user


def reset_password(
    user_id: int,
    new_password: str,
    *,
    actor: User,
    ip_address: str | None,
) -> None:
    user = get_user(user_id)
    if user.id == actor.id:
        raise ForbiddenError(
            "Manager không thể reset mật khẩu của chính mình; hãy dùng chức năng đổi mật khẩu"
        )
    if verify_password(new_password, user.password_hash):
        raise AppError("Mật khẩu mới phải khác mật khẩu hiện tại")
    user.password_hash = hash_password(new_password)
    user.auth_version += 1
    user.updated_at = datetime.now(timezone.utc)
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.UPDATE,
            entity_name="users",
            entity_id=user.id,
            old_data={"password_changed": False},
            new_data={"password_changed": True, "mode": "MANAGER_RESET"},
            ip_address=ip_address,
        )
    )
    db.session.commit()


def link_student(
    user_id: int,
    student_id: int,
    *,
    relationship: str,
    can_view: bool,
    actor: User,
    ip_address: str | None,
) -> dict:
    user = get_user(user_id)
    if user.role.code != RoleCode.STUDENT_PARENT:
        raise ConflictError("Chỉ tài khoản STUDENT_PARENT được liên kết học viên")
    if db.session.execute(
        text("SELECT 1 FROM students WHERE id = :student_id"),
        {"student_id": student_id},
    ).scalar_one_or_none() is None:
        raise NotFoundError("Không tìm thấy học viên")
    existing = db.session.execute(
        text(
            "SELECT id FROM student_user_links "
            "WHERE user_id = :user_id AND student_id = :student_id"
        ),
        {"user_id": user_id, "student_id": student_id},
    ).scalar_one_or_none()
    legacy = db.session.execute(
        text("SELECT 1 FROM students WHERE id = :student_id AND user_id = :user_id"),
        {"user_id": user_id, "student_id": student_id},
    ).scalar_one_or_none()
    if existing is not None or legacy is not None:
        raise ConflictError("Tài khoản đã liên kết với học viên này")
    try:
        link_id = db.session.execute(
            text(
                """
                INSERT INTO student_user_links
                    (user_id, student_id, relationship, can_view, created_by)
                OUTPUT INSERTED.id
                VALUES (:user_id, :student_id, :relationship, :can_view, :actor_id)
                """
            ),
            {
                "user_id": user_id,
                "student_id": student_id,
                "relationship": relationship,
                "can_view": can_view,
                "actor_id": actor.id,
            },
        ).scalar_one()
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="student_user_links",
                entity_id=link_id,
                new_data={
                    "user_id": user_id,
                    "student_id": student_id,
                    "relationship": relationship,
                    "can_view": can_view,
                },
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Tài khoản đã liên kết với học viên này") from exc
    return _get_student_link(link_id)


def unlink_student(
    user_id: int,
    student_id: int,
    *,
    actor: User,
    ip_address: str | None,
) -> None:
    link = db.session.execute(
        text(
            """
            SELECT id, user_id, student_id, relationship, can_view
            FROM student_user_links
            WHERE user_id = :user_id AND student_id = :student_id
            """
        ),
        {"user_id": user_id, "student_id": student_id},
    ).mappings().one_or_none()
    legacy = db.session.execute(
        text("SELECT 1 FROM students WHERE id = :student_id AND user_id = :user_id"),
        {"user_id": user_id, "student_id": student_id},
    ).scalar_one_or_none()
    if link is None and legacy is None:
        raise NotFoundError("Không tìm thấy liên kết tài khoản-học viên")
    if link is not None:
        db.session.execute(
            text("DELETE FROM student_user_links WHERE id = :link_id"),
            {"link_id": link["id"]},
        )
    if legacy is not None:
        db.session.execute(
            text("UPDATE students SET user_id = NULL WHERE id = :student_id"),
            {"student_id": student_id},
        )
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.DELETE,
            entity_name="student_user_links",
            entity_id=link["id"] if link else None,
            old_data={
                "user_id": user_id,
                "student_id": student_id,
                "relationship": link["relationship"] if link else "SELF",
                "can_view": bool(link["can_view"]) if link else True,
            },
            ip_address=ip_address,
        )
    )
    db.session.commit()


def _get_student_link(link_id: int) -> dict:
    row = db.session.execute(
        text(
            """
            SELECT id, user_id, student_id, relationship, can_view, created_at
            FROM student_user_links WHERE id = :link_id
            """
        ),
        {"link_id": link_id},
    ).mappings().one()
    return {**dict(row), "can_view": bool(row["can_view"])}
