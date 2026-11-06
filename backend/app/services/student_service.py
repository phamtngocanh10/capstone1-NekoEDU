import math
from datetime import date

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.common.errors import AppError, ConflictError, NotFoundError
from app.common.security import hash_password
from app.extensions import db
from app.models import AuditAction, AuditLog, Role, RoleCode, User
from app.services.authorization_service import require_student_access


def list_students(
    *,
    actor: User,
    page: int,
    page_size: int,
    q: str | None = None,
    level_id: int | None = None,
    status: str | None = None,
    class_id: int | None = None,
) -> dict:
    conditions = []
    params = {"offset": (page - 1) * page_size, "limit": page_size}

    if actor.role.code == RoleCode.STUDENT_PARENT:
        conditions.append(
            """(
                s.user_id = :actor_user_id OR EXISTS (
                    SELECT 1 FROM student_user_links sul_scope
                    WHERE sul_scope.student_id = s.id
                      AND sul_scope.user_id = :actor_user_id
                      AND sul_scope.can_view = 1
                )
            )"""
        )
        params["actor_user_id"] = actor.id
    elif actor.role.code != RoleCode.MANAGER:
        conditions.append(
            """EXISTS (
                SELECT 1 FROM class_enrollments ce_scope
                JOIN classes c_scope ON c_scope.id = ce_scope.class_id
                JOIN staff_profiles sp_scope ON sp_scope.user_id = :actor_user_id
                WHERE ce_scope.student_id = s.id
                  AND (c_scope.lecturer_id = sp_scope.id OR c_scope.assistant_id = sp_scope.id)
            )"""
        )
        params["actor_user_id"] = actor.id

    keyword = (q or "").strip()
    if keyword:
        params["pattern"] = f"%{_escape_like(keyword)}%"
        conditions.append(
            """(
                s.student_code LIKE :pattern ESCAPE '\\' OR
                s.full_name LIKE :pattern ESCAPE '\\' OR
                s.english_name LIKE :pattern ESCAPE '\\' OR
                g.full_name LIKE :pattern ESCAPE '\\'
            )"""
        )
    if level_id is not None:
        conditions.append("s.current_level_id = :level_id")
        params["level_id"] = level_id
    if status is not None:
        conditions.append("s.status = :status")
        params["status"] = status
    if class_id is not None:
        conditions.append(
            "EXISTS (SELECT 1 FROM class_enrollments ce_filter "
            "WHERE ce_filter.student_id = s.id AND ce_filter.class_id = :class_id)"
        )
        params["class_id"] = class_id

    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    from_sql = """
        FROM students s
        JOIN levels l ON l.id = s.current_level_id
        JOIN guardians g ON g.id = s.guardian_id
    """
    total = db.session.execute(
        text(f"SELECT COUNT(*) {from_sql} {where_sql}"), params
    ).scalar_one()
    rows = db.session.execute(
        text(
            f"""
            SELECT s.id, s.student_code, s.full_name, s.english_name,
                   s.date_of_birth, s.enrolled_at, s.status,
                   l.id AS level_id, l.code AS level_code, l.name AS level_name,
                   g.id AS guardian_id, g.full_name AS guardian_name,
                   g.phone AS guardian_phone, g.email AS guardian_email,
                   g.relationship AS guardian_relationship
            {from_sql}
            {where_sql}
            ORDER BY s.student_code, s.id
            OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
            """
        ),
        params,
    ).mappings().all()
    return {
        "items": [_student_summary(row) for row in rows],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size),
        },
    }


