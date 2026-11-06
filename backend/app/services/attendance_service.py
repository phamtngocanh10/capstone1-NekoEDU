from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import bindparam, text
from sqlalchemy.exc import IntegrityError

from app.common.errors import ConflictError, ForbiddenError, NotFoundError
from app.extensions import db
from app.middlewares.auth import MSG_FORBIDDEN
from app.models import AuditAction, AuditLog, RoleCode, User


def list_session_attendances(session_id: int, *, actor: User) -> dict:
    session = _get_session_context(session_id)
    parent_scope = actor.role.code == RoleCode.STUDENT_PARENT
    if actor.role.code != RoleCode.MANAGER:
        if parent_scope:
            pass
        elif not _is_assigned_session_staff(actor.id, session):
            raise ForbiddenError(MSG_FORBIDDEN)

    conditions = [
        "ce.class_id = :class_id",
        "ce.enrolled_date <= :session_date",
        "(ce.left_date IS NULL OR ce.left_date >= :session_date)",
    ]
    params = {
        "session_id": session_id,
        "class_id": session["class_id"],
        "session_date": session["session_date"],
    }
    if parent_scope:
        conditions.append(
            """(
                s.user_id = :actor_user_id OR EXISTS (
                    SELECT 1 FROM student_user_links sul
                    WHERE sul.student_id = s.id
                      AND sul.user_id = :actor_user_id
                      AND sul.can_view = 1
                )
            )"""
        )
        params["actor_user_id"] = actor.id
    rows = db.session.execute(
        text(
            f"""
            SELECT s.id AS student_id, s.student_code, s.full_name, s.english_name,
                   a.id AS attendance_id, a.status AS attendance_status,
                   a.note AS attendance_note, a.recorded_by, a.recorded_at
            FROM class_enrollments ce
            JOIN students s ON s.id = ce.student_id
            LEFT JOIN attendances a
              ON a.session_id = :session_id AND a.student_id = s.id
            WHERE {' AND '.join(conditions)}
            ORDER BY s.student_code, s.id
            """
        ),
        params,
    ).mappings().all()
    if parent_scope and not rows:
        raise ForbiddenError(MSG_FORBIDDEN)
    return {
        "session_id": session_id,
        "class_id": session["class_id"],
        "session_date": session["session_date"],
        "session_status": session["status"],
        "items": [_attendance_item(row) for row in rows],
    }


