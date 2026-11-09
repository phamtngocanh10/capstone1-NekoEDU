import math
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.common.errors import AppError, ConflictError, NotFoundError
from app.extensions import db
from app.models import AuditAction, AuditLog, RoleCode, User


def list_sessions(
    *,
    actor: User,
    page: int,
    page_size: int,
    class_id: int | None = None,
    student_id: int | None = None,
    staff_id: int | None = None,
    room_id: int | None = None,
    date_from=None,
    date_to=None,
    status: str | None = None,
) -> dict:
    conditions = []
    params = {"offset": (page - 1) * page_size, "limit": page_size}
    _append_session_scope(conditions, params, actor)
    for field, value in (
        ("class_id", class_id),
        ("room_id", room_id),
        ("status", status),
    ):
        if value is not None:
            conditions.append(f"s.{field} = :{field}")
            params[field] = value
    if student_id is not None:
        conditions.append(
            """EXISTS (
                SELECT 1 FROM class_enrollments filter_enrollment
                WHERE filter_enrollment.class_id = s.class_id
                  AND filter_enrollment.student_id = :student_id
                  AND filter_enrollment.enrolled_date <= s.session_date
                  AND (filter_enrollment.left_date IS NULL
                       OR filter_enrollment.left_date >= s.session_date)
            )"""
        )
        params["student_id"] = student_id
    if staff_id is not None:
        conditions.append("(s.lecturer_id = :staff_id OR s.assistant_id = :staff_id)")
        params["staff_id"] = staff_id
    if date_from is not None:
        conditions.append("s.session_date >= :date_from")
        params["date_from"] = date_from
    if date_to is not None:
        conditions.append("s.session_date <= :date_to")
        params["date_to"] = date_to
    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    total = db.session.execute(
        text(f"SELECT COUNT(*) FROM class_sessions s JOIN classes c ON c.id = s.class_id {where_sql}"),
        params,
    ).scalar_one()
    rows = db.session.execute(
        text(
            f"""
            {_SESSION_SELECT}
            {where_sql}
            ORDER BY s.session_date, s.start_time, s.id
            OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
            """
        ),
        params,
    ).mappings().all()
    return {
        "items": [_serialize_session(row) for row in rows],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size),
        },
    }


def get_session(session_id: int, *, actor: User) -> dict:
    conditions = ["s.id = :session_id"]
    params = {"session_id": session_id}
    _append_session_scope(conditions, params, actor)
    row = db.session.execute(
        text(f"{_SESSION_SELECT} WHERE {' AND '.join(conditions)}"), params
    ).mappings().one_or_none()
    if row is not None:
        return _serialize_session(row)
    exists = db.session.execute(
        text("SELECT 1 FROM class_sessions WHERE id = :session_id"),
        {"session_id": session_id},
    ).scalar_one_or_none()
    if exists is None:
        raise NotFoundError("Không tìm thấy buổi học")
    from app.common.errors import ForbiddenError
    from app.middlewares.auth import MSG_FORBIDDEN

    raise ForbiddenError(MSG_FORBIDDEN)


def _append_session_scope(conditions: list, params: dict, actor: User) -> None:
    if actor.role.code == RoleCode.MANAGER:
        return
    params["actor_user_id"] = actor.id
    if actor.role.code == RoleCode.STUDENT_PARENT:
        conditions.append(
            """EXISTS (
                SELECT 1
                FROM class_enrollments scope_enrollment
                JOIN students scope_student ON scope_student.id = scope_enrollment.student_id
                WHERE scope_enrollment.class_id = s.class_id
                  AND scope_enrollment.enrolled_date <= s.session_date
                  AND (scope_enrollment.left_date IS NULL
                       OR scope_enrollment.left_date >= s.session_date)
                  AND (
                      scope_student.user_id = :actor_user_id
                      OR EXISTS (
                          SELECT 1 FROM student_user_links scope_link
                          WHERE scope_link.student_id = scope_student.id
                            AND scope_link.user_id = :actor_user_id
                            AND scope_link.can_view = 1
                      )
                  )
            )"""
        )
    else:
        conditions.append(
            """EXISTS (
                SELECT 1 FROM staff_profiles scope_staff
                WHERE scope_staff.user_id = :actor_user_id
                  AND (
                      c.lecturer_id = scope_staff.id
                      OR c.assistant_id = scope_staff.id
                      OR s.lecturer_id = scope_staff.id
                      OR s.assistant_id = scope_staff.id
                  )
            )"""
        )


