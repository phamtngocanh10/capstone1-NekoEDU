from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Identity,
    Integer,
    Index,
    Unicode,
    UniqueConstraint,
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
        Index(
            "uq_users_email",
            "email",
            unique=True,
            mssql_where=text("email IS NOT NULL"),
        ),
        Index("ix_users_role_id", "role_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    username: Mapped[str] = mapped_column(
        Unicode(50, collation="Latin1_General_100_BIN2")
    )
    email: Mapped[str | None] = mapped_column(Unicode(150))
    password_hash: Mapped[str] = mapped_column(Unicode(100))
    full_name: Mapped[str] = mapped_column(Unicode(100))
    phone: Mapped[str | None] = mapped_column(Unicode(10))
    role_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("roles.id", name="fk_users_role_id")
    )
    status: Mapped[str] = mapped_column(Unicode(20), server_default=text("N'ACTIVE'"))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("SYSDATETIMEOFFSET()")
    )
    # Không tự cập nhật khi đăng nhập: updated_at chỉ đổi khi sửa hồ sơ tài khoản
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("SYSDATETIMEOFFSET()")
    )
    auth_version: Mapped[int] = mapped_column(Integer, server_default=text("0"))

    # Luôn cần role để phân quyền nên load kèm ngay khi lấy user
    role: Mapped[Role] = relationship(lazy="joined")

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE
