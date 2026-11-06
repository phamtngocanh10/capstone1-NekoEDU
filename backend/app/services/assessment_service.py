import hashlib
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from io import BytesIO
from uuid import UUID, uuid4

from openpyxl import load_workbook
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils.exceptions import InvalidFileException
from sqlalchemy import bindparam, text
from sqlalchemy.exc import IntegrityError

from app.common.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.extensions import db
from app.middlewares.auth import MSG_FORBIDDEN
from app.models import AuditAction, AuditLog, RoleCode, User
from app.services.authorization_service import require_student_access


def create_assessment(payload: dict, *, actor: User, ip_address: str | None) -> dict:
    class_row = _get_class_context(payload["class_id"])
    _require_assessment_editor(actor, class_row)
    if payload["level_id"] != class_row["level_id"]:
        raise ConflictError("Cấp độ đánh giá phải trùng cấp độ khóa học của lớp")
    _validate_score_range(payload["score_min"], payload["score_max"])
    assessment_id = db.session.execute(
        text(
            """
            INSERT INTO assessments
                (class_id, level_id, assessment_type, title, test_date,
                 score_min, score_max, status, created_by)
            OUTPUT INSERTED.id
            VALUES (:class_id, :level_id, :assessment_type, :title, :test_date,
                    :score_min, :score_max, 'DRAFT', :created_by)
            """
        ),
        {**payload, "created_by": actor.id},
    ).scalar_one()
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.CREATE,
            entity_name="assessments",
            entity_id=assessment_id,
            new_data={
                "class_id": payload["class_id"],
                "level_id": payload["level_id"],
                "assessment_type": payload["assessment_type"],
                "title": payload["title"],
                "test_date": payload["test_date"].isoformat(),
                "score_min": str(payload["score_min"]),
                "score_max": str(payload["score_max"]),
                "status": "DRAFT",
            },
            ip_address=ip_address,
        )
    )
    db.session.commit()
    return get_assessment(assessment_id, actor=actor)


def list_assessments(query: dict, *, actor: User) -> dict:
    conditions = []
    params = {}
    for field_name, column in (
        ("class_id", "a.class_id"),
        ("level_id", "a.level_id"),
        ("assessment_type", "a.assessment_type"),
        ("status", "a.status"),
    ):
        if query.get(field_name) is not None:
            conditions.append(f"{column} = :{field_name}")
            params[field_name] = query[field_name]
    if query.get("from_date") is not None:
        conditions.append("a.test_date >= :from_date")
        params["from_date"] = query["from_date"]
    if query.get("to_date") is not None:
        conditions.append("a.test_date <= :to_date")
        params["to_date"] = query["to_date"]
    _append_view_scope(conditions, params, actor)
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = db.session.execute(
        text(_assessment_select(where_clause) + " ORDER BY a.test_date DESC, a.id DESC"),
        params,
    ).mappings().all()
    return {"items": [_assessment_dict(row) for row in rows], "total": len(rows)}


def get_assessment(assessment_id: int, *, actor: User) -> dict:
    conditions = ["a.id = :assessment_id"]
    params = {"assessment_id": assessment_id}
    _append_view_scope(conditions, params, actor)
    row = db.session.execute(
        text(_assessment_select(f"WHERE {' AND '.join(conditions)}")), params
    ).mappings().one_or_none()
    if row is None:
        exists = db.session.execute(
            text("SELECT 1 FROM assessments WHERE id = :assessment_id"), params
        ).scalar_one_or_none()
        if exists is None:
            raise NotFoundError("Không tìm thấy đợt đánh giá")
        raise ForbiddenError(MSG_FORBIDDEN)
    return _assessment_dict(row)


def update_assessment(
    assessment_id: int, payload: dict, *, actor: User, ip_address: str | None
) -> dict:
    current = db.session.execute(
        text(_assessment_select("WHERE a.id = :assessment_id", lock=True)),
        {"assessment_id": assessment_id},
    ).mappings().one_or_none()
    if current is None:
        raise NotFoundError("Không tìm thấy đợt đánh giá")
    _require_assessment_editor(actor, current)
    if current["status"] != "DRAFT":
        raise ConflictError("Không thể sửa thông tin đợt đánh giá đã công bố")
    score_min = payload.get("score_min", current["score_min"])
    score_max = payload.get("score_max", current["score_max"])
    _validate_score_range(score_min, score_max)
    if ("score_min" in payload or "score_max" in payload) and db.session.execute(
        text("SELECT TOP 1 1 FROM assessment_results WHERE assessment_id = :id"),
        {"id": assessment_id},
    ).scalar_one_or_none() is not None:
        raise ConflictError("Không thể đổi thang điểm sau khi đã có kết quả")
    new_values = {
        "assessment_type": payload.get("assessment_type", current["assessment_type"]),
        "title": payload.get("title", current["title"]),
        "test_date": payload.get("test_date", current["test_date"]),
        "score_min": score_min,
        "score_max": score_max,
    }
    old_values = {key: current[key] for key in new_values}
    if new_values == old_values:
        raise ConflictError("Thông tin đợt đánh giá không có thay đổi")
    db.session.execute(
        text(
            """
            UPDATE assessments SET assessment_type = :assessment_type,
                title = :title, test_date = :test_date, score_min = :score_min,
                score_max = :score_max, updated_at = SYSDATETIMEOFFSET()
            WHERE id = :assessment_id
            """
        ),
        {**new_values, "assessment_id": assessment_id},
    )
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.UPDATE,
            entity_name="assessments",
            entity_id=assessment_id,
            old_data=_json_values(old_values),
            new_data=_json_values(new_values),
            ip_address=ip_address,
        )
    )
    db.session.commit()
    return get_assessment(assessment_id, actor=actor)