def generate_class_sessions(
    class_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    class_row = db.session.execute(
        text(
            """
            SELECT id, start_date, end_date, status, lecturer_id, assistant_id,
                   max_students
            FROM classes WITH (UPDLOCK, ROWLOCK)
            WHERE id = :class_id
            """
        ),
        {"class_id": class_id},
    ).mappings().one_or_none()
    if class_row is None:
        raise NotFoundError("Không tìm thấy lớp học")
    if class_row["status"] in {"COMPLETED", "CANCELLED"}:
        raise ConflictError("Không thể sinh buổi cho lớp đã kết thúc hoặc đã hủy")

    date_from = payload.get("date_from", class_row["start_date"])
    date_to = payload.get("date_to", class_row["end_date"])
    if date_from < class_row["start_date"] or date_to > class_row["end_date"]:
        raise AppError("Khoảng sinh buổi phải nằm trong thời gian của lớp")
    if date_to < date_from:
        raise AppError("Ngày kết thúc phải từ ngày bắt đầu trở đi")

    schedules = db.session.execute(
        text(
            """
            SELECT cs.id, cs.day_of_week, cs.start_time, cs.end_time, cs.room_id,
                   r.capacity, r.status AS room_status
            FROM class_schedules cs WITH (UPDLOCK, HOLDLOCK)
            JOIN rooms r ON r.id = cs.room_id
            WHERE cs.class_id = :class_id
            ORDER BY cs.day_of_week, cs.start_time
            """
        ),
        {"class_id": class_id},
    ).mappings().all()
    if not schedules:
        raise ConflictError("Lớp chưa có lịch định kỳ để sinh buổi")
    for schedule in schedules:
        if schedule["room_status"] != "AVAILABLE":
            raise ConflictError("Lịch định kỳ đang dùng phòng bảo trì")
        if schedule["capacity"] < class_row["max_students"]:
            raise ConflictError("Phòng của lịch định kỳ không đủ sức chứa lớp")

    existing_keys = set(
        db.session.execute(
            text(
                """
                SELECT session_date, start_time
                FROM class_sessions WITH (UPDLOCK, HOLDLOCK)
                WHERE class_id = :class_id
                  AND session_date BETWEEN :date_from AND :date_to
                """
            ),
            {"class_id": class_id, "date_from": date_from, "date_to": date_to},
        ).all()
    )
    created_ids = []
    skipped_count = 0
    current_date = date_from
    schedules_by_day = {}
    for schedule in schedules:
        schedules_by_day.setdefault(schedule["day_of_week"], []).append(schedule)
    try:
        while current_date <= date_to:
            for schedule in schedules_by_day.get(current_date.isoweekday(), []):
                key = (current_date, schedule["start_time"])
                if key in existing_keys:
                    skipped_count += 1
                    continue
                session_id = db.session.execute(
                    text(
                        """
                        INSERT INTO class_sessions
                            (class_id, session_date, start_time, end_time, room_id,
                             lecturer_id, assistant_id, status)
                        OUTPUT INSERTED.id
                        VALUES
                            (:class_id, :session_date, :start_time, :end_time, :room_id,
                             :lecturer_id, :assistant_id, 'SCHEDULED')
                        """
                    ),
                    {
                        "class_id": class_id,
                        "session_date": current_date,
                        "start_time": schedule["start_time"],
                        "end_time": schedule["end_time"],
                        "room_id": schedule["room_id"],
                        "lecturer_id": class_row["lecturer_id"],
                        "assistant_id": class_row["assistant_id"],
                    },
                ).scalar_one()
                created_ids.append(session_id)
                existing_keys.add(key)
            current_date += timedelta(days=1)
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="class_session_generations",
                entity_id=class_id,
                new_data={
                    "class_id": class_id,
                    "date_from": date_from.isoformat(),
                    "date_to": date_to.isoformat(),
                    "created_count": len(created_ids),
                    "skipped_count": skipped_count,
                },
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Buổi học đã được sinh đồng thời bởi yêu cầu khác") from exc
    return {
        "class_id": class_id,
        "date_from": date_from,
        "date_to": date_to,
        "created_count": len(created_ids),
        "skipped_count": skipped_count,
        "sessions": [get_session_row(session_id) for session_id in created_ids],
    }


def create_exception_session(
    class_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    class_row = _get_class_for_session_write(class_id)
    values = {
        "session_date": payload["session_date"],
        "start_time": payload["start_time"],
        "end_time": payload["end_time"],
        "room_id": payload.get("room_id", class_row["default_room_id"]),
        "lecturer_id": payload.get("lecturer_id", class_row["lecturer_id"]),
        "assistant_id": payload.get("assistant_id", class_row["assistant_id"]),
        "note": payload.get("note"),
    }
    _validate_exception_session(class_row, values)
    try:
        session_id = db.session.execute(
            text(
                """
                INSERT INTO class_sessions
                    (class_id, session_date, start_time, end_time, room_id,
                     lecturer_id, assistant_id, status, note)
                OUTPUT INSERTED.id
                VALUES
                    (:class_id, :session_date, :start_time, :end_time, :room_id,
                     :lecturer_id, :assistant_id, 'SCHEDULED', :note)
                """
            ),
            {"class_id": class_id, **values},
        ).scalar_one()
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="class_sessions",
                entity_id=session_id,
                new_data={
                    "class_id": class_id,
                    **_json_payload(values),
                    "status": "SCHEDULED",
                },
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Lớp đã có buổi bắt đầu vào thời gian này") from exc
    return get_session_row(session_id)


def update_exception_session(
    session_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    current = db.session.execute(
        text(
            """
            SELECT id, class_id, session_date, start_time, end_time, room_id,
                   lecturer_id, assistant_id, status, note
            FROM class_sessions WITH (UPDLOCK, ROWLOCK)
            WHERE id = :session_id
            """
        ),
        {"session_id": session_id},
    ).mappings().one_or_none()
    if current is None:
        raise NotFoundError("Không tìm thấy buổi học")
    if current["status"] != "SCHEDULED":
        raise ConflictError("Chỉ buổi đang SCHEDULED mới được cập nhật")
    class_row = _get_class_for_session_write(current["class_id"])
    values = dict(current)
    values.update(payload)
    _validate_exception_session(class_row, values, exclude_session_id=session_id)
    changed_fields = {
        key: value for key, value in payload.items() if current.get(key) != value
    }
    if not changed_fields:
        return get_session_row(session_id)
    assignments = ", ".join(f"{field} = :{field}" for field in changed_fields)
    try:
        db.session.execute(
            text(f"UPDATE class_sessions SET {assignments} WHERE id = :session_id"),
            {**changed_fields, "session_id": session_id},
        )
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.UPDATE,
                entity_name="class_sessions",
                entity_id=session_id,
                old_data={key: _json_value(current[key]) for key in changed_fields},
                new_data={key: _json_value(value) for key, value in changed_fields.items()},
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Lớp đã có buổi bắt đầu vào thời gian này") from exc
    return get_session_row(session_id)


def cancel_session(
    session_id: int,
    reason: str,
    *,
    actor: User,
    ip_address: str | None,
    commit: bool = True,
) -> dict:
    current = db.session.execute(
        text(
            """
            SELECT id, status, note
            FROM class_sessions WITH (UPDLOCK, ROWLOCK)
            WHERE id = :session_id
            """
        ),
        {"session_id": session_id},
    ).mappings().one_or_none()
    if current is None:
        raise NotFoundError("Không tìm thấy buổi học")
    if current["status"] == "CANCELLED":
        raise ConflictError("Buổi học đã được hủy")
    if current["status"] == "COMPLETED":
        raise ConflictError("Không thể hủy buổi đã hoàn thành")
    attendance_count = db.session.execute(
        text("SELECT COUNT(*) FROM attendances WHERE session_id = :session_id"),
        {"session_id": session_id},
    ).scalar_one()
    if attendance_count:
        raise ConflictError("Không thể hủy buổi đã có dữ liệu điểm danh")
    db.session.execute(
        text(
            """
            UPDATE class_sessions
            SET status = 'CANCELLED', note = :reason
            WHERE id = :session_id
            """
        ),
        {"session_id": session_id, "reason": reason},
    )
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.UPDATE,
            entity_name="class_sessions",
            entity_id=session_id,
            old_data={"status": current["status"], "note": current["note"]},
            new_data={"status": "CANCELLED", "reason": reason},
            ip_address=ip_address,
        )
    )
    if commit:
        db.session.commit()
    return get_session_row(session_id)


def complete_session(
    session_id: int,
    *,
    actor: User,
    ip_address: str | None,
    now: datetime | None = None,
) -> dict:
    current = db.session.execute(
        text(
            """
            SELECT s.id, s.class_id, s.session_date, s.start_time, s.end_time,
                   s.status, c.lecturer_id AS class_lecturer_id,
                   s.lecturer_id AS session_lecturer_id
            FROM class_sessions s WITH (UPDLOCK, ROWLOCK)
            JOIN classes c ON c.id = s.class_id
            WHERE s.id = :session_id
            """
        ),
        {"session_id": session_id},
    ).mappings().one_or_none()
    if current is None:
        raise NotFoundError("Không tìm thấy buổi học")
    if actor.role.code != RoleCode.MANAGER:
        if actor.role.code != RoleCode.LECTURER:
            from app.common.errors import ForbiddenError
            from app.middlewares.auth import MSG_FORBIDDEN

            raise ForbiddenError(MSG_FORBIDDEN)
        actor_staff_id = db.session.execute(
            text("SELECT id FROM staff_profiles WHERE user_id = :user_id"),
            {"user_id": actor.id},
        ).scalar_one_or_none()
        if actor_staff_id not in {
            current["class_lecturer_id"],
            current["session_lecturer_id"],
        }:
            from app.common.errors import ForbiddenError
            from app.middlewares.auth import MSG_FORBIDDEN

            raise ForbiddenError(MSG_FORBIDDEN)
    if current["status"] == "COMPLETED":
        raise ConflictError("Buổi học đã hoàn thành")
    if current["status"] == "CANCELLED":
        raise ConflictError("Không thể hoàn thành buổi đã hủy")
    local_now = now or datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"))
    if local_now.tzinfo is not None:
        local_now = local_now.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).replace(tzinfo=None)
    end_at = datetime.combine(current["session_date"], current["end_time"])
    if local_now < end_at:
        raise ConflictError("Chỉ có thể hoàn thành sau khi buổi học kết thúc")
    expected_students = db.session.execute(
        text(
            """
            SELECT COUNT(*)
            FROM class_enrollments
            WHERE class_id = :class_id
              AND enrolled_date <= :session_date
              AND (left_date IS NULL OR left_date >= :session_date)
              AND status IN ('ACTIVE', 'TRANSFERRED', 'DROPPED', 'COMPLETED')
            """
        ),
        {"class_id": current["class_id"], "session_date": current["session_date"]},
    ).scalar_one()
    attendance_count = db.session.execute(
        text("SELECT COUNT(*) FROM attendances WHERE session_id = :session_id"),
        {"session_id": session_id},
    ).scalar_one()
    if attendance_count < expected_students:
        raise ConflictError(
            "Phải hoàn tất điểm danh trước khi đóng buổi",
            errors={
                "attendance": {
                    "expected": expected_students,
                    "recorded": attendance_count,
                    "missing": expected_students - attendance_count,
                }
            },
        )
    db.session.execute(
        text("UPDATE class_sessions SET status = 'COMPLETED' WHERE id = :session_id"),
        {"session_id": session_id},
    )
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.UPDATE,
            entity_name="class_sessions",
            entity_id=session_id,
            old_data={"status": current["status"]},
            new_data={"status": "COMPLETED"},
            ip_address=ip_address,
        )
    )
    db.session.commit()
    return get_session_row(session_id)