def record_bulk_attendances(
    session_id: int,
    items: list[dict],
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    session = db.session.execute(
        text(
            """
            SELECT s.id, s.class_id, s.session_date, s.start_time, s.status,
                   s.lecturer_id AS session_lecturer_id,
                   s.assistant_id AS session_assistant_id,
                   c.lecturer_id AS class_lecturer_id,
                   c.assistant_id AS class_assistant_id
            FROM class_sessions s WITH (UPDLOCK, ROWLOCK)
            JOIN classes c ON c.id = s.class_id
            WHERE s.id = :session_id
            """
        ),
        {"session_id": session_id},
    ).mappings().one_or_none()
    if session is None:
        raise NotFoundError("Không tìm thấy buổi học")
    if actor.role.code != RoleCode.MANAGER and not _is_assigned_session_staff(actor.id, session):
        raise ForbiddenError(MSG_FORBIDDEN)
    if session["status"] == "CANCELLED":
        raise ConflictError("Không thể điểm danh buổi đã hủy")
    if session["status"] == "COMPLETED":
        raise ConflictError("Buổi đã hoàn thành; hãy dùng chức năng sửa điểm danh")
    local_now = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).replace(tzinfo=None)
    start_at = datetime.combine(session["session_date"], session["start_time"])
    if local_now < start_at:
        raise ConflictError("Không thể điểm danh trước khi buổi học bắt đầu")

    requested_ids = [item["student_id"] for item in items]
    eligible_ids = set(
        db.session.execute(
            text(
                """
                SELECT student_id
                FROM class_enrollments WITH (UPDLOCK, HOLDLOCK)
                WHERE class_id = :class_id
                  AND enrolled_date <= :session_date
                  AND (left_date IS NULL OR left_date >= :session_date)
                  AND student_id IN :student_ids
                """
            ).bindparams(bindparam("student_ids", expanding=True)),
            {
                "class_id": session["class_id"],
                "session_date": session["session_date"],
                "student_ids": requested_ids,
            },
        ).scalars().all()
    )
    invalid_ids = sorted(set(requested_ids) - eligible_ids)
    if invalid_ids:
        raise ConflictError(
            "Có học sinh không thuộc roster của buổi học",
            errors={"student_ids": invalid_ids},
        )
    existing_ids = db.session.execute(
        text(
            """
            SELECT student_id FROM attendances WITH (UPDLOCK, HOLDLOCK)
            WHERE session_id = :session_id AND student_id IN :student_ids
            """
        ).bindparams(bindparam("student_ids", expanding=True)),
        {"session_id": session_id, "student_ids": requested_ids},
    ).scalars().all()
    if existing_ids:
        raise ConflictError(
            "Điểm danh đã tồn tại; hãy dùng chức năng sửa và cung cấp reason",
            errors={"student_ids": sorted(existing_ids)},
        )
    try:
        for item in items:
            attendance_id = db.session.execute(
                text(
                    """
                    INSERT INTO attendances
                        (session_id, student_id, status, recorded_by, recorded_at, note)
                    OUTPUT INSERTED.id
                    VALUES
                        (:session_id, :student_id, :status, :recorded_by,
                         SYSDATETIMEOFFSET(), :note)
                    """
                ),
                {
                    "session_id": session_id,
                    "student_id": item["student_id"],
                    "status": item["status"],
                    "recorded_by": actor.id,
                    "note": item.get("note"),
                },
            ).scalar_one()
            db.session.add(
                AuditLog(
                    actor_user_id=actor.id,
                    action=AuditAction.CREATE,
                    entity_name="attendances",
                    entity_id=attendance_id,
                    new_data={
                        "session_id": session_id,
                        "student_id": item["student_id"],
                        "status": item["status"],
                        "note": item.get("note"),
                    },
                    ip_address=ip_address,
                )
            )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Điểm danh đã được ghi đồng thời bởi yêu cầu khác") from exc
    return list_session_attendances(session_id, actor=actor)


def update_attendance(
    attendance_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    current = db.session.execute(
        text(
            """
            SELECT a.id, a.session_id, a.student_id, a.status, a.note,
                   a.recorded_by, a.recorded_at,
                   s.status AS session_status,
                   s.lecturer_id AS session_lecturer_id,
                   s.assistant_id AS session_assistant_id,
                   c.lecturer_id AS class_lecturer_id,
                   c.assistant_id AS class_assistant_id
            FROM attendances a WITH (UPDLOCK, ROWLOCK)
            JOIN class_sessions s ON s.id = a.session_id
            JOIN classes c ON c.id = s.class_id
            WHERE a.id = :attendance_id
            """
        ),
        {"attendance_id": attendance_id},
    ).mappings().one_or_none()
    if current is None:
        raise NotFoundError("Không tìm thấy bản ghi điểm danh")
    if actor.role.code != RoleCode.MANAGER and not _is_assigned_session_staff(actor.id, current):
        raise ForbiddenError(MSG_FORBIDDEN)
    if current["session_status"] == "CANCELLED":
        raise ConflictError("Không thể sửa điểm danh của buổi đã hủy")
    new_status = payload.get("status", current["status"])
    new_note = payload.get("note", current["note"])
    if new_status == current["status"] and new_note == current["note"]:
        raise ConflictError("Dữ liệu điểm danh không có thay đổi")
    history_id = db.session.execute(
        text(
            """
            INSERT INTO attendance_histories
                (attendance_id, old_status, new_status, old_note, new_note,
                 changed_by, changed_at, reason)
            OUTPUT INSERTED.id
            VALUES
                (:attendance_id, :old_status, :new_status, :old_note, :new_note,
                 :changed_by, SYSDATETIMEOFFSET(), :reason)
            """
        ),
        {
            "attendance_id": attendance_id,
            "old_status": current["status"],
            "new_status": new_status,
            "old_note": current["note"],
            "new_note": new_note,
            "changed_by": actor.id,
            "reason": payload["reason"],
        },
    ).scalar_one()
    if new_status != current["status"]:
        db.session.execute(
            text(
                """
                INSERT INTO tuition_recalculation_requests
                    (attendance_history_id, attendance_id, session_id, student_id,
                     requested_by, requested_at, status)
                VALUES
                    (:history_id, :attendance_id, :session_id, :student_id,
                     :requested_by, SYSDATETIMEOFFSET(), 'PENDING')
                """
            ),
            {
                "history_id": history_id,
                "attendance_id": attendance_id,
                "session_id": current["session_id"],
                "student_id": current["student_id"],
                "requested_by": actor.id,
            },
        )
    db.session.execute(
        text(
            """
            UPDATE attendances
            SET status = :status, note = :note
            WHERE id = :attendance_id
            """
        ),
        {"attendance_id": attendance_id, "status": new_status, "note": new_note},
    )
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.UPDATE,
            entity_name="attendances",
            entity_id=attendance_id,
            old_data={"status": current["status"], "note": current["note"]},
            new_data={
                "status": new_status,
                "note": new_note,
                "reason": payload["reason"],
            },
            ip_address=ip_address,
        )
    )
    db.session.commit()
    return get_attendance_row(attendance_id)