def list_assessment_results(assessment_id: int, *, actor: User) -> dict:
    assessment = _get_assessment_context(assessment_id)
    if actor.role.code in (RoleCode.MANAGER, RoleCode.LECTURER):
        _require_assessment_editor(actor, assessment)
    elif actor.role.code == RoleCode.TEACHING_ASSISTANT:
        raise ForbiddenError(MSG_FORBIDDEN)
    elif assessment["status"] != "PUBLISHED":
        raise ForbiddenError(MSG_FORBIDDEN)

    conditions = [
        "ce.class_id = :class_id",
        "ce.enrolled_date <= :test_date",
        "(ce.left_date IS NULL OR ce.left_date >= :test_date)",
        _level_at_date_sql() + " = :level_id",
    ]
    params = {
        "assessment_id": assessment_id,
        "class_id": assessment["class_id"],
        "test_date": assessment["test_date"],
        "level_id": assessment["level_id"],
    }
    if actor.role.code == RoleCode.STUDENT_PARENT:
        conditions.append(
            """(st.user_id = :actor_id OR EXISTS (
                    SELECT 1 FROM student_user_links sul
                    WHERE sul.student_id = st.id AND sul.user_id = :actor_id
                      AND sul.can_view = 1))"""
        )
        params["actor_id"] = actor.id
    rows = db.session.execute(
        text(
            f"""
            SELECT st.id AS student_id, st.student_code, st.full_name,
                   ar.id AS result_id, ar.score, ar.comment, ar.recorded_by,
                   ar.recorded_at, ar.updated_at
            FROM class_enrollments ce
            JOIN students st ON st.id = ce.student_id
            LEFT JOIN assessment_results ar
              ON ar.assessment_id = :assessment_id AND ar.student_id = st.id
            WHERE {' AND '.join(conditions)}
            ORDER BY st.student_code, st.id
            """
        ),
        params,
    ).mappings().all()
    if actor.role.code == RoleCode.STUDENT_PARENT and not rows:
        raise ForbiddenError(MSG_FORBIDDEN)
    return {
        "assessment_id": assessment_id,
        "status": assessment["status"],
        "score_min": assessment["score_min"],
        "score_max": assessment["score_max"],
        "items": [
            {
                "student": {
                    "id": row["student_id"],
                    "student_code": row["student_code"],
                    "full_name": row["full_name"],
                },
                "result": (
                    {
                        "id": row["result_id"],
                        "score": row["score"],
                        "comment": row["comment"],
                        "recorded_by": row["recorded_by"],
                        "recorded_at": row["recorded_at"],
                        "updated_at": row["updated_at"],
                    }
                    if row["result_id"] is not None
                    else None
                ),
            }
            for row in rows
        ],
    }


def record_assessment_results(
    assessment_id: int,
    items: list[dict],
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    assessment = _get_assessment_context(assessment_id, lock=True)
    _require_assessment_editor(actor, assessment)
    if assessment["status"] != "DRAFT":
        raise ConflictError("Không thể nhập điểm cho đợt đánh giá đã công bố")
    invalid_scores = [
        item["student_id"]
        for item in items
        if item["score"] < assessment["score_min"]
        or item["score"] > assessment["score_max"]
    ]
    if invalid_scores:
        raise ConflictError(
            "Có điểm nằm ngoài thang điểm",
            errors={"student_ids": sorted(invalid_scores)},
        )
    student_ids = [item["student_id"] for item in items]
    eligible_ids = set(
        db.session.execute(
            text(
                f"""
                SELECT st.id
                FROM students st
                JOIN class_enrollments ce ON ce.student_id = st.id
                WHERE ce.class_id = :class_id
                  AND ce.enrolled_date <= :test_date
                  AND (ce.left_date IS NULL OR ce.left_date >= :test_date)
                  AND {_level_at_date_sql()} = :level_id
                  AND st.id IN :student_ids
                """
            ).bindparams(bindparam("student_ids", expanding=True)),
            {
                "class_id": assessment["class_id"],
                "test_date": assessment["test_date"],
                "level_id": assessment["level_id"],
                "student_ids": student_ids,
            },
        ).scalars().all()
    )
    invalid_students = sorted(set(student_ids) - eligible_ids)
    if invalid_students:
        raise ConflictError(
            "Học sinh không thuộc lớp hoặc cấp độ tại ngày đánh giá",
            errors={"student_ids": invalid_students},
        )
    existing_ids = db.session.execute(
        text(
            """SELECT student_id FROM assessment_results WITH (UPDLOCK, HOLDLOCK)
               WHERE assessment_id = :assessment_id AND student_id IN :student_ids"""
        ).bindparams(bindparam("student_ids", expanding=True)),
        {"assessment_id": assessment_id, "student_ids": student_ids},
    ).scalars().all()
    if existing_ids:
        raise ConflictError(
            "Kết quả đã tồn tại; hãy dùng chức năng sửa điểm và cung cấp reason",
            errors={"student_ids": sorted(existing_ids)},
        )
    try:
        for item in items:
            result_id = db.session.execute(
                text(
                    """
                    INSERT INTO assessment_results
                        (assessment_id, student_id, score, comment, recorded_by)
                    OUTPUT INSERTED.id
                    VALUES (:assessment_id, :student_id, :score, :comment, :recorded_by)
                    """
                ),
                {
                    "assessment_id": assessment_id,
                    "student_id": item["student_id"],
                    "score": item["score"],
                    "comment": item.get("comment"),
                    "recorded_by": actor.id,
                },
            ).scalar_one()
            db.session.add(
                AuditLog(
                    actor_user_id=actor.id,
                    action=AuditAction.CREATE,
                    entity_name="assessment_results",
                    entity_id=result_id,
                    new_data={
                        "assessment_id": assessment_id,
                        "student_id": item["student_id"],
                        "score": str(item["score"]),
                        "comment": item.get("comment"),
                    },
                    ip_address=ip_address,
                )
            )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Kết quả đã được ghi đồng thời bởi yêu cầu khác") from exc
    return list_assessment_results(assessment_id, actor=actor)


def preview_result_import(
    assessment_id: int, *, uploaded_file, mode: str, actor: User
) -> dict:
    assessment = _get_assessment_context(assessment_id)
    _require_assessment_editor(actor, assessment)
    if assessment["status"] != "DRAFT":
        raise ConflictError("Không thể import điểm cho đợt đánh giá đã công bố")
    if mode not in {"CREATE_ONLY", "UPSERT"}:
        raise AppError("mode chỉ nhận CREATE_ONLY hoặc UPSERT", status_code=422)
    if uploaded_file is None or not uploaded_file.filename:
        raise AppError("Thiếu file Excel", status_code=422)
    if not uploaded_file.filename.lower().endswith(".xlsx"):
        raise AppError("Chỉ chấp nhận file .xlsx", status_code=422)
    content = uploaded_file.read()
    if not content:
        raise AppError("File Excel rỗng", status_code=422)
    if len(content) > 10 * 1024 * 1024:
        raise AppError("File Excel vượt quá 10 MB", status_code=413)
    try:
        workbook = load_workbook(BytesIO(content), read_only=True, data_only=True)
    except (InvalidFileException, OSError, ValueError, KeyError) as exc:
        raise AppError("File Excel không hợp lệ", status_code=422) from exc
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    workbook.close()
    expected_headers = ("student_code", "score", "comment")
    if not rows or tuple(rows[0]) != expected_headers:
        raise AppError(
            "Header phải đúng thứ tự: student_code, score, comment",
            status_code=422,
        )

    parsed_rows = []
    errors = []
    seen_codes = set()
    for row_number, values in enumerate(rows[1:], start=2):
        padded = tuple(values) + (None,) * (3 - len(values))
        student_code, raw_score, raw_comment = padded[:3]
        if student_code is None and raw_score is None and raw_comment is None:
            continue
        code = student_code.strip() if isinstance(student_code, str) else ""
        if not code:
            errors.append(_import_error(row_number, None, "student_code", "Mã học sinh không hợp lệ"))
            continue
        if code in seen_codes:
            errors.append(_import_error(row_number, code, "student_code", "Mã học sinh bị trùng trong file"))
            continue
        seen_codes.add(code)
        if isinstance(raw_score, bool) or not isinstance(raw_score, (int, float)):
            errors.append(_import_error(row_number, code, "score", "Điểm phải là số"))
            continue
        try:
            score = Decimal(str(raw_score)).quantize(Decimal("0.01"))
        except InvalidOperation:
            errors.append(_import_error(row_number, code, "score", "Điểm không hợp lệ"))
            continue
        if score < assessment["score_min"] or score > assessment["score_max"]:
            errors.append(_import_error(row_number, code, "score", "Điểm nằm ngoài thang điểm"))
            continue
        if raw_comment is not None and not isinstance(raw_comment, str):
            errors.append(_import_error(row_number, code, "comment", "Nhận xét phải là chuỗi"))
            continue
        comment = raw_comment.strip() or None if isinstance(raw_comment, str) else None
        if comment and len(comment) > 500:
            errors.append(_import_error(row_number, code, "comment", "Nhận xét tối đa 500 ký tự"))
            continue
        parsed_rows.append(
            {"row": row_number, "student_code": code, "score": score, "comment": comment}
        )

    if not parsed_rows and not errors:
        raise AppError("File không có dòng dữ liệu", status_code=422)
    if parsed_rows:
        codes = [row["student_code"] for row in parsed_rows]
        eligible = {
            row["student_code"]: row
            for row in db.session.execute(
                text(
                    f"""
                    SELECT st.id AS student_id, st.student_code,
                           ar.id AS result_id, ar.score AS current_score,
                           ar.comment AS current_comment
                    FROM students st
                    JOIN class_enrollments ce ON ce.student_id = st.id
                    LEFT JOIN assessment_results ar
                      ON ar.assessment_id = :assessment_id AND ar.student_id = st.id
                    WHERE ce.class_id = :class_id
                      AND ce.enrolled_date <= :test_date
                      AND (ce.left_date IS NULL OR ce.left_date >= :test_date)
                      AND {_level_at_date_sql()} = :level_id
                      AND st.student_code IN :codes
                    """
                ).bindparams(bindparam("codes", expanding=True)),
                {
                    "assessment_id": assessment_id,
                    "class_id": assessment["class_id"],
                    "test_date": assessment["test_date"],
                    "level_id": assessment["level_id"],
                    "codes": codes,
                },
            ).mappings().all()
        }
        for row in parsed_rows:
            current = eligible.get(row["student_code"])
            if current is None:
                errors.append(
                    _import_error(
                        row["row"],
                        row["student_code"],
                        "student_code",
                        "Học sinh không tồn tại hoặc không thuộc lớp/cấp độ tại ngày đánh giá",
                    )
                )
                continue
            if current["result_id"] is not None and mode == "CREATE_ONLY":
                errors.append(
                    _import_error(row["row"], row["student_code"], "student_code", "Kết quả đã tồn tại")
                )
                continue
            row["student_id"] = current["student_id"]
            row["result_id"] = current["result_id"]
            if current["result_id"] is None:
                row["action"] = "CREATE"
            elif current["current_score"] == row["score"] and current["current_comment"] == row["comment"]:
                row["action"] = "UNCHANGED"
            else:
                row["action"] = "UPDATE"

    valid_rows = [row for row in parsed_rows if "action" in row]
    if errors:
        return {
            "preview_id": None,
            "assessment_id": assessment_id,
            "mode": mode,
            "valid": False,
            "total_rows": len(parsed_rows) + len([e for e in errors if e["row"] is not None and e["student_code"] is None]),
            "create_count": sum(row.get("action") == "CREATE" for row in valid_rows),
            "update_count": sum(row.get("action") == "UPDATE" for row in valid_rows),
            "errors": sorted(errors, key=lambda item: item["row"] or 0),
            "expires_at": None,
        }

    preview_id = uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    serializable_rows = [
        {**row, "score": str(row["score"])} for row in valid_rows
    ]
    db.session.execute(
        text(
            """
            INSERT INTO assessment_import_previews
                (id, assessment_id, requested_by, import_mode, file_hash,
                 rows_json, expires_at)
            VALUES (:id, :assessment_id, :requested_by, :mode, :file_hash,
                    :rows_json, :expires_at)
            """
        ),
        {
            "id": str(preview_id),
            "assessment_id": assessment_id,
            "requested_by": actor.id,
            "mode": mode,
            "file_hash": hashlib.sha256(content).hexdigest(),
            "rows_json": json.dumps(serializable_rows, ensure_ascii=False),
            "expires_at": expires_at,
        },
    )
    db.session.commit()
    return {
        "preview_id": preview_id,
        "assessment_id": assessment_id,
        "mode": mode,
        "valid": True,
        "total_rows": len(valid_rows),
        "create_count": sum(row["action"] == "CREATE" for row in valid_rows),
        "update_count": sum(row["action"] == "UPDATE" for row in valid_rows),
        "errors": [],
        "expires_at": expires_at,
    }


def confirm_result_import(
    assessment_id: int,
    *,
    preview_id: UUID,
    actor: User,
    ip_address: str | None,
) -> dict:
    assessment = _get_assessment_context(assessment_id, lock=True)
    _require_assessment_editor(actor, assessment)
    if assessment["status"] != "DRAFT":
        raise ConflictError("Không thể import điểm cho đợt đánh giá đã công bố")
    preview = db.session.execute(
        text(
            """
            SELECT id, requested_by, import_mode, rows_json, expires_at, confirmed_at
            FROM assessment_import_previews WITH (UPDLOCK, ROWLOCK)
            WHERE id = :preview_id AND assessment_id = :assessment_id
            """
        ),
        {"preview_id": str(preview_id), "assessment_id": assessment_id},
    ).mappings().one_or_none()
    if preview is None:
        raise NotFoundError("Không tìm thấy preview import")
    if preview["requested_by"] != actor.id:
        raise ForbiddenError(MSG_FORBIDDEN)
    if preview["confirmed_at"] is not None:
        raise ConflictError("Preview import đã được xác nhận")
    if preview["expires_at"] <= datetime.now(timezone.utc):
        raise ConflictError("Preview import đã hết hạn")
    rows = json.loads(preview["rows_json"])
    student_ids = [row["student_id"] for row in rows]
    current_results = {
        row["student_id"]: row
        for row in db.session.execute(
            text(
                """SELECT id, student_id, score, comment
                   FROM assessment_results WITH (UPDLOCK, HOLDLOCK)
                   WHERE assessment_id = :assessment_id AND student_id IN :student_ids"""
            ).bindparams(bindparam("student_ids", expanding=True)),
            {"assessment_id": assessment_id, "student_ids": student_ids},
        ).mappings().all()
    }
    if preview["import_mode"] == "CREATE_ONLY" and current_results:
        raise ConflictError("Dữ liệu đã thay đổi sau preview; hãy preview lại")
    created = 0
    updated = 0
    try:
        for row in rows:
            score = Decimal(row["score"])
            current = current_results.get(row["student_id"])
            if current is None:
                result_id = db.session.execute(
                    text(
                        """INSERT INTO assessment_results
                            (assessment_id, student_id, score, comment, recorded_by)
                           OUTPUT INSERTED.id
                           VALUES (:assessment_id, :student_id, :score, :comment, :actor)"""
                    ),
                    {
                        "assessment_id": assessment_id,
                        "student_id": row["student_id"],
                        "score": score,
                        "comment": row["comment"],
                        "actor": actor.id,
                    },
                ).scalar_one()
                created += 1
                action = AuditAction.CREATE
                old_data = None
            elif current["score"] == score and current["comment"] == row["comment"]:
                continue
            else:
                result_id = current["id"]
                reason = f"Import Excel UPSERT từ preview {preview_id}"
                db.session.execute(
                    text(
                        """INSERT INTO assessment_result_histories
                            (result_id, old_score, new_score, old_comment, new_comment,
                             changed_by, reason)
                           VALUES (:result_id, :old_score, :new_score, :old_comment,
                                   :new_comment, :actor, :reason)"""
                    ),
                    {
                        "result_id": result_id,
                        "old_score": current["score"],
                        "new_score": score,
                        "old_comment": current["comment"],
                        "new_comment": row["comment"],
                        "actor": actor.id,
                        "reason": reason,
                    },
                )
                db.session.execute(
                    text(
                        """UPDATE assessment_results SET score = :score,
                                  comment = :comment, updated_at = SYSDATETIMEOFFSET()
                           WHERE id = :result_id"""
                    ),
                    {"score": score, "comment": row["comment"], "result_id": result_id},
                )
                updated += 1
                action = AuditAction.UPDATE
                old_data = {"score": str(current["score"]), "comment": current["comment"]}
            audit = AuditLog(
                actor_user_id=actor.id,
                action=action,
                entity_name="assessment_results",
                entity_id=result_id,
                new_data={
                    "assessment_id": assessment_id,
                    "student_id": row["student_id"],
                    "score": str(score),
                    "comment": row["comment"],
                    "source": "EXCEL_IMPORT",
                    "preview_id": str(preview_id),
                },
                ip_address=ip_address,
            )
            if old_data is not None:
                audit.old_data = old_data
            db.session.add(audit)
        db.session.execute(
            text(
                "UPDATE assessment_import_previews SET confirmed_at = SYSDATETIMEOFFSET() "
                "WHERE id = :preview_id"
            ),
            {"preview_id": str(preview_id)},
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Import xung đột với dữ liệu được ghi đồng thời") from exc
    return {
        "preview_id": preview_id,
        "assessment_id": assessment_id,
        "created": created,
        "updated": updated,
        "total": len(rows),
    }


def update_result(
    result_id: int, payload: dict, *, actor: User, ip_address: str | None
) -> dict:
    current = db.session.execute(
        text(
            """
            SELECT ar.id, ar.assessment_id, ar.student_id, ar.score, ar.comment,
                   ar.recorded_by, ar.recorded_at, ar.updated_at,
                   a.score_min, a.score_max,
                   c.lecturer_id AS class_lecturer_id,
                   c.assistant_id AS class_assistant_id
            FROM assessment_results ar WITH (UPDLOCK, ROWLOCK)
            JOIN assessments a ON a.id = ar.assessment_id
            JOIN classes c ON c.id = a.class_id
            WHERE ar.id = :result_id
            """
        ),
        {"result_id": result_id},
    ).mappings().one_or_none()
    if current is None:
        raise NotFoundError("Không tìm thấy kết quả học tập")
    _require_assessment_editor(actor, current)
    new_score = payload.get("score", current["score"])
    new_comment = payload.get("comment", current["comment"])
    if new_score < current["score_min"] or new_score > current["score_max"]:
        raise ConflictError("Điểm nằm ngoài thang điểm của đợt đánh giá")
    if new_score == current["score"] and new_comment == current["comment"]:
        raise ConflictError("Kết quả học tập không có thay đổi")
    db.session.execute(
        text(
            """INSERT INTO assessment_result_histories
                (result_id, old_score, new_score, old_comment, new_comment,
                 changed_by, reason)
               VALUES (:result_id, :old_score, :new_score, :old_comment,
                       :new_comment, :actor, :reason)"""
        ),
        {
            "result_id": result_id,
            "old_score": current["score"],
            "new_score": new_score,
            "old_comment": current["comment"],
            "new_comment": new_comment,
            "actor": actor.id,
            "reason": payload["reason"],
        },
    )
    db.session.execute(
        text(
            """UPDATE assessment_results SET score = :score, comment = :comment,
                      updated_at = SYSDATETIMEOFFSET() WHERE id = :result_id"""
        ),
        {"score": new_score, "comment": new_comment, "result_id": result_id},
    )
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.UPDATE,
            entity_name="assessment_results",
            entity_id=result_id,
            old_data={"score": str(current["score"]), "comment": current["comment"]},
            new_data={
                "score": str(new_score),
                "comment": new_comment,
                "reason": payload["reason"],
            },
            ip_address=ip_address,
        )
    )
    db.session.commit()
    return _get_result(result_id)