def _student_summary(row) -> dict:
    return {
        "id": row["id"],
        "student_code": row["student_code"],
        "full_name": row["full_name"],
        "english_name": row["english_name"],
        "date_of_birth": row["date_of_birth"],
        "enrolled_at": row["enrolled_at"],
        "status": row["status"],
        **({"note": row["note"], "user_id": row["user_id"]} if "note" in row else {}),
        "level": {
            "id": row["level_id"],
            "code": row["level_code"],
            "name": row["level_name"],
        },
        "guardian": {
            "id": row["guardian_id"],
            "full_name": row["guardian_name"],
            "phone": row["guardian_phone"],
            "email": row["guardian_email"],
            "relationship": row["guardian_relationship"],
        },
    }


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def create_student(payload: dict, *, actor: User, ip_address: str | None) -> dict:
    _validate_student_dates(payload["date_of_birth"], payload["enrolled_at"])
    _ensure_student_code_unique(payload["student_code"])
    _ensure_level_exists(payload["current_level_id"])

    try:
        guardian_id = (
            _create_guardian(payload["guardian"], actor, ip_address)
            if "guardian" in payload
            else _ensure_guardian_exists(payload["guardian_id"])
        )
        user_id = payload.get("user_id")
        if "account" in payload:
            user_id = _create_student_account(payload["account"], actor, ip_address)
        elif user_id is not None:
            _ensure_linkable_student_account(user_id)

        student_id = db.session.execute(
            text(
                """
                INSERT INTO students
                    (student_code, full_name, english_name, date_of_birth,
                     guardian_id, user_id, current_level_id, enrolled_at, status, note)
                OUTPUT INSERTED.id
                VALUES
                    (:student_code, :full_name, :english_name, :date_of_birth,
                     :guardian_id, NULL, :level_id, :enrolled_at, :status, :note)
                """
            ),
            {
                "student_code": payload["student_code"],
                "full_name": payload["full_name"],
                "english_name": payload.get("english_name"),
                "date_of_birth": payload["date_of_birth"],
                "guardian_id": guardian_id,
                "level_id": payload["current_level_id"],
                "enrolled_at": payload["enrolled_at"],
                "status": payload["status"],
                "note": payload.get("note"),
            },
        ).scalar_one()
        if user_id is not None:
            _create_student_link(
                user_id=user_id,
                student_id=student_id,
                relationship=payload.get("account_relationship", "GUARDIAN"),
                can_view=payload.get("account_can_view", True),
                actor_id=actor.id,
            )
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="students",
                entity_id=student_id,
                new_data={
                    "student_code": payload["student_code"],
                    "guardian_id": guardian_id,
                    "user_id": user_id,
                    "current_level_id": payload["current_level_id"],
                    "status": payload["status"],
                },
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Mã học viên, guardian hoặc tài khoản liên kết đã được sử dụng") from exc
    return get_student_detail_row(student_id)


def get_student_detail_row(student_id: int) -> dict:
    row = db.session.execute(
        text(
            """
            SELECT s.id, s.student_code, s.full_name, s.english_name,
                   s.date_of_birth, s.enrolled_at, s.status, s.note,
                   COALESCE(
                       (SELECT TOP 1 sul.user_id FROM student_user_links sul
                        WHERE sul.student_id = s.id ORDER BY sul.id),
                       s.user_id
                   ) AS user_id,
                   l.id AS level_id, l.code AS level_code, l.name AS level_name,
                   g.id AS guardian_id, g.full_name AS guardian_name,
                   g.phone AS guardian_phone, g.email AS guardian_email,
                   g.relationship AS guardian_relationship
            FROM students s
            JOIN levels l ON l.id = s.current_level_id
            JOIN guardians g ON g.id = s.guardian_id
            WHERE s.id = :student_id
            """
        ),
        {"student_id": student_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy học viên")
    return _student_summary(row)


def get_student(student_id: int, *, actor: User) -> dict:
    require_student_access(actor, student_id)
    return get_student_detail_row(student_id)


def update_student(
    student_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    current = db.session.execute(
        text(
            """
            SELECT id, student_code, full_name, english_name, date_of_birth,
                   guardian_id, enrolled_at, status, note
            FROM students WITH (UPDLOCK, ROWLOCK)
            WHERE id = :student_id
            """
        ),
        {"student_id": student_id},
    ).mappings().one_or_none()
    if current is None:
        raise NotFoundError("Không tìm thấy học viên")
    if "student_code" in payload:
        _ensure_student_code_unique(payload["student_code"], exclude_student_id=student_id)
    if "guardian_id" in payload:
        _ensure_guardian_exists(payload["guardian_id"])
    date_of_birth = payload.get("date_of_birth", current["date_of_birth"])
    enrolled_at = payload.get("enrolled_at", current["enrolled_at"])
    _validate_student_dates(date_of_birth, enrolled_at)

    updated = dict(current)
    updated.update(payload)
    changed_fields = {
        key: value
        for key, value in payload.items()
        if current.get(key) != value
    }
    if not changed_fields:
        return get_student_detail_row(student_id)
    assignments = ", ".join(f"{field} = :{field}" for field in changed_fields)
    params = {**changed_fields, "student_id": student_id}
    db.session.execute(
        text(
            f"UPDATE students SET {assignments}, updated_at = SYSDATETIMEOFFSET() "
            "WHERE id = :student_id"
        ),
        params,
    )
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.UPDATE,
            entity_name="students",
            entity_id=student_id,
            old_data={key: _json_value(current[key]) for key in changed_fields},
            new_data={key: _json_value(value) for key, value in changed_fields.items()},
            ip_address=ip_address,
        )
    )
    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Mã học viên đã tồn tại") from exc
    return get_student_detail_row(student_id)


def transfer_student_level(
    student_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    student = db.session.execute(
        text(
            """
            SELECT id, current_level_id, enrolled_at
            FROM students WITH (UPDLOCK, ROWLOCK)
            WHERE id = :student_id
            """
        ),
        {"student_id": student_id},
    ).mappings().one_or_none()
    if student is None:
        raise NotFoundError("Không tìm thấy học viên")

    new_level_id = payload["new_level_id"]
    _ensure_level_exists(new_level_id)
    if new_level_id == student["current_level_id"]:
        raise ConflictError("Cấp độ mới phải khác cấp độ hiện tại")

    effective_date = payload["effective_date"]
    if effective_date < student["enrolled_at"]:
        raise AppError("Ngày chuyển cấp không được trước ngày nhập học")
    if effective_date > date.today():
        raise AppError("Ngày chuyển cấp không được ở tương lai")
    latest_date = db.session.execute(
        text(
            """
            SELECT MAX(effective_date)
            FROM student_level_transfers
            WHERE student_id = :student_id
            """
        ),
        {"student_id": student_id},
    ).scalar_one()
    if latest_date is not None and effective_date <= latest_date:
        raise ConflictError("Ngày chuyển cấp phải sau lần chuyển cấp gần nhất")

    try:
        transfer_id = db.session.execute(
            text(
                """
                INSERT INTO student_level_transfers
                    (student_id, old_level_id, new_level_id, effective_date,
                     reason, transferred_by)
                OUTPUT INSERTED.id
                VALUES
                    (:student_id, :old_level_id, :new_level_id, :effective_date,
                     :reason, :transferred_by)
                """
            ),
            {
                "student_id": student_id,
                "old_level_id": student["current_level_id"],
                "new_level_id": new_level_id,
                "effective_date": effective_date,
                "reason": payload["reason"],
                "transferred_by": actor.id,
            },
        ).scalar_one()
        db.session.execute(
            text(
                """
                UPDATE students
                SET current_level_id = :new_level_id,
                    updated_at = SYSDATETIMEOFFSET()
                WHERE id = :student_id
                """
            ),
            {"student_id": student_id, "new_level_id": new_level_id},
        )
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.UPDATE,
                entity_name="student_level_transfers",
                entity_id=transfer_id,
                old_data={"student_id": student_id, "level_id": student["current_level_id"]},
                new_data={
                    "student_id": student_id,
                    "level_id": new_level_id,
                    "effective_date": effective_date.isoformat(),
                    "reason": payload["reason"],
                },
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Học viên đã có lần chuyển cấp vào ngày này") from exc
    return _get_level_transfer(transfer_id)


def _get_level_transfer(transfer_id: int) -> dict:
    row = db.session.execute(
        text(
            """
            SELECT t.id, t.student_id, t.effective_date, t.reason,
                   t.transferred_by, t.created_at,
                   old_l.id AS old_level_id, old_l.code AS old_level_code,
                   old_l.name AS old_level_name,
                   new_l.id AS new_level_id, new_l.code AS new_level_code,
                   new_l.name AS new_level_name
            FROM student_level_transfers t
            JOIN levels old_l ON old_l.id = t.old_level_id
            JOIN levels new_l ON new_l.id = t.new_level_id
            WHERE t.id = :transfer_id
            """
        ),
        {"transfer_id": transfer_id},
    ).mappings().one()
    return {
        "id": row["id"],
        "student_id": row["student_id"],
        "old_level": {
            "id": row["old_level_id"],
            "code": row["old_level_code"],
            "name": row["old_level_name"],
        },
        "new_level": {
            "id": row["new_level_id"],
            "code": row["new_level_code"],
            "name": row["new_level_name"],
        },
        "effective_date": row["effective_date"],
        "reason": row["reason"],
        "transferred_by": row["transferred_by"],
        "created_at": row["created_at"],
    }


def get_learning_history(student_id: int, *, actor: User) -> dict:
    require_student_access(actor, student_id)
    current_level = db.session.execute(
        text(
            """
            SELECT l.id, l.code, l.name
            FROM students s
            JOIN levels l ON l.id = s.current_level_id
            WHERE s.id = :student_id
            """
        ),
        {"student_id": student_id},
    ).mappings().one()
    transfer_ids = db.session.execute(
        text(
            """
            SELECT id
            FROM student_level_transfers
            WHERE student_id = :student_id
            ORDER BY effective_date, id
            """
        ),
        {"student_id": student_id},
    ).scalars().all()
    enrollment_rows = db.session.execute(
        text(
            """
            SELECT ce.id, ce.enrolled_date, ce.left_date, ce.status,
                   c.id AS class_id, c.class_code, c.name AS class_name,
                   co.id AS course_id, co.course_code, co.name AS course_name,
                   l.id AS level_id, l.code AS level_code, l.name AS level_name
            FROM class_enrollments ce
            JOIN classes c ON c.id = ce.class_id
            JOIN courses co ON co.id = c.course_id
            JOIN levels l ON l.id = co.level_id
            WHERE ce.student_id = :student_id
            ORDER BY ce.enrolled_date, ce.id
            """
        ),
        {"student_id": student_id},
    ).mappings().all()
    placement_row = db.session.execute(
        text(
            """
            SELECT TOP 1 al.id, al.lead_code, al.placement_score, al.status,
                         l.id AS level_id, l.code AS level_code, l.name AS level_name
            FROM admission_leads al
            LEFT JOIN levels l ON l.id = al.interested_level_id
            WHERE al.student_id = :student_id
            ORDER BY al.converted_at DESC, al.id DESC
            """
        ),
        {"student_id": student_id},
    ).mappings().one_or_none()
    result_conditions = ["ar.student_id = :student_id"]
    if actor.role.code == RoleCode.STUDENT_PARENT:
        result_conditions.append("a.status = 'PUBLISHED'")
    result_rows = db.session.execute(
        text(
            f"""
            SELECT ar.id, ar.score, ar.comment, ar.recorded_at, ar.updated_at,
                   a.id AS assessment_id, a.title, a.assessment_type,
                   a.test_date, a.status AS assessment_status,
                   c.id AS class_id, c.class_code, c.name AS class_name,
                   l.id AS level_id, l.code AS level_code, l.name AS level_name
            FROM assessment_results ar
            JOIN assessments a ON a.id = ar.assessment_id
            JOIN classes c ON c.id = a.class_id
            JOIN levels l ON l.id = a.level_id
            WHERE {' AND '.join(result_conditions)}
            ORDER BY a.test_date, a.id, ar.id
            """
        ),
        {"student_id": student_id},
    ).mappings().all()
    return {
        "student_id": student_id,
        "current_level": dict(current_level),
        "level_transfers": [_get_level_transfer(item_id) for item_id in transfer_ids],
        "enrollments": [
            {
                "id": row["id"],
                "class": {
                    "id": row["class_id"],
                    "code": row["class_code"],
                    "name": row["class_name"],
                },
                "course": {
                    "id": row["course_id"],
                    "code": row["course_code"],
                    "name": row["course_name"],
                },
                "level": {
                    "id": row["level_id"],
                    "code": row["level_code"],
                    "name": row["level_name"],
                },
                "enrolled_date": row["enrolled_date"],
                "left_date": row["left_date"],
                "status": row["status"],
            }
            for row in enrollment_rows
        ],
        "placement_assessment": (
            {
                "lead_id": placement_row["id"],
                "lead_code": placement_row["lead_code"],
                "score": placement_row["placement_score"],
                "status": placement_row["status"],
                "assessed_level": (
                    {
                        "id": placement_row["level_id"],
                        "code": placement_row["level_code"],
                        "name": placement_row["level_name"],
                    }
                    if placement_row["level_id"] is not None
                    else None
                ),
            }
            if placement_row is not None
            else None
        ),
        "assessment_results": [
            {
                "id": row["id"],
                "assessment": {
                    "id": row["assessment_id"],
                    "title": row["title"],
                    "assessment_type": row["assessment_type"],
                    "test_date": row["test_date"],
                    "status": row["assessment_status"],
                },
                "class": {
                    "id": row["class_id"],
                    "code": row["class_code"],
                    "name": row["class_name"],
                },
                "level": {
                    "id": row["level_id"],
                    "code": row["level_code"],
                    "name": row["level_name"],
                },
                "score": row["score"],
                "comment": row["comment"],
                "recorded_at": row["recorded_at"],
                "updated_at": row["updated_at"],
            }
            for row in result_rows
        ],
    }


def _validate_student_dates(date_of_birth: date, enrolled_at: date) -> None:
    today = date.today()
    if date_of_birth >= today:
        raise AppError("Ngày sinh phải ở trong quá khứ")
    if enrolled_at <= date_of_birth:
        raise AppError("Ngày nhập học phải sau ngày sinh")
    if enrolled_at > today:
        raise AppError("Ngày nhập học không được ở tương lai")


def _ensure_student_code_unique(code: str, *, exclude_student_id: int | None = None) -> None:
    sql = "SELECT 1 FROM students WHERE LOWER(student_code) = LOWER(:code)"
    params = {"code": code}
    if exclude_student_id is not None:
        sql += " AND id <> :exclude_student_id"
        params["exclude_student_id"] = exclude_student_id
    exists = db.session.execute(
        text(sql),
        params,
    ).scalar_one_or_none()
    if exists:
        raise ConflictError("Mã học viên đã tồn tại")


def _ensure_level_exists(level_id: int) -> None:
    if db.session.execute(
        text("SELECT 1 FROM levels WHERE id = :id"), {"id": level_id}
    ).scalar_one_or_none() is None:
        raise NotFoundError("Không tìm thấy cấp độ")


def _ensure_guardian_exists(guardian_id: int) -> int:
    if db.session.execute(
        text("SELECT 1 FROM guardians WHERE id = :id"), {"id": guardian_id}
    ).scalar_one_or_none() is None:
        raise NotFoundError("Không tìm thấy phụ huynh/người giám hộ")
    return guardian_id


def _create_guardian(payload: dict, actor: User, ip_address: str | None) -> int:
    if db.session.execute(
        text("SELECT 1 FROM guardians WHERE phone = :phone"), {"phone": payload["phone"]}
    ).scalar_one_or_none():
        raise ConflictError(
            "Số điện thoại guardian đã tồn tại; hãy dùng guardian_id để tránh liên kết nhầm"
        )
    guardian_id = db.session.execute(
        text(
            """
            INSERT INTO guardians (full_name, phone, email, relationship, address)
            OUTPUT INSERTED.id
            VALUES (:full_name, :phone, :email, :relationship, :address)
            """
        ),
        {
            "full_name": payload["full_name"],
            "phone": payload["phone"],
            "email": payload.get("email"),
            "relationship": payload["relationship"],
            "address": payload.get("address"),
        },
    ).scalar_one()
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.CREATE,
            entity_name="guardians",
            entity_id=guardian_id,
            new_data={k: v for k, v in payload.items() if k != "address"},
            ip_address=ip_address,
        )
    )
    return guardian_id


