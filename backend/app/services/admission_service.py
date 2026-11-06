import math
from datetime import date

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.common.errors import AppError, ConflictError, NotFoundError
from app.extensions import db
from app.models import AuditAction, AuditLog, RoleCode, User, UserStatus
from app.services.student_service import get_student_detail_row


def list_admission_leads(
    *,
    page: int,
    page_size: int,
    q: str | None = None,
    source: str | None = None,
    status: str | None = None,
    interested_level_id: int | None = None,
    consultant_user_id: int | None = None,
) -> dict:
    conditions = []
    params = {"offset": (page - 1) * page_size, "limit": page_size}
    keyword = (q or "").strip()
    if keyword:
        conditions.append(
            """(
                al.lead_code LIKE :pattern ESCAPE '\\' OR
                al.child_full_name LIKE :pattern ESCAPE '\\' OR
                al.guardian_name LIKE :pattern ESCAPE '\\' OR
                al.guardian_phone LIKE :pattern ESCAPE '\\'
            )"""
        )
        params["pattern"] = f"%{_escape_like(keyword)}%"
    for field, value in (
        ("source", source),
        ("status", status),
        ("interested_level_id", interested_level_id),
        ("consultant_user_id", consultant_user_id),
    ):
        if value is not None:
            conditions.append(f"al.{field} = :{field}")
            params[field] = value
    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    total = db.session.execute(
        text(f"SELECT COUNT(*) FROM admission_leads al {where_sql}"), params
    ).scalar_one()
    rows = db.session.execute(
        text(
            f"""
            SELECT al.id, al.lead_code, al.child_full_name, al.child_dob,
                   al.guardian_name, al.guardian_phone, al.source,
                   al.placement_score, al.status, al.student_id,
                   al.converted_at, al.note, al.created_at,
                   l.id AS level_id, l.code AS level_code, l.name AS level_name,
                   u.id AS consultant_id, u.username AS consultant_username,
                   u.full_name AS consultant_full_name
            FROM admission_leads al
            LEFT JOIN levels l ON l.id = al.interested_level_id
            LEFT JOIN users u ON u.id = al.consultant_user_id
            {where_sql}
            ORDER BY al.created_at DESC, al.id DESC
            OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
            """
        ),
        params,
    ).mappings().all()
    return {
        "items": [_serialize_lead(row) for row in rows],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": math.ceil(total / page_size),
        },
    }


def _serialize_lead(row) -> dict:
    return {
        "id": row["id"],
        "lead_code": row["lead_code"],
        "child_full_name": row["child_full_name"],
        "child_dob": row["child_dob"],
        "guardian_name": row["guardian_name"],
        "guardian_phone": row["guardian_phone"],
        "source": row["source"],
        "interested_level": (
            {
                "id": row["level_id"],
                "code": row["level_code"],
                "name": row["level_name"],
            }
            if row["level_id"] is not None
            else None
        ),
        "placement_score": row["placement_score"],
        "status": row["status"],
        "student_id": row["student_id"],
        "consultant": (
            {
                "id": row["consultant_id"],
                "username": row["consultant_username"],
                "full_name": row["consultant_full_name"],
            }
            if row["consultant_id"] is not None
            else None
        ),
        "converted_at": row["converted_at"],
        "note": row["note"],
        "created_at": row["created_at"],
    }


def create_admission_lead(payload: dict, *, actor: User, ip_address: str | None) -> dict:
    child_dob = payload.get("child_dob")
    if child_dob is not None and child_dob >= date.today():
        raise AppError("Ngày sinh của trẻ phải ở trong quá khứ")
    _ensure_lead_code_unique(payload["lead_code"])
    interested_level_id = payload.get("interested_level_id")
    if interested_level_id is not None:
        _ensure_level_exists(interested_level_id)
    consultant_user_id = payload.get("consultant_user_id")
    if consultant_user_id is not None:
        _ensure_consultant_exists(consultant_user_id)
    try:
        lead_id = db.session.execute(
            text(
                """
                INSERT INTO admission_leads
                    (lead_code, child_full_name, child_dob, guardian_name,
                     guardian_phone, source, interested_level_id, status,
                     consultant_user_id, note)
                OUTPUT INSERTED.id
                VALUES
                    (:lead_code, :child_full_name, :child_dob, :guardian_name,
                     :guardian_phone, :source, :interested_level_id, 'NEW',
                     :consultant_user_id, :note)
                """
            ),
            {
                "lead_code": payload["lead_code"],
                "child_full_name": payload["child_full_name"],
                "child_dob": child_dob,
                "guardian_name": payload["guardian_name"],
                "guardian_phone": payload["guardian_phone"],
                "source": payload["source"],
                "interested_level_id": interested_level_id,
                "consultant_user_id": consultant_user_id,
                "note": payload.get("note"),
            },
        ).scalar_one()
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="admission_leads",
                entity_id=lead_id,
                new_data={
                    key: value.isoformat() if hasattr(value, "isoformat") else value
                    for key, value in {**payload, "status": "NEW"}.items()
                },
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Mã lead đã tồn tại") from exc
    return get_admission_lead_row(lead_id)