def set_assessment_publication(
    assessment_id: int,
    *,
    publish: bool,
    actor: User,
    ip_address: str | None,
) -> dict:
    assessment = _get_assessment_context(assessment_id, lock=True)
    _require_assessment_editor(actor, assessment)
    target_status = "PUBLISHED" if publish else "DRAFT"
    if assessment["status"] == target_status:
        raise ConflictError(
            "Đợt đánh giá đã được công bố" if publish else "Đợt đánh giá đang ở trạng thái DRAFT"
        )
    if publish:
        db.session.execute(
            text(
                """UPDATE assessments SET status = 'PUBLISHED', published_by = :actor,
                          published_at = SYSDATETIMEOFFSET(), updated_at = SYSDATETIMEOFFSET()
                   WHERE id = :assessment_id"""
            ),
            {"actor": actor.id, "assessment_id": assessment_id},
        )
    else:
        db.session.execute(
            text(
                """UPDATE assessments SET status = 'DRAFT', published_by = NULL,
                          published_at = NULL, updated_at = SYSDATETIMEOFFSET()
                   WHERE id = :assessment_id"""
            ),
            {"assessment_id": assessment_id},
        )
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.APPROVE if publish else AuditAction.UPDATE,
            entity_name="assessments",
            entity_id=assessment_id,
            old_data={"status": assessment["status"]},
            new_data={"status": target_status},
            ip_address=ip_address,
        )
    )
    db.session.commit()
    return get_assessment(assessment_id, actor=actor)


