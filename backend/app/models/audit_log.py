from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class AuditAction(StrEnum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    APPROVE = "APPROVE"


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_actor_user_id", "actor_user_id"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", name="fk_audit_logs_actor_user_id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(String(20))
    entity_name: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[int | None] = mapped_column(BigInteger)
    old_data: Mapped[dict | None] = mapped_column(JSONB)
    new_data: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
