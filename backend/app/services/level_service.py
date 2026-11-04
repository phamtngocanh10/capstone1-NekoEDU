from sqlalchemy import text

from app.common.errors import AppError, NotFoundError
from app.extensions import db
from app.models import AuditAction, AuditLog, User

LEVEL_CODES = (
    "KINDY",
    "KID_1",
    "KID_2",
    "KID_3",
    "KID_4",
    "TEEN_1",
    "TEEN_2",
    "TEEN_3",
)


def list_levels() -> list[dict]:
    rows = db.session.execute(
        text(
            """
            SELECT id, code, name, min_age, max_age, sort_order
            FROM levels
            WHERE code IN ('KINDY', 'KID_1', 'KID_2', 'KID_3', 'KID_4',
                           'TEEN_1', 'TEEN_2', 'TEEN_3')
            ORDER BY sort_order
            """
        )
    ).mappings().all()
    return [dict(row) for row in rows]


def update_level(
    level_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    current = db.session.execute(
        text(
            """
            SELECT id, code, name, min_age, max_age, sort_order
            FROM levels WITH (UPDLOCK, ROWLOCK)
            WHERE id = :level_id
            """
        ),
        {"level_id": level_id},
    ).mappings().one_or_none()
    if current is None or current["code"] not in LEVEL_CODES:
        raise NotFoundError("Không tìm thấy cấp độ")
    min_age = payload.get("min_age", current["min_age"])
    max_age = payload.get("max_age", current["max_age"])
    if max_age < min_age:
        raise AppError("max_age phải lớn hơn hoặc bằng min_age")
    changes = {key: value for key, value in payload.items() if current[key] != value}
    if not changes:
        return dict(current)
    assignments = ", ".join(f"{field} = :{field}" for field in changes)
    db.session.execute(
        text(f"UPDATE levels SET {assignments} WHERE id = :level_id"),
        {**changes, "level_id": level_id},
    )
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.UPDATE,
            entity_name="levels",
            entity_id=level_id,
            old_data={key: current[key] for key in changes},
            new_data=changes,
            ip_address=ip_address,
        )
    )
    db.session.commit()
    return {
        **dict(current),
        **changes,
    }
