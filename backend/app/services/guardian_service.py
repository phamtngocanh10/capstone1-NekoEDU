import math

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.common.errors import ConflictError, NotFoundError
from app.extensions import db
from app.models import AuditAction, AuditLog, User


def list_guardians(
    *,
    page: int,
    page_size: int,
    q: str | None = None,
    relationship: str | None = None,
) -> dict:
    conditions = []
    params = {"offset": (page - 1) * page_size, "limit": page_size}
    keyword = (q or "").strip()
    if keyword:
        conditions.append(
            "(full_name LIKE :pattern ESCAPE '\\' OR phone LIKE :pattern ESCAPE '\\' "
            "OR email LIKE :pattern ESCAPE '\\')"
        )
        params["pattern"] = f"%{_escape_like(keyword)}%"
    if relationship:
        conditions.append("relationship = :relationship")
        params["relationship"] = relationship
    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    total = db.session.execute(
        text(f"SELECT COUNT(*) FROM guardians {where_sql}"), params
    ).scalar_one()
    rows = db.session.execute(
        text(
            f"""
            SELECT id, full_name, phone, email, relationship, address, created_at
            FROM guardians
            {where_sql}
            ORDER BY full_name, id
            OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
            """
        ),
        params,
    ).mappings().all()
    return {
        "items": [dict(row) for row in rows],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size),
        },
    }


def get_guardian(guardian_id: int) -> dict:
    row = _get_guardian_row(guardian_id)
    return dict(row)


def create_guardian(payload: dict, *, actor: User, ip_address: str | None) -> dict:
    _ensure_phone_unique(payload["phone"])
    try:
        guardian_id = db.session.execute(
            text(
                """
                INSERT INTO guardians (full_name, phone, email, relationship, address)
                OUTPUT INSERTED.id
                VALUES (:full_name, :phone, :email, :relationship, :address)
                """
            ),
            {**payload, "email": payload.get("email"), "address": payload.get("address")},
        ).scalar_one()
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="guardians",
                entity_id=guardian_id,
                new_data=payload,
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Số điện thoại guardian đã tồn tại") from exc
    return get_guardian(guardian_id)


def update_guardian(
    guardian_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    current = _get_guardian_row(guardian_id, lock=True)
    if "phone" in payload:
        _ensure_phone_unique(payload["phone"], exclude_guardian_id=guardian_id)
    changes = {key: value for key, value in payload.items() if current[key] != value}
    if not changes:
        return dict(current)
    assignments = ", ".join(f"{field} = :{field}" for field in changes)
    try:
        db.session.execute(
            text(f"UPDATE guardians SET {assignments} WHERE id = :guardian_id"),
            {**changes, "guardian_id": guardian_id},
        )
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.UPDATE,
                entity_name="guardians",
                entity_id=guardian_id,
                old_data={key: current[key] for key in changes},
                new_data=changes,
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Số điện thoại guardian đã tồn tại") from exc
    return get_guardian(guardian_id)


def _get_guardian_row(guardian_id: int, *, lock: bool = False):
    hint = " WITH (UPDLOCK, ROWLOCK)" if lock else ""
    row = db.session.execute(
        text(
            f"SELECT id, full_name, phone, email, relationship, address, created_at "
            f"FROM guardians{hint} WHERE id = :guardian_id"
        ),
        {"guardian_id": guardian_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy phụ huynh/người giám hộ")
    return row


def _ensure_phone_unique(phone: str, *, exclude_guardian_id: int | None = None) -> None:
    sql = "SELECT 1 FROM guardians WHERE phone = :phone"
    params = {"phone": phone}
    if exclude_guardian_id is not None:
        sql += " AND id <> :exclude_guardian_id"
        params["exclude_guardian_id"] = exclude_guardian_id
    if db.session.execute(text(sql), params).scalar_one_or_none():
        raise ConflictError(
            "Số điện thoại guardian đã tồn tại; không tự động gộp quan hệ gia đình"
        )


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