def get_admission_lead_row(lead_id: int) -> dict:
    row = db.session.execute(
        text(
            """
            SELECT al.id, al.lead_code, al.child_full_name, al.child_dob,
                   al.guardian_name, al.guardian_phone, al.source,
                   al.placement_score, al.status, al.student_id,
                   al.converted_at, al.note, al.created_at,
                   l.id AS level_id, l.code AS level_code, l.name AS level_name,
                   u.id AS consultant_id, u.username AS consultant_username,
                   u.full_name AS consultant_full_name
            FROM admission_leads al
            LEFT JOIN levels l ON l.id = al.interested_level_id
            LEFT JOIN users u ON u.id = al.consultant_user_id
            WHERE al.id = :lead_id
            """
        ),
        {"lead_id": lead_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy lead tuyển sinh")
    return _serialize_lead(row)


_STATUS_TRANSITIONS = {
    "NEW": {"NEW", "CONTACTED", "LOST"},
    "CONTACTED": {"CONTACTED", "TESTED", "LOST"},
    "TESTED": {"TESTED", "CONTACTED", "LOST"},
    "LOST": {"LOST", "CONTACTED"},
}


def update_admission_lead(
    lead_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    current = db.session.execute(
        text(
            """
            SELECT id, lead_code, child_full_name, child_dob, guardian_name,
                   guardian_phone, source, interested_level_id, placement_score,
                   status, student_id, consultant_user_id, note
            FROM admission_leads WITH (UPDLOCK, ROWLOCK)
            WHERE id = :lead_id
            """
        ),
        {"lead_id": lead_id},
    ).mappings().one_or_none()
    if current is None:
        raise NotFoundError("Không tìm thấy lead tuyển sinh")
    if current["status"] == "ENROLLED":
        raise ConflictError("Lead đã ghi danh không được chỉnh sửa")
    if "lead_code" in payload:
        _ensure_lead_code_unique(payload["lead_code"], exclude_lead_id=lead_id)
    if payload.get("interested_level_id") is not None:
        _ensure_level_exists(payload["interested_level_id"])
    if payload.get("consultant_user_id") is not None:
        _ensure_consultant_exists(payload["consultant_user_id"])
    child_dob = payload.get("child_dob", current["child_dob"])
    if child_dob is not None and child_dob >= date.today():
        raise AppError("Ngày sinh của trẻ phải ở trong quá khứ")

    target_status = payload.get("status", current["status"])
    if target_status not in _STATUS_TRANSITIONS[current["status"]]:
        raise ConflictError(
            f"Không thể chuyển trạng thái từ {current['status']} sang {target_status}"
        )
    target_score = payload.get("placement_score", current["placement_score"])
    if target_status == "TESTED" and target_score is None:
        raise AppError("Trạng thái TESTED bắt buộc có điểm đầu vào")
    if target_score is not None and target_status not in {"TESTED", "LOST"}:
        raise AppError("Chỉ lead TESTED hoặc LOST mới được lưu điểm đầu vào")

    changed_fields = {
        key: value for key, value in payload.items() if current.get(key) != value
    }
    if not changed_fields:
        return get_admission_lead_row(lead_id)
    assignments = ", ".join(f"{field} = :{field}" for field in changed_fields)
    try:
        db.session.execute(
            text(f"UPDATE admission_leads SET {assignments} WHERE id = :lead_id"),
            {**changed_fields, "lead_id": lead_id},
        )
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.UPDATE,
                entity_name="admission_leads",
                entity_id=lead_id,
                old_data={
                    key: _json_value(current[key]) for key in changed_fields
                },
                new_data={key: _json_value(value) for key, value in changed_fields.items()},
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Mã lead đã tồn tại") from exc
    return get_admission_lead_row(lead_id)


def convert_admission_lead(
    lead_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    lead = db.session.execute(
        text(
            """
            SELECT id, lead_code, child_full_name, child_dob, guardian_name,
                   guardian_phone, interested_level_id, placement_score,
                   status, student_id
            FROM admission_leads WITH (UPDLOCK, ROWLOCK)
            WHERE id = :lead_id
            """
        ),
        {"lead_id": lead_id},
    ).mappings().one_or_none()
    if lead is None:
        raise NotFoundError("Không tìm thấy lead tuyển sinh")
    if lead["status"] == "ENROLLED" or lead["student_id"] is not None:
        raise ConflictError("Lead đã được chuyển thành học viên")
    if lead["status"] != "TESTED" or lead["placement_score"] is None:
        raise ConflictError("Lead phải ở trạng thái TESTED và có điểm đầu vào")
    if lead["child_dob"] is None:
        raise ConflictError("Lead phải có ngày sinh của trẻ trước khi ghi danh")
    if lead["interested_level_id"] is None:
        raise ConflictError("Lead phải có cấp độ quan tâm trước khi ghi danh")

    try:
        if "existing_student_id" in payload:
            student_id = _validate_existing_student_for_lead(
                payload["existing_student_id"], lead
            )
        else:
            student_id = _create_student_from_lead(lead, payload, actor, ip_address)
        converted_at = date.today()
        db.session.execute(
            text(
                """
                UPDATE admission_leads
                SET status = 'ENROLLED', student_id = :student_id,
                    converted_at = :converted_at
                WHERE id = :lead_id
                """
            ),
            {
                "lead_id": lead_id,
                "student_id": student_id,
                "converted_at": converted_at,
            },
        )
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.UPDATE,
                entity_name="admission_leads",
                entity_id=lead_id,
                old_data={"status": lead["status"], "student_id": None},
                new_data={
                    "status": "ENROLLED",
                    "student_id": student_id,
                    "converted_at": converted_at.isoformat(),
                },
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError(
            "Không thể ghi danh do mã học viên, guardian hoặc liên kết lead bị trùng"
        ) from exc
    return {
        "lead": get_admission_lead_row(lead_id),
        "student": get_student_detail_row(student_id),
    }


def _create_student_from_lead(
    lead,
    payload: dict,
    actor: User,
    ip_address: str | None,
) -> int:
    enrolled_at = payload["enrolled_at"]
    if enrolled_at <= lead["child_dob"]:
        raise AppError("Ngày nhập học phải sau ngày sinh")
    if enrolled_at > date.today():
        raise AppError("Ngày nhập học không được ở tương lai")
    _ensure_student_code_unique(payload["student_code"])
    if "guardian_id" in payload:
        guardian_id = _ensure_guardian_matches_lead(payload["guardian_id"], lead)
    else:
        guardian_id = _create_guardian_from_lead(lead, payload, actor, ip_address)
    student_id = db.session.execute(
        text(
            """
            INSERT INTO students
                (student_code, full_name, english_name, date_of_birth,
                 guardian_id, current_level_id, enrolled_at, status, note)
            OUTPUT INSERTED.id
            VALUES
                (:student_code, :full_name, :english_name, :date_of_birth,
                 :guardian_id, :level_id, :enrolled_at, 'ACTIVE', :note)
            """
        ),
        {
            "student_code": payload["student_code"],
            "full_name": lead["child_full_name"],
            "english_name": payload.get("english_name"),
            "date_of_birth": lead["child_dob"],
            "guardian_id": guardian_id,
            "level_id": lead["interested_level_id"],
            "enrolled_at": enrolled_at,
            "note": payload.get("note"),
        },
    ).scalar_one()
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.CREATE,
            entity_name="students",
            entity_id=student_id,
            new_data={
                "student_code": payload["student_code"],
                "guardian_id": guardian_id,
                "current_level_id": lead["interested_level_id"],
                "source_lead_id": lead["id"],
                "status": "ACTIVE",
            },
            ip_address=ip_address,
        )
    )
    return student_id


def _validate_existing_student_for_lead(student_id: int, lead) -> int:
    student = db.session.execute(
        text(
            """
            SELECT s.id, s.full_name, s.date_of_birth, s.current_level_id,
                   g.phone AS guardian_phone
            FROM students s
            JOIN guardians g ON g.id = s.guardian_id
            WHERE s.id = :student_id
            """
        ),
        {"student_id": student_id},
    ).mappings().one_or_none()
    if student is None:
        raise NotFoundError("Không tìm thấy học viên để liên kết")
    if student["full_name"].strip().casefold() != lead["child_full_name"].strip().casefold():
        raise ConflictError("Họ tên học viên không khớp lead")
    if student["date_of_birth"] != lead["child_dob"]:
        raise ConflictError("Ngày sinh học viên không khớp lead")
    if student["current_level_id"] != lead["interested_level_id"]:
        raise ConflictError("Cấp độ hiện tại của học viên không khớp lead")
    if student["guardian_phone"] != lead["guardian_phone"]:
        raise ConflictError("Số điện thoại guardian của học viên không khớp lead")
    return student_id


def _ensure_student_code_unique(code: str) -> None:
    exists = db.session.execute(
        text("SELECT 1 FROM students WHERE LOWER(student_code) = LOWER(:code)"),
        {"code": code},
    ).scalar_one_or_none()
    if exists:
        raise ConflictError("Mã học viên đã tồn tại")


def _ensure_guardian_matches_lead(guardian_id: int, lead) -> int:
    guardian = db.session.execute(
        text("SELECT phone FROM guardians WHERE id = :id"), {"id": guardian_id}
    ).mappings().one_or_none()
    if guardian is None:
        raise NotFoundError("Không tìm thấy phụ huynh/người giám hộ")
    if guardian["phone"] != lead["guardian_phone"]:
        raise ConflictError("Số điện thoại guardian không khớp lead")
    return guardian_id


def _create_guardian_from_lead(lead, payload: dict, actor: User, ip_address: str | None) -> int:
    if db.session.execute(
        text("SELECT 1 FROM guardians WHERE phone = :phone"),
        {"phone": lead["guardian_phone"]},
    ).scalar_one_or_none():
        raise ConflictError(
            "Số điện thoại guardian đã tồn tại; hãy cung cấp guardian_id để xác nhận liên kết"
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
            "full_name": lead["guardian_name"],
            "phone": lead["guardian_phone"],
            "email": payload.get("guardian_email"),
            "relationship": payload["guardian_relationship"],
            "address": payload.get("guardian_address"),
        },
    ).scalar_one()
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.CREATE,
            entity_name="guardians",
            entity_id=guardian_id,
            new_data={
                "full_name": lead["guardian_name"],
                "phone": lead["guardian_phone"],
                "relationship": payload["guardian_relationship"],
                "source_lead_id": lead["id"],
            },
            ip_address=ip_address,
        )
    )
    return guardian_id


