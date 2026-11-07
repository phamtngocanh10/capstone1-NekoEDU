from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.common.errors import ConflictError, NotFoundError
from app.extensions import db
from app.models import AuditAction, AuditLog, User
from app.services.authorization_service import require_class_access


def list_class_schedules(class_id: int, *, actor: User) -> dict:
    require_class_access(actor, class_id)
    rows = db.session.execute(
        text(
            """
            SELECT cs.id, cs.class_id, cs.day_of_week, cs.start_time, cs.end_time,
                   r.id AS room_id, r.code AS room_code, r.name AS room_name
            FROM class_schedules cs
            JOIN rooms r ON r.id = cs.room_id
            WHERE cs.class_id = :class_id
            ORDER BY cs.day_of_week, cs.start_time, cs.id
            """
        ),
        {"class_id": class_id},
    ).mappings().all()
    return {"items": [_serialize_schedule(row) for row in rows]}


def create_class_schedule(
    class_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    class_row = _get_schedulable_class(class_id, lock=True)
    _validate_room(payload["room_id"], class_row["max_students"])
    _ensure_no_schedule_conflicts(class_row, payload)
    try:
        schedule_id = db.session.execute(
            text(
                """
                INSERT INTO class_schedules
                    (class_id, day_of_week, start_time, end_time, room_id)
                OUTPUT INSERTED.id
                VALUES (:class_id, :day_of_week, :start_time, :end_time, :room_id)
                """
            ),
            {"class_id": class_id, **payload},
        ).scalar_one()
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="class_schedules",
                entity_id=schedule_id,
                new_data={"class_id": class_id, **_json_payload(payload)},
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Lớp đã có lịch bắt đầu vào thời gian này") from exc
    return get_schedule_row(schedule_id)


def update_class_schedule(
    schedule_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    current = _get_schedule_for_update(schedule_id)
    class_row = _get_schedulable_class(current["class_id"], lock=True)
    updated = dict(current)
    updated.update(payload)
    if updated["end_time"] <= updated["start_time"]:
        raise ConflictError("Giờ kết thúc phải sau giờ bắt đầu")
    _validate_room(updated["room_id"], class_row["max_students"])
    _ensure_no_schedule_conflicts(class_row, updated, exclude_schedule_id=schedule_id)
    changed_fields = {
        key: value for key, value in payload.items() if current.get(key) != value
    }
    if not changed_fields:
        return get_schedule_row(schedule_id)
    assignments = ", ".join(f"{field} = :{field}" for field in changed_fields)
    try:
        db.session.execute(
            text(f"UPDATE class_schedules SET {assignments} WHERE id = :schedule_id"),
            {**changed_fields, "schedule_id": schedule_id},
        )
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.UPDATE,
                entity_name="class_schedules",
                entity_id=schedule_id,
                old_data={key: _json_value(current[key]) for key in changed_fields},
                new_data={key: _json_value(value) for key, value in changed_fields.items()},
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Lớp đã có lịch bắt đầu vào thời gian này") from exc
    return get_schedule_row(schedule_id)


def delete_class_schedule(
    schedule_id: int,
    *,
    actor: User,
    ip_address: str | None,
) -> None:
    current = _get_schedule_for_update(schedule_id)
    _get_schedulable_class(current["class_id"], lock=True)
    db.session.execute(
        text("DELETE FROM class_schedules WHERE id = :schedule_id"),
        {"schedule_id": schedule_id},
    )
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.DELETE,
            entity_name="class_schedules",
            entity_id=schedule_id,
            old_data={
                "class_id": current["class_id"],
                "day_of_week": current["day_of_week"],
                "start_time": _json_value(current["start_time"]),
                "end_time": _json_value(current["end_time"]),
                "room_id": current["room_id"],
            },
            ip_address=ip_address,
        )
    )
    db.session.commit()