def list_student_results(student_id: int, *, actor: User) -> dict:
    require_student_access(actor, student_id)
    rows = db.session.execute(
        text(
            """
            SELECT a.id, a.class_id, a.level_id, a.assessment_type, a.title,
                   a.test_date, a.score_min, a.score_max, a.status, a.created_by,
                   a.created_at, a.updated_at, a.published_by, a.published_at,
                   c.class_code, c.name AS class_name,
                   c.lecturer_id AS class_lecturer_id,
                   c.assistant_id AS class_assistant_id,
                   l.code AS level_code, l.name AS level_name,
                   ar.id AS result_id, ar.score, ar.comment, ar.recorded_by,
                   ar.recorded_at, ar.updated_at AS result_updated_at
            FROM assessments a
            JOIN classes c ON c.id = a.class_id
            JOIN levels l ON l.id = a.level_id
            JOIN class_enrollments ce
              ON ce.class_id = a.class_id AND ce.student_id = :student_id
             AND ce.enrolled_date <= a.test_date
             AND (ce.left_date IS NULL OR ce.left_date >= a.test_date)
            JOIN students st ON st.id = ce.student_id
            LEFT JOIN assessment_results ar
              ON ar.assessment_id = a.id AND ar.student_id = st.id
            WHERE a.status = 'PUBLISHED'
              AND COALESCE(
                    (SELECT TOP 1 slt.new_level_id FROM student_level_transfers slt
                     WHERE slt.student_id = st.id
                       AND slt.effective_date <= a.test_date
                     ORDER BY slt.effective_date DESC, slt.id DESC),
                    (SELECT TOP 1 slt.old_level_id FROM student_level_transfers slt
                     WHERE slt.student_id = st.id
                       AND slt.effective_date > a.test_date
                     ORDER BY slt.effective_date ASC, slt.id ASC),
                    st.current_level_id
                  ) = a.level_id
            ORDER BY a.test_date DESC, a.id DESC
            """
        ),
        {"student_id": student_id},
    ).mappings().all()
    return {
        "student_id": student_id,
        "items": [
            {
                "assessment": _assessment_dict(row),
                "result": (
                    {
                        "id": row["result_id"],
                        "score": row["score"],
                        "comment": row["comment"],
                        "recorded_by": row["recorded_by"],
                        "recorded_at": row["recorded_at"],
                        "updated_at": row["result_updated_at"],
                    }
                    if row["result_id"] is not None
                    else None
                ),
            }
            for row in rows
        ],
        "total": len(rows),
    }