def _get_class_for_session_write(class_id: int):
    row = db.session.execute(
        text(
            """
            SELECT id, start_date, end_date, status, default_room_id,
                   lecturer_id, assistant_id
            FROM classes WITH (UPDLOCK, ROWLOCK)
            WHERE id = :class_id
            """
        ),
        {"class_id": class_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy lớp học")
    if row["status"] in {"COMPLETED", "CANCELLED"}:
        raise ConflictError("Không thể thay đổi buổi của lớp đã kết thúc hoặc đã hủy")
    return row


def _validate_exception_session(class_row, values: dict, *, exclude_session_id=None) -> None:
    if values["end_time"] <= values["start_time"]:
        raise ConflictError("Giờ kết thúc phải sau giờ bắt đầu")
    if not class_row["start_date"] <= values["session_date"] <= class_row["end_date"]:
        raise AppError("Ngày học phải nằm trong thời gian của lớp")
    if values["assistant_id"] == values["lecturer_id"]:
        raise ConflictError("Giảng viên và trợ giảng phải khác nhau")
    active_count = db.session.execute(
        text(
            """
            SELECT COUNT(*) FROM class_enrollments
            WHERE class_id = :class_id AND status = 'ACTIVE'
              AND enrolled_date <= :session_date
              AND (left_date IS NULL OR left_date >= :session_date)
            """
        ),
        {"class_id": class_row["id"], "session_date": values["session_date"]},
    ).scalar_one()
    room = db.session.execute(
        text("SELECT capacity, status FROM rooms WHERE id = :room_id"),
        {"room_id": values["room_id"]},
    ).mappings().one_or_none()
    if room is None:
        raise NotFoundError("Không tìm thấy phòng học")
    if room["status"] != "AVAILABLE":
        raise ConflictError("Phòng học đang bảo trì")
    if room["capacity"] < active_count:
        raise ConflictError("Sức chứa phòng nhỏ hơn số học sinh ACTIVE của buổi")
    _validate_session_staff(values["lecturer_id"], "LECTURER", "giảng viên")
    if values["assistant_id"] is not None:
        _validate_session_staff(
            values["assistant_id"], "TEACHING_ASSISTANT", "trợ giảng"
        )
    _ensure_no_session_conflicts(
        class_row["id"], values, exclude_session_id=exclude_session_id
    )


def _validate_session_staff(staff_id: int, position: str, label: str) -> None:
    row = db.session.execute(
        text(
            """
            SELECT sp.position, sp.status AS staff_status, u.status AS user_status
            FROM staff_profiles sp
            JOIN users u ON u.id = sp.user_id
            WHERE sp.id = :staff_id
            """
        ),
        {"staff_id": staff_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError(f"Không tìm thấy {label}")
    if row["position"] != position:
        raise ConflictError(f"Nhân sự được chọn không phải {label}")
    if row["staff_status"] != "ACTIVE" or row["user_status"] != "ACTIVE":
        raise ConflictError(f"{label.capitalize()} phải đang hoạt động")


def _ensure_no_session_conflicts(
    class_id: int, values: dict, *, exclude_session_id: int | None = None
) -> None:
    params = {
        "class_id": class_id,
        "session_date": values["session_date"],
        "start_time": values["start_time"],
        "end_time": values["end_time"],
        "room_id": values["room_id"],
        "lecturer_id": values["lecturer_id"],
        "assistant_id": values["assistant_id"],
        "exclude_session_id": exclude_session_id,
    }
    common = """
        other.session_date = :session_date
        AND :start_time < other.end_time
        AND other.start_time < :end_time
        AND other.status <> 'CANCELLED'
        AND other_class.status <> 'CANCELLED'
        AND (:exclude_session_id IS NULL OR other.id <> :exclude_session_id)
    """
    room_conflict = db.session.execute(
        text(
            f"""
            SELECT TOP 1 other.id AS session_id, other.class_id
            FROM class_sessions other WITH (UPDLOCK, HOLDLOCK)
            JOIN classes other_class ON other_class.id = other.class_id
            WHERE {common} AND other.room_id = :room_id
            ORDER BY other.id
            """
        ),
        params,
    ).mappings().one_or_none()
    if room_conflict:
        _raise_session_conflict(
            "ROOM", "Phòng học đã có buổi trùng giờ", room_conflict,
            room_id=values["room_id"]
        )
    staff_conflict = db.session.execute(
        text(
            f"""
            SELECT TOP 1 other.id AS session_id, other.class_id,
                   CASE WHEN other.lecturer_id IN (:lecturer_id, :assistant_id)
                        THEN other.lecturer_id ELSE other.assistant_id END AS staff_id
            FROM class_sessions other WITH (UPDLOCK, HOLDLOCK)
            JOIN classes other_class ON other_class.id = other.class_id
            WHERE {common}
              AND (other.lecturer_id IN (:lecturer_id, :assistant_id)
                   OR other.assistant_id IN (:lecturer_id, :assistant_id))
            ORDER BY other.id
            """
        ),
        params,
    ).mappings().one_or_none()
    if staff_conflict:
        _raise_session_conflict(
            "STAFF", "Giảng viên hoặc trợ giảng đã có buổi trùng giờ",
            staff_conflict, staff_id=staff_conflict["staff_id"]
        )
    student_conflict = db.session.execute(
        text(
            f"""
            SELECT TOP 1 other.id AS session_id, other.class_id,
                         candidate.student_id
            FROM class_sessions other WITH (UPDLOCK, HOLDLOCK)
            JOIN classes other_class ON other_class.id = other.class_id
            JOIN class_enrollments occupied
              ON occupied.class_id = other.class_id AND occupied.status = 'ACTIVE'
             AND occupied.enrolled_date <= :session_date
             AND (occupied.left_date IS NULL OR occupied.left_date >= :session_date)
            JOIN class_enrollments candidate
              ON candidate.class_id = :class_id AND candidate.status = 'ACTIVE'
             AND candidate.student_id = occupied.student_id
             AND candidate.enrolled_date <= :session_date
             AND (candidate.left_date IS NULL OR candidate.left_date >= :session_date)
            WHERE {common}
            ORDER BY other.id, candidate.student_id
            """
        ),
        params,
    ).mappings().one_or_none()
    if student_conflict:
        _raise_session_conflict(
            "STUDENT", "Học sinh đang có buổi học khác trùng giờ",
            student_conflict, student_id=student_conflict["student_id"]
        )


def _raise_session_conflict(conflict_type: str, message: str, row, **resource):
    raise ConflictError(
        message,
        errors={
            "conflict": {
                "type": conflict_type,
                "session_id": row["session_id"],
                "class_id": row["class_id"],
                **resource,
            }
        },
    )


def get_session_row(session_id: int) -> dict:
    row = db.session.execute(
        text(f"{_SESSION_SELECT} WHERE s.id = :session_id"),
        {"session_id": session_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy buổi học")
    return _serialize_session(row)


_SESSION_SELECT = """
    SELECT s.id, s.class_id, s.session_date, s.start_time, s.end_time,
           s.status, s.note,
           r.id AS room_id, r.code AS room_code, r.name AS room_name,
           lecturer.id AS lecturer_id, lecturer.staff_code AS lecturer_code,
           lecturer_user.full_name AS lecturer_name,
           assistant.id AS assistant_id, assistant.staff_code AS assistant_code,
           assistant_user.full_name AS assistant_name
    FROM class_sessions s
    JOIN classes c ON c.id = s.class_id
    JOIN rooms r ON r.id = s.room_id
    JOIN staff_profiles lecturer ON lecturer.id = s.lecturer_id
    JOIN users lecturer_user ON lecturer_user.id = lecturer.user_id
    LEFT JOIN staff_profiles assistant ON assistant.id = s.assistant_id
    LEFT JOIN users assistant_user ON assistant_user.id = assistant.user_id
"""


def _serialize_session(row, *, now: datetime | None = None) -> dict:
    return {
        "id": row["id"],
        "class_id": row["class_id"],
        "session_date": row["session_date"],
        "start_time": row["start_time"],
        "end_time": row["end_time"],
        "room": {
            "id": row["room_id"],
            "code": row["room_code"],
            "name": row["room_name"],
        },
        "lecturer": {
            "id": row["lecturer_id"],
            "staff_code": row["lecturer_code"],
            "full_name": row["lecturer_name"],
        },
        "assistant": (
            {
                "id": row["assistant_id"],
                "staff_code": row["assistant_code"],
                "full_name": row["assistant_name"],
            }
            if row["assistant_id"] is not None
            else None
        ),
        "status": row["status"],
        "display_status": _display_status(row, now=now),
        "note": row["note"],
    }


def _json_payload(payload: dict) -> dict:
    return {key: _json_value(value) for key, value in payload.items()}


def _json_value(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def _display_status(row, *, now: datetime | None = None) -> str:
    if row["status"] in {"COMPLETED", "CANCELLED"}:
        return row["status"]
    local_now = now or datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"))
    if local_now.tzinfo is not None:
        local_now = local_now.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).replace(tzinfo=None)
    start_at = datetime.combine(row["session_date"], row["start_time"])
    end_at = datetime.combine(row["session_date"], row["end_time"])
    if local_now < start_at:
        return "UPCOMING"
    if local_now < end_at:
        return "ONGOING"
    # Buổi đã qua nhưng chưa được đóng vẫn giữ trạng thái DB SCHEDULED để lộ dữ liệu vận hành thiếu.
    return "SCHEDULED"