def _create_student_account(payload: dict, actor: User, ip_address: str | None) -> int:
    _ensure_user_identifiers_unique(payload["username"], payload.get("email"))
    role = db.session.scalar(select(Role).where(Role.code == RoleCode.STUDENT_PARENT))
    user = User(
        username=payload["username"],
        email=payload.get("email"),
        password_hash=hash_password(payload["password"]),
        full_name=payload["full_name"],
        phone=payload.get("phone"),
        role=role,
    )
    db.session.add(user)
    db.session.flush()
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.CREATE,
            entity_name="users",
            entity_id=user.id,
            new_data={
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "role": RoleCode.STUDENT_PARENT,
                "status": "ACTIVE",
            },
            ip_address=ip_address,
        )
    )
    return user.id


def _ensure_user_identifiers_unique(username: str, email: str | None) -> None:
    if db.session.scalar(select(User.id).where(User.username == username)) is not None:
        raise ConflictError("Username đã tồn tại")
    if email and db.session.scalar(
        select(User.id).where(func.lower(User.email) == email.lower())
    ) is not None:
        raise ConflictError("Email đã tồn tại")


def _ensure_linkable_student_account(user_id: int) -> None:
    user = db.session.get(User, user_id)
    if user is None:
        raise NotFoundError("Không tìm thấy tài khoản")
    if user.role.code != RoleCode.STUDENT_PARENT:
        raise ConflictError("Chỉ tài khoản STUDENT_PARENT được liên kết học viên")


def _create_student_link(
    *,
    user_id: int,
    student_id: int,
    relationship: str,
    can_view: bool,
    actor_id: int,
) -> int:
    return db.session.execute(
        text(
            """
            INSERT INTO student_user_links
                (user_id, student_id, relationship, can_view, created_by)
            OUTPUT INSERTED.id
            VALUES (:user_id, :student_id, :relationship, :can_view, :actor_id)
            """
        ),
        {
            "user_id": user_id,
            "student_id": student_id,
            "relationship": relationship,
            "can_view": can_view,
            "actor_id": actor_id,
        },
    ).scalar_one()


def _json_value(value):
    return value.isoformat() if hasattr(value, "isoformat") else value
