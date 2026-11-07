from sqlalchemy import text

from app.common.errors import ConflictError, NotFoundError
from app.extensions import db
from app.models import AuditAction, AuditLog, StaffPosition, User, UserStatus
from app.services.authorization_service import require_class_access


def assign_staff(
    class_id: int,
    *,
    lecturer_id: int,
    assistant_id: int | None,
    actor: User,
    ip_address: str | None,
) -> dict:
    if assistant_id == lecturer_id:
        raise ConflictError("Giảng viên và trợ giảng phải là hai nhân sự khác nhau")
    current = _get_class_assignment(class_id, lock=True)
    lecturer = _get_assignable_staff(lecturer_id, StaffPosition.LECTURER, "giảng viên")
    assistant = (
        _get_assignable_staff(
            assistant_id,
            StaffPosition.TEACHING_ASSISTANT,
            "trợ giảng",
        )
        if assistant_id is not None
        else None
    )
    if current["lecturer_id"] == lecturer_id and current["assistant_id"] == assistant_id:
        return _assignment_response(current, lecturer, assistant)

    db.session.execute(
        text(
            "UPDATE classes SET lecturer_id = :lecturer_id, assistant_id = :assistant_id "
            "WHERE id = :class_id"
        ),
        {
            "class_id": class_id,
            "lecturer_id": lecturer_id,
            "assistant_id": assistant_id,
        },
    )
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.UPDATE,
            entity_name="classes",
            entity_id=class_id,
            old_data={
                "lecturer_id": current["lecturer_id"],
                "assistant_id": current["assistant_id"],
            },
            new_data={"lecturer_id": lecturer_id, "assistant_id": assistant_id},
            ip_address=ip_address,
        )
    )
    db.session.commit()
    updated = {**current, "lecturer_id": lecturer_id, "assistant_id": assistant_id}
    return _assignment_response(updated, lecturer, assistant)


def get_staff_assignment(class_id: int, *, actor: User) -> dict:
    require_class_access(actor, class_id)
    current = _get_class_assignment(class_id)
    lecturer = _get_staff_record(current["lecturer_id"])
    assistant = (
        _get_staff_record(current["assistant_id"])
        if current["assistant_id"] is not None
        else None
    )
    return _assignment_response(current, lecturer, assistant)


def _get_class_assignment(class_id: int, *, lock: bool = False):
    lock_hint = " WITH (UPDLOCK, ROWLOCK)" if lock else ""
    row = db.session.execute(
        text(
            f"SELECT id, class_code, name, lecturer_id, assistant_id "
            f"FROM classes{lock_hint} WHERE id = :class_id"
        ),
        {"class_id": class_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy lớp học")
    return row


def _get_assignable_staff(staff_id: int, expected_position: str, label: str):
    row = _get_staff_record(staff_id)
    if row is None:
        raise NotFoundError(f"Không tìm thấy hồ sơ {label}")
    if row["position"] != expected_position:
        raise ConflictError(f"Nhân sự được chọn không có position {expected_position}")
    if row["staff_status"] != "ACTIVE" or row["account_status"] != UserStatus.ACTIVE:
        raise ConflictError(f"{label.capitalize()} phải đang hoạt động")
    return row


def _get_staff_record(staff_id: int):
    return db.session.execute(
        text(
            """
            SELECT sp.id, sp.staff_code, sp.position, sp.status AS staff_status,
                   u.full_name, u.status AS account_status
            FROM staff_profiles AS sp
            JOIN users AS u ON u.id = sp.user_id
            WHERE sp.id = :staff_id
            """
        ),
        {"staff_id": staff_id},
    ).mappings().one_or_none()


def _assignment_response(class_row, lecturer, assistant) -> dict:
    return {
        "id": class_row["id"],
        "class_code": class_row["class_code"],
        "name": class_row["name"],
        "lecturer": _staff_summary(lecturer),
        "assistant": _staff_summary(assistant) if assistant else None,
    }


def _staff_summary(row) -> dict:
    return {
        "id": row["id"],
        "staff_code": row["staff_code"],
        "full_name": row["full_name"],
    }