def list_attendance_history(attendance_id: int, *, actor: User) -> dict:
    attendance = db.session.execute(
        text(
            """
            SELECT a.id, a.session_id, a.student_id, a.status, a.note,
                   st.user_id AS student_user_id,
                   s.lecturer_id AS session_lecturer_id,
                   s.assistant_id AS session_assistant_id,
                   c.lecturer_id AS class_lecturer_id,
                   c.assistant_id AS class_assistant_id
            FROM attendances a
            JOIN students st ON st.id = a.student_id
            JOIN class_sessions s ON s.id = a.session_id
            JOIN classes c ON c.id = s.class_id
            WHERE a.id = :attendance_id
            """
        ),
        {"attendance_id": attendance_id},
    ).mappings().one_or_none()
    if attendance is None:
        raise NotFoundError("Không tìm thấy bản ghi điểm danh")

    if actor.role.code != RoleCode.MANAGER:
        if actor.role.code == RoleCode.STUDENT_PARENT:
            can_view = attendance["student_user_id"] == actor.id or db.session.execute(
                text(
                    """
                    SELECT 1 FROM student_user_links
                    WHERE student_id = :student_id AND user_id = :user_id AND can_view = 1
                    """
                ),
                {"student_id": attendance["student_id"], "user_id": actor.id},
            ).scalar_one_or_none()
            if not can_view:
                raise ForbiddenError(MSG_FORBIDDEN)
        elif not _is_assigned_session_staff(actor.id, attendance):
            raise ForbiddenError(MSG_FORBIDDEN)

    rows = db.session.execute(
        text(
            """
            SELECT h.id, h.old_status, h.new_status, h.old_note, h.new_note,
                   h.changed_at, h.reason,
                   u.id AS actor_id, u.username AS actor_username,
                   u.full_name AS actor_full_name
            FROM attendance_histories h
            JOIN users u ON u.id = h.changed_by
            WHERE h.attendance_id = :attendance_id
            ORDER BY h.changed_at ASC, h.id ASC
            """
        ),
        {"attendance_id": attendance_id},
    ).mappings().all()
    return {
        "attendance_id": attendance["id"],
        "session_id": attendance["session_id"],
        "student_id": attendance["student_id"],
        "current_status": attendance["status"],
        "current_note": attendance["note"],
        "items": [
            {
                "id": row["id"],
                "old_status": row["old_status"],
                "new_status": row["new_status"],
                "old_note": row["old_note"],
                "new_note": row["new_note"],
                "changed_by": {
                    "id": row["actor_id"],
                    "username": row["actor_username"],
                    "full_name": row["actor_full_name"],
                },
                "changed_at": row["changed_at"],
                "reason": row["reason"],
            }
            for row in rows
        ],
    }