def _ensure_lead_code_unique(code: str, *, exclude_lead_id: int | None = None) -> None:
    query = "SELECT COUNT(*) FROM admission_leads WHERE LOWER(lead_code) = LOWER(:code)"
    params = {"code": code}
    if exclude_lead_id is not None:
        query += " AND id <> :exclude_lead_id"
        params["exclude_lead_id"] = exclude_lead_id
    if db.session.execute(text(query), params).scalar_one():
        raise ConflictError("Mã lead đã tồn tại")


def _ensure_level_exists(level_id: int) -> None:
    exists = db.session.execute(
        text("SELECT 1 FROM levels WHERE id = :id"), {"id": level_id}
    ).scalar_one_or_none()
    if exists is None:
        raise NotFoundError("Không tìm thấy cấp độ quan tâm")


def _ensure_consultant_exists(user_id: int) -> None:
    user = db.session.get(User, user_id)
    if user is None:
        raise NotFoundError("Không tìm thấy người tư vấn")
    if user.role.code == RoleCode.STUDENT_PARENT:
        raise ConflictError("Người tư vấn phải là tài khoản nhân sự")
    if user.status != UserStatus.ACTIVE:
        raise ConflictError("Người tư vấn phải đang hoạt động")
    staff_status = db.session.execute(
        text("SELECT status FROM staff_profiles WHERE user_id = :user_id"),
        {"user_id": user_id},
    ).scalar_one_or_none()
    if staff_status is None:
        raise ConflictError("Người tư vấn phải có hồ sơ nhân sự")
    if staff_status != "ACTIVE":
        raise ConflictError("Hồ sơ nhân sự của người tư vấn phải đang hoạt động")


def _json_value(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return float(value) if value.__class__.__name__ == "Decimal" else value


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
