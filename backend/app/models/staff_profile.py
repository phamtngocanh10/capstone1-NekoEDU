from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Numeric,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.models.user import User


class StaffPosition(StrEnum):
    MANAGER = "MANAGER"
    LECTURER = "LECTURER"
    TEACHING_ASSISTANT = "TEACHING_ASSISTANT"


class StaffStatus(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class StaffProfile(db.Model):
    __tablename__ = "staff_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_staff_profiles_user_id"),
        UniqueConstraint("staff_code", name="uq_staff_profiles_staff_code"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", name="fk_staff_profiles_user_id", ondelete="CASCADE")
    )
    staff_code: Mapped[str] = mapped_column(String(20))
    position: Mapped[str] = mapped_column(String(30))
    specialization: Mapped[str | None] = mapped_column(String(200))
    rate_per_session: Mapped[Decimal] = mapped_column(Numeric(12, 0), server_default=text("0"))
    hire_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), server_default=text("'ACTIVE'"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship()