def get_attendance_report(query: dict, *, actor: User) -> dict:
    _validate_report_scope(query, actor)
    conditions = []
    params = {}
    if query.get("student_id") is not None:
        conditions.append("a.student_id = :student_id")
        params["student_id"] = query["student_id"]
    if query.get("class_id") is not None:
        conditions.append("cs.class_id = :class_id")
        params["class_id"] = query["class_id"]
    if query.get("from_date") is not None:
        conditions.append("cs.session_date >= :from_date")
        params["from_date"] = query["from_date"]
    if query.get("to_date") is not None:
        conditions.append("cs.session_date <= :to_date")
        params["to_date"] = query["to_date"]

    if actor.role.code == RoleCode.STUDENT_PARENT:
        conditions.append(
            """(
                st.user_id = :actor_user_id OR EXISTS (
                    SELECT 1 FROM student_user_links sul
                    WHERE sul.student_id = st.id
                      AND sul.user_id = :actor_user_id
                      AND sul.can_view = 1
                )
            )"""
        )
        params["actor_user_id"] = actor.id
    elif actor.role.code != RoleCode.MANAGER:
        conditions.append(
            """EXISTS (
                SELECT 1 FROM staff_profiles sp
                WHERE sp.user_id = :actor_user_id
                  AND sp.id IN (
                      c.lecturer_id, c.assistant_id,
                      cs.lecturer_id, cs.assistant_id
                  )
            )"""
        )
        params["actor_user_id"] = actor.id

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = db.session.execute(
        text(
            f"""
            SELECT a.status, st.id AS student_id, st.student_code,
                   st.full_name AS student_name,
                   c.id AS class_id, c.class_code, c.name AS class_name
            FROM attendances a
            JOIN students st ON st.id = a.student_id
            JOIN class_sessions cs ON cs.id = a.session_id
            JOIN classes c ON c.id = cs.class_id
            {where_clause}
            ORDER BY cs.session_date, cs.start_time, a.id
            """
        ),
        params,
    ).mappings().all()

    student_groups = {}
    class_groups = {}
    for row in rows:
        student_group = student_groups.setdefault(
            row["student_id"],
            {
                "student_id": row["student_id"],
                "student_code": row["student_code"],
                "student_name": row["student_name"],
                "statuses": [],
            },
        )
        class_group = class_groups.setdefault(
            row["class_id"],
            {
                "class_id": row["class_id"],
                "class_code": row["class_code"],
                "class_name": row["class_name"],
                "statuses": [],
            },
        )
        student_group["statuses"].append(row["status"])
        class_group["statuses"].append(row["status"])

    return {
        "filters": {
            "student_id": query.get("student_id"),
            "class_id": query.get("class_id"),
            "from_date": query.get("from_date"),
            "to_date": query.get("to_date"),
        },
        "summary": _report_metrics([row["status"] for row in rows]),
        "by_students": [
            {**{key: value for key, value in group.items() if key != "statuses"},
             **_report_metrics(group["statuses"])}
            for group in sorted(student_groups.values(), key=lambda item: item["student_code"])
        ],
        "by_classes": [
            {**{key: value for key, value in group.items() if key != "statuses"},
             **_report_metrics(group["statuses"])}
            for group in sorted(class_groups.values(), key=lambda item: item["class_code"])
        ],
    }


