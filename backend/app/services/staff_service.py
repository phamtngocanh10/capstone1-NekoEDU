from sqlalchemy import select
from sqlalchemy.orm import contains_eager

from app.extensions import db
from app.models import StaffProfile


def list_staff(*, position: str | None = None, status: str | None = None) -> list[StaffProfile]:
    stmt = (
        select(StaffProfile)
        .join(StaffProfile.user)
        .options(contains_eager(StaffProfile.user))
        .order_by(StaffProfile.staff_code)
    )
    if position:
        stmt = stmt.where(StaffProfile.position == position)
    if status:
        stmt = stmt.where(StaffProfile.status == status)
    return list(db.session.scalars(stmt).unique())
