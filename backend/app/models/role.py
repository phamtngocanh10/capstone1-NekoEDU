from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, Identity, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class RoleCode(StrEnum):
    MANAGER = "MANAGER"
    LECTURER = "LECTURER"
    TEACHING_ASSISTANT = "TEACHING_ASSISTANT"
    STUDENT_PARENT = "STUDENT_PARENT"


# Nhóm nhân sự của trung tâm (không gồm Học viên/Phụ huynh)
STAFF_ROLES = (RoleCode.MANAGER, RoleCode.LECTURER, RoleCode.TEACHING_ASSISTANT)


class Role(db.Model):
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("code", name="uq_roles_code"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    code: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