def _validate_report_scope(query: dict, actor: User) -> None:
    class_id = query.get("class_id")
    if class_id is not None:
        class_row = db.session.execute(
            text(
                """
                SELECT id, lecturer_id AS class_lecturer_id,
                       assistant_id AS class_assistant_id,
                       NULL AS session_lecturer_id, NULL AS session_assistant_id
                FROM classes WHERE id = :class_id
                """
            ),
            {"class_id": class_id},
        ).mappings().one_or_none()
        if class_row is None:
            raise NotFoundError("Không tìm thấy lớp")
        if actor.role.code not in (RoleCode.MANAGER, RoleCode.STUDENT_PARENT):
            staff_id = db.session.execute(
                text("SELECT id FROM staff_profiles WHERE user_id = :user_id"),
                {"user_id": actor.id},
            ).scalar_one_or_none()
            session_assignment = db.session.execute(
                text(
                    """
                    SELECT TOP 1 1 FROM class_sessions
                    WHERE class_id = :class_id
                      AND (:staff_id IN (lecturer_id, assistant_id))
                    """
                ),
                {"class_id": class_id, "staff_id": staff_id},
            ).scalar_one_or_none()
            if staff_id not in {
                class_row["class_lecturer_id"], class_row["class_assistant_id"]
            } and session_assignment is None:
                raise ForbiddenError(MSG_FORBIDDEN)

    student_id = query.get("student_id")
    if student_id is not None:
        student = db.session.execute(
            text("SELECT id, user_id FROM students WHERE id = :student_id"),
            {"student_id": student_id},
        ).mappings().one_or_none()
        if student is None:
            raise NotFoundError("Không tìm thấy học sinh")
        if actor.role.code == RoleCode.STUDENT_PARENT:
            linked = student["user_id"] == actor.id or db.session.execute(
                text(
                    """
                    SELECT 1 FROM student_user_links
                    WHERE student_id = :student_id AND user_id = :user_id AND can_view = 1
                    """
                ),
                {"student_id": student_id, "user_id": actor.id},
            ).scalar_one_or_none()
            if not linked:
                raise ForbiddenError(MSG_FORBIDDEN)


def _report_metrics(statuses: list[str]) -> dict:
    total = len(statuses)
    present = statuses.count("PRESENT")
    excused = statuses.count("EXCUSED_ABSENCE")
    unexcused = statuses.count("UNEXCUSED_ABSENCE")
    absent = excused + unexcused
    return {
        "total_records": total,
        "present": present,
        "excused_absence": excused,
        "unexcused_absence": unexcused,
        "absence_total": absent,
        "presence_rate": round(present * 100 / total, 2) if total else 0.0,
        "absence_rate": round(absent * 100 / total, 2) if total else 0.0,
    }


def get_attendance_row(attendance_id: int) -> dict:
    row = db.session.execute(
        text(
            """
            SELECT id, session_id, student_id, status, note, recorded_by, recorded_at
            FROM attendances
            WHERE id = :attendance_id
            """
        ),
        {"attendance_id": attendance_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy bản ghi điểm danh")
    return dict(row)


def _get_session_context(session_id: int):
    row = db.session.execute(
        text(
            """
            SELECT s.id, s.class_id, s.session_date, s.status,
                   s.lecturer_id AS session_lecturer_id,
                   s.assistant_id AS session_assistant_id,
                   c.lecturer_id AS class_lecturer_id,
                   c.assistant_id AS class_assistant_id
            FROM class_sessions s
            JOIN classes c ON c.id = s.class_id
            WHERE s.id = :session_id
            """
        ),
        {"session_id": session_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy buổi học")
    return row


def _is_assigned_session_staff(user_id: int, session) -> bool:
    staff_id = db.session.execute(
        text("SELECT id FROM staff_profiles WHERE user_id = :user_id"),
        {"user_id": user_id},
    ).scalar_one_or_none()
    return staff_id is not None and staff_id in {
        session["class_lecturer_id"],
        session["class_assistant_id"],
        session["session_lecturer_id"],
        session["session_assistant_id"],
    }


def _attendance_item(row) -> dict:
    return {
        "student": {
            "id": row["student_id"],
            "student_code": row["student_code"],
            "full_name": row["full_name"],
            "english_name": row["english_name"],
        },
        "attendance": (
            {
                "id": row["attendance_id"],
                "status": row["attendance_status"],
                "note": row["attendance_note"],
                "recorded_by": row["recorded_by"],
                "recorded_at": row["recorded_at"],
            }
            if row["attendance_id"] is not None
            else None
        ),
    }
