"""Self-service profile persistence; account role/status never come from the form."""

import hashlib
from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.common.errors import AppError, ConflictError, NotFoundError
from app.extensions import db
from app.models import AuditAction, AuditLog, User
from app.services.auth_service import get_current_user


def update_profile(user, payload, *, ip_address=None):
    duplicate = db.session.scalar(select(User.id).where(
        func.lower(User.email) == payload["email"].lower(), User.id != user.id,
    ))
    if duplicate:
        raise ConflictError("Email đã được sử dụng bởi tài khoản khác")
    previous = {key: getattr(user, key) for key in payload}
    for key, value in payload.items():
        setattr(user, key, value)
    user.updated_at = datetime.now(timezone.utc)
    db.session.add(AuditLog(
        actor_user_id=user.id, action=AuditAction.UPDATE, entity_name="users",
        entity_id=user.id, old_data=previous, new_data=payload, ip_address=ip_address,
    ))
    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Không thể lưu hồ sơ: email hoặc dữ liệu không hợp lệ") from exc
    db.session.refresh(user)
    return get_current_user(user)


def save_avatar(user, uploaded, *, ip_address=None):
    if uploaded is None:
        raise AppError("Vui lòng chọn ảnh đại diện")
    content = uploaded.read(2 * 1024 * 1024 + 1)
    if not content or len(content) > 2 * 1024 * 1024:
        raise AppError("Ảnh đại diện phải có dung lượng từ 1 byte đến 2 MB")
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        mime = "image/png"
    elif content.startswith(b"\xff\xd8\xff"):
        mime = "image/jpeg"
    elif content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        raise AppError("Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP")
    file_id = db.session.execute(text("""
        INSERT INTO stored_files(filename,mime_type,byte_size,content,sha256,uploaded_by)
        OUTPUT INSERTED.id
        VALUES(:filename,:mime,:size,:content,:sha,:actor)
    """), {"filename": (uploaded.filename or "avatar")[:255], "mime": mime,
           "size": len(content), "content": content, "sha": hashlib.sha256(content).hexdigest(),
           "actor": user.id}).scalar_one()
    user.avatar_storage_key = str(file_id)
    user.updated_at = datetime.now(timezone.utc)
    db.session.add(AuditLog(actor_user_id=user.id, action=AuditAction.UPDATE,
                           entity_name="users", entity_id=user.id,
                           new_data={"avatar_file_id": file_id}, ip_address=ip_address))
    db.session.commit()
    return get_current_user(user)


def get_avatar(user):
    if not (user.avatar_storage_key or "").isdigit():
        raise NotFoundError("Chưa có ảnh đại diện")
    row = db.session.execute(text("""
        SELECT filename, mime_type, content FROM stored_files
        WHERE id=:id AND uploaded_by=:actor
    """), {"id": int(user.avatar_storage_key), "actor": user.id}).mappings().first()
    if row is None:
        raise NotFoundError("Không tìm thấy ảnh đại diện")
    return row