def export_assessment_results(assessment_id: int, *, actor: User):
    assessment = _get_assessment_context(assessment_id)
    _require_assessment_editor(actor, assessment)
    roster = list_assessment_results(assessment_id, actor=actor)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Ket qua"
    sheet.append(["Đợt đánh giá", assessment["title"]])
    sheet.append(["Lớp", assessment["class_name"]])
    sheet.append(["Cấp độ", assessment["level_name"]])
    sheet.append(["Ngày kiểm tra", assessment["test_date"]])
    sheet.append(["Trạng thái", assessment["status"]])
    sheet.append([])
    sheet.append(["Mã học sinh", "Họ tên", "Điểm", "Nhận xét"])
    for item in roster["items"]:
        result = item["result"]
        sheet.append(
            [
                _safe_excel_text(item["student"]["student_code"]),
                _safe_excel_text(item["student"]["full_name"]),
                float(result["score"]) if result is not None else None,
                _safe_excel_text(result["comment"]) if result is not None else None,
            ]
        )
    _style_export_sheet(sheet, header_row=7)
    return _workbook_bytes(workbook), f"assessment-{assessment_id}-results.xlsx"


def export_class_results(class_id: int, *, actor: User):
    class_row = _get_class_context(class_id)
    _require_assessment_editor(actor, class_row)
    assessments = list_assessments({"class_id": class_id}, actor=actor)["items"]
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Ket qua lop"
    sheet.append(["Lớp", _class_name(class_id)])
    sheet.append([])
    sheet.append(
        [
            "Đợt đánh giá",
            "Loại",
            "Ngày kiểm tra",
            "Trạng thái",
            "Mã học sinh",
            "Họ tên",
            "Điểm",
            "Nhận xét",
        ]
    )
    for assessment in assessments:
        roster = list_assessment_results(assessment["id"], actor=actor)
        for item in roster["items"]:
            result = item["result"]
            sheet.append(
                [
                    _safe_excel_text(assessment["title"]),
                    assessment["assessment_type"],
                    assessment["test_date"],
                    assessment["status"],
                    _safe_excel_text(item["student"]["student_code"]),
                    _safe_excel_text(item["student"]["full_name"]),
                    float(result["score"]) if result is not None else None,
                    _safe_excel_text(result["comment"]) if result is not None else None,
                ]
            )
    _style_export_sheet(sheet, header_row=3)
    return _workbook_bytes(workbook), f"class-{class_id}-results.xlsx"


