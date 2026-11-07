from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, Index, Unicode, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class RevokedToken(db.Model):
    __tablename__ = "revoked_tokens"
    __table_args__ = (
        UniqueConstraint("jti", name="uq_revoked_tokens_jti"),
        Index("ix_revoked_tokens_user_id", "user_id"),
        Index("ix_revoked_tokens_expires_at", "expires_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    jti: Mapped[str] = mapped_column(Unicode(36))
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", name="fk_revoked_tokens_user_id", ondelete="CASCADE"),
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("SYSDATETIMEOFFSET()")
    )