def get_schedule_row(schedule_id: int) -> dict:
    row = db.session.execute(
        text(
            """
            SELECT cs.id, cs.class_id, cs.day_of_week, cs.start_time, cs.end_time,
                   r.id AS room_id, r.code AS room_code, r.name AS room_name
            FROM class_schedules cs
            JOIN rooms r ON r.id = cs.room_id
            WHERE cs.id = :schedule_id
            """
        ),
        {"schedule_id": schedule_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy lịch học")
    return _serialize_schedule(row)


def _get_schedule_for_update(schedule_id: int):
    row = db.session.execute(
        text(
            """
            SELECT id, class_id, day_of_week, start_time, end_time, room_id
            FROM class_schedules WITH (UPDLOCK, ROWLOCK)
            WHERE id = :schedule_id
            """
        ),
        {"schedule_id": schedule_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy lịch học")
    return row


def _get_schedulable_class(class_id: int, *, lock: bool = False):
    lock_hint = " WITH (UPDLOCK, ROWLOCK)" if lock else ""
    row = db.session.execute(
        text(
            f"SELECT id, max_students, status, lecturer_id, assistant_id "
            f"FROM classes{lock_hint} "
            "WHERE id = :class_id"
        ),
        {"class_id": class_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy lớp học")
    if row["status"] in {"COMPLETED", "CANCELLED"}:
        raise ConflictError("Không thể thay đổi lịch của lớp đã kết thúc hoặc đã hủy")
    return row


def _validate_room(room_id: int, max_students: int) -> None:
    room = db.session.execute(
        text("SELECT capacity, status FROM rooms WHERE id = :room_id"),
        {"room_id": room_id},
    ).mappings().one_or_none()
    if room is None:
        raise NotFoundError("Không tìm thấy phòng học")
    if room["status"] != "AVAILABLE":
        raise ConflictError("Phòng học đang bảo trì")
    if room["capacity"] < max_students:
        raise ConflictError("Sức chứa phòng nhỏ hơn sĩ số tối đa của lớp")


def _ensure_no_schedule_conflicts(
    class_row,
    schedule: dict,
    *,
    exclude_schedule_id: int | None = None,
) -> None:
    params = {
        "class_id": class_row["id"],
        "day_of_week": schedule["day_of_week"],
        "start_time": schedule["start_time"],
        "end_time": schedule["end_time"],
        "room_id": schedule["room_id"],
        "lecturer_id": class_row["lecturer_id"],
        "assistant_id": class_row["assistant_id"],
        "exclude_schedule_id": exclude_schedule_id,
    }
    common = """
        cs.day_of_week = :day_of_week
        AND :start_time < cs.end_time
        AND cs.start_time < :end_time
        AND (:exclude_schedule_id IS NULL OR cs.id <> :exclude_schedule_id)
        AND other_class.status IN ('PLANNED', 'ONGOING')
    """
    room_conflict = db.session.execute(
        text(
            f"""
            SELECT TOP 1 cs.id AS schedule_id, cs.class_id
            FROM class_schedules cs WITH (UPDLOCK, HOLDLOCK)
            JOIN classes other_class ON other_class.id = cs.class_id
            WHERE {common} AND cs.room_id = :room_id
            ORDER BY cs.id
            """
        ),
        params,
    ).mappings().one_or_none()
    if room_conflict is not None:
        _raise_schedule_conflict(
            "ROOM",
            "Phòng học đã có lịch trong khoảng thời gian này",
            room_conflict,
            room_id=schedule["room_id"],
        )

    candidate_staff = [class_row["lecturer_id"]]
    if class_row["assistant_id"] is not None:
        candidate_staff.append(class_row["assistant_id"])
    staff_conflict = db.session.execute(
        text(
            f"""
            SELECT TOP 1 cs.id AS schedule_id, cs.class_id,
                   CASE
                       WHEN other_class.lecturer_id IN (:lecturer_id, :assistant_id)
                           THEN other_class.lecturer_id
                       ELSE other_class.assistant_id
                   END AS staff_id
            FROM class_schedules cs WITH (UPDLOCK, HOLDLOCK)
            JOIN classes other_class ON other_class.id = cs.class_id
            WHERE {common}
              AND (
                  other_class.lecturer_id IN (:lecturer_id, :assistant_id)
                  OR other_class.assistant_id IN (:lecturer_id, :assistant_id)
              )
            ORDER BY cs.id
            """
        ),
        params,
    ).mappings().one_or_none()
    if staff_conflict is not None:
        _raise_schedule_conflict(
            "STAFF",
            "Giảng viên hoặc trợ giảng đã có lịch trong khoảng thời gian này",
            staff_conflict,
            staff_id=staff_conflict["staff_id"],
        )

    student_conflict = db.session.execute(
        text(
            f"""
            SELECT TOP 1 cs.id AS schedule_id, cs.class_id,
                         candidate_enrollment.student_id
            FROM class_schedules cs WITH (UPDLOCK, HOLDLOCK)
            JOIN classes other_class ON other_class.id = cs.class_id
            JOIN class_enrollments other_enrollment
              ON other_enrollment.class_id = cs.class_id
             AND other_enrollment.status = 'ACTIVE'
            JOIN class_enrollments candidate_enrollment
              ON candidate_enrollment.class_id = :class_id
             AND candidate_enrollment.student_id = other_enrollment.student_id
             AND candidate_enrollment.status = 'ACTIVE'
            WHERE {common}
            ORDER BY cs.id, candidate_enrollment.student_id
            """
        ),
        params,
    ).mappings().one_or_none()
    if student_conflict is not None:
        _raise_schedule_conflict(
            "STUDENT",
            "Học sinh đang học lớp khác trong khoảng thời gian này",
            student_conflict,
            student_id=student_conflict["student_id"],
        )


def _raise_schedule_conflict(conflict_type: str, message: str, row, **resource) -> None:
    raise ConflictError(
        message,
        errors={
            "conflict": {
                "type": conflict_type,
                "schedule_id": row["schedule_id"],
                "class_id": row["class_id"],
                **resource,
            }
        },
    )


def _serialize_schedule(row) -> dict:
    return {
        "id": row["id"],
        "class_id": row["class_id"],
        "day_of_week": row["day_of_week"],
        "start_time": row["start_time"],
        "end_time": row["end_time"],
        "room": {
            "id": row["room_id"],
            "code": row["room_code"],
            "name": row["room_name"],
        },
    }


def _json_payload(payload: dict) -> dict:
    return {key: _json_value(value) for key, value in payload.items()}


def _json_value(value):
    return value.isoformat() if hasattr(value, "isoformat") else value