def _class_name(class_id: int) -> str:
    return db.session.execute(
        text("SELECT name FROM classes WHERE id = :class_id"), {"class_id": class_id}
    ).scalar_one()


def _safe_excel_text(value):
    if value is None:
        return None
    text_value = str(value)
    if text_value.startswith(("=", "+", "-", "@")):
        return "'" + text_value
    return text_value


def _style_export_sheet(sheet, *, header_row: int) -> None:
    fill = PatternFill("solid", fgColor="1F4E78")
    for cell in sheet[header_row]:
        cell.font = Font(color="FFFFFF", bold=True)
        cell.fill = fill
        cell.alignment = Alignment(horizontal="center")
    sheet.freeze_panes = f"A{header_row + 1}"
    for column in sheet.columns:
        width = min(max(len(str(cell.value or "")) for cell in column) + 2, 50)
        sheet.column_dimensions[column[0].column_letter].width = width


def _workbook_bytes(workbook: Workbook) -> BytesIO:
    stream = BytesIO()
    workbook.save(stream)
    stream.seek(0)
    return stream


def _get_result(result_id: int) -> dict:
    row = db.session.execute(
        text(
            """SELECT id, assessment_id, student_id, score, comment, recorded_by,
                      recorded_at, updated_at
               FROM assessment_results WHERE id = :result_id"""
        ),
        {"result_id": result_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy kết quả học tập")
    return dict(row)


def _import_error(row, student_code, field, message):
    return {"row": row, "student_code": student_code, "field": field, "message": message}


def _get_assessment_context(assessment_id: int, *, lock: bool = False):
    row = db.session.execute(
        text(_assessment_select("WHERE a.id = :assessment_id", lock=lock)),
        {"assessment_id": assessment_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy đợt đánh giá")
    return row


def _level_at_date_sql() -> str:
    return """COALESCE(
        (SELECT TOP 1 slt.new_level_id FROM student_level_transfers slt
         WHERE slt.student_id = st.id AND slt.effective_date <= :test_date
         ORDER BY slt.effective_date DESC, slt.id DESC),
        (SELECT TOP 1 slt.old_level_id FROM student_level_transfers slt
         WHERE slt.student_id = st.id AND slt.effective_date > :test_date
         ORDER BY slt.effective_date ASC, slt.id ASC),
        st.current_level_id
    )"""


def _validate_score_range(score_min: Decimal, score_max: Decimal) -> None:
    if score_min < 0 or score_max <= score_min:
        raise ConflictError("Thang điểm không hợp lệ")


def _get_class_context(class_id: int):
    row = db.session.execute(
        text(
            """
            SELECT c.id, c.lecturer_id AS class_lecturer_id,
                   c.assistant_id AS class_assistant_id, co.level_id
            FROM classes c JOIN courses co ON co.id = c.course_id
            WHERE c.id = :class_id
            """
        ),
        {"class_id": class_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy lớp")
    return row


def _require_assessment_editor(actor: User, context) -> None:
    if actor.role.code == RoleCode.MANAGER:
        return
    if actor.role.code != RoleCode.LECTURER:
        raise ForbiddenError(MSG_FORBIDDEN)
    staff_id = db.session.execute(
        text("SELECT id FROM staff_profiles WHERE user_id = :user_id"),
        {"user_id": actor.id},
    ).scalar_one_or_none()
    if staff_id is None or staff_id != context["class_lecturer_id"]:
        raise ForbiddenError(MSG_FORBIDDEN)


def _append_view_scope(conditions: list, params: dict, actor: User) -> None:
    if actor.role.code == RoleCode.MANAGER:
        return
    if actor.role.code == RoleCode.LECTURER:
        conditions.append(
            "EXISTS (SELECT 1 FROM staff_profiles sp "
            "WHERE sp.user_id = :actor_id AND sp.id = c.lecturer_id)"
        )
        params["actor_id"] = actor.id
        return
    if actor.role.code == RoleCode.TEACHING_ASSISTANT:
        raise ForbiddenError(MSG_FORBIDDEN)
    conditions.extend(
        [
            "a.status = 'PUBLISHED'",
            """EXISTS (SELECT 1 FROM assessment_results ar
                        JOIN students st ON st.id = ar.student_id
                        WHERE ar.assessment_id = a.id AND
                        (st.user_id = :actor_id OR EXISTS (
                            SELECT 1 FROM student_user_links sul
                            WHERE sul.student_id = st.id AND sul.user_id = :actor_id
                              AND sul.can_view = 1)))""",
        ]
    )
    params["actor_id"] = actor.id


def _assessment_select(where_clause: str, *, lock: bool = False) -> str:
    table = "assessments a WITH (UPDLOCK, ROWLOCK)" if lock else "assessments a"
    return f"""
        SELECT a.id, a.class_id, a.level_id, a.assessment_type, a.title,
               a.test_date, a.score_min, a.score_max, a.status, a.created_by,
               a.created_at, a.updated_at, a.published_by, a.published_at,
               c.class_code, c.name AS class_name,
               c.lecturer_id AS class_lecturer_id,
               c.assistant_id AS class_assistant_id,
               l.code AS level_code, l.name AS level_name
        FROM {table}
        JOIN classes c ON c.id = a.class_id
        JOIN levels l ON l.id = a.level_id
        {where_clause}
    """


def _assessment_dict(row) -> dict:
    return {
        "id": row["id"],
        "class_info": {"id": row["class_id"], "class_code": row["class_code"], "name": row["class_name"]},
        "level": {"id": row["level_id"], "code": row["level_code"], "name": row["level_name"]},
        "assessment_type": row["assessment_type"],
        "title": row["title"],
        "test_date": row["test_date"],
        "score_min": row["score_min"],
        "score_max": row["score_max"],
        "status": row["status"],
        "created_by": row["created_by"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "published_by": row["published_by"],
        "published_at": row["published_at"],
    }


def _json_values(values: dict) -> dict:
    return {
        key: value.isoformat() if hasattr(value, "isoformat") else str(value) if isinstance(value, Decimal) else value
        for key, value in values.items()
    }
