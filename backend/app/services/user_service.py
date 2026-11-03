import math

from sqlalchemy import func, or_, select
from sqlalchemy.orm import contains_eager

from app.common.errors import NotFoundError
from app.extensions import db
from app.models import Role, User


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
