from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.role import Role


class UserStatus(StrEnum):
    ACTIVE = "ACTIVE"
    LOCKED = "LOCKED"
    INACTIVE = "INACTIVE"


class User(db.Model):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("username", name="uq_users_username"),
        UniqueConstraint("email", name="uq_users_email"),
        Index("ix_users_role_id", "role_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    username: Mapped[str] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(150))
    password_hash: Mapped[str] = mapped_column(String(100))
    full_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(10))
    role_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("roles.id", name="fk_users_role_id", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(String(20), server_default=text("'ACTIVE'"))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Không tự cập nhật khi đăng nhập: updated_at chỉ đổi khi sửa hồ sơ tài khoản
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Luôn cần role để phân quyền nên load kèm ngay khi lấy user
    role: Mapped[Role] = relationship(lazy="joined")

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE
