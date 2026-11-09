from datetime import timedelta
import json

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.common.errors import ConflictError, ForbiddenError, NotFoundError
from app.extensions import db
from app.middlewares.auth import MSG_FORBIDDEN
from app.models import AuditAction, AuditLog, RoleCode, User


SIBLING_DISCOUNT_AMOUNT = 100000


def create_policy(payload: dict, *, actor: User, ip_address: str | None) -> dict:
    overlap = db.session.execute(
        text(
            """
            SELECT TOP 1 id
            FROM tuition_business_policies WITH (UPDLOCK, HOLDLOCK)
            WHERE effective_from <= COALESCE(:effective_to, CONVERT(date, '99991231', 112))
              AND COALESCE(effective_to, CONVERT(date, '99991231', 112)) >= :effective_from
            """
        ),
        {
            "effective_from": payload["effective_from"],
            "effective_to": payload.get("effective_to"),
        },
    ).scalar_one_or_none()
    if overlap is not None:
        raise ConflictError("Khoảng hiệu lực chính sách học phí bị trùng")
    version = db.session.execute(
        text("SELECT COALESCE(MAX(version), 0) + 1 FROM tuition_business_policies")
    ).scalar_one()
    policy_id = db.session.execute(
        text(
            """
            INSERT INTO tuition_business_policies
                (version, base_amount, sessions_per_cycle, unit_amount,
                 absence_threshold, eligible_absence_statuses,
                 cancellation_after_issue_mode, effective_from, effective_to,
                 created_by)
            OUTPUT INSERTED.id
            VALUES (:version, 1000000, 8, 125000, 4, :eligible_statuses,
                    :cancellation_mode, :effective_from, :effective_to, :created_by)
            """
        ),
        {
            "version": version,
            "eligible_statuses": json.dumps(payload["eligible_absence_statuses"]),
            "cancellation_mode": payload.get("cancellation_after_issue_mode"),
            "effective_from": payload["effective_from"],
            "effective_to": payload.get("effective_to"),
            "created_by": actor.id,
        },
    ).scalar_one()
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.CREATE,
            entity_name="tuition_business_policies",
            entity_id=policy_id,
            new_data={
                "version": version,
                "base_amount": 1000000,
                "sessions_per_cycle": 8,
                "unit_amount": 125000,
                "absence_threshold": 4,
                "eligible_absence_statuses": payload["eligible_absence_statuses"],
                "cancellation_after_issue_mode": payload.get(
                    "cancellation_after_issue_mode"
                ),
                "effective_from": payload["effective_from"].isoformat(),
                "effective_to": (
                    payload["effective_to"].isoformat()
                    if payload.get("effective_to")
                    else None
                ),
            },
            ip_address=ip_address,
        )
    )
    db.session.commit()
    return _get_policy(policy_id)


def list_policies() -> dict:
    ids = db.session.execute(
        text("SELECT id FROM tuition_business_policies ORDER BY version DESC")
    ).scalars().all()
    return {"items": [_get_policy(policy_id) for policy_id in ids], "total": len(ids)}


def _get_policy(policy_id: int) -> dict:
    row = db.session.execute(
        text("SELECT * FROM tuition_business_policies WHERE id = :id"),
        {"id": policy_id},
    ).mappings().one()
    result = dict(row)
    result["eligible_absence_statuses"] = json.loads(
        result["eligible_absence_statuses"]
    )
    return result


def create_sibling_relationship(
    student_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    sibling_student_id = payload["sibling_student_id"]
    if student_id == sibling_student_id:
        raise ConflictError("Học sinh không thể là anh/chị/em của chính mình")

    first_student_id, second_student_id = sorted((student_id, sibling_student_id))
    students = db.session.execute(
        text(
            """
            SELECT id, status
            FROM students WITH (UPDLOCK, HOLDLOCK)
            WHERE id IN (:first_student_id, :second_student_id)
            ORDER BY id
            """
        ),
        {
            "first_student_id": first_student_id,
            "second_student_id": second_student_id,
        },
    ).mappings().all()
    if len(students) != 2:
        raise NotFoundError("Không tìm thấy một hoặc cả hai học sinh")
    if any(student["status"] != "ACTIVE" for student in students):
        raise ConflictError("Chỉ có thể xác nhận quan hệ giữa hai học sinh đang hoạt động")

    overlap = db.session.execute(
        text(
            """
            SELECT TOP 1 id
            FROM sibling_relationships WITH (UPDLOCK, HOLDLOCK)
            WHERE student_id = :first_student_id
              AND sibling_student_id = :second_student_id
              AND status = 'ACTIVE'
              AND valid_from <= COALESCE(:valid_to, CONVERT(date, '99991231', 112))
              AND COALESCE(valid_to, CONVERT(date, '99991231', 112)) >= :valid_from
            """
        ),
        {
            "first_student_id": first_student_id,
            "second_student_id": second_student_id,
            "valid_from": payload["valid_from"],
            "valid_to": payload.get("valid_to"),
        },
    ).scalar_one_or_none()
    if overlap is not None:
        raise ConflictError("Khoảng hiệu lực quan hệ anh/chị/em bị trùng")

    relationship_id = db.session.execute(
        text(
            """
            INSERT INTO sibling_relationships
                (student_id, sibling_student_id, valid_from, valid_to,
                 status, reason, approved_by)
            OUTPUT INSERTED.id
            VALUES (:student_id, :sibling_student_id, :valid_from, :valid_to,
                    'ACTIVE', :reason, :approved_by)
            """
        ),
        {
            "student_id": first_student_id,
            "sibling_student_id": second_student_id,
            "valid_from": payload["valid_from"],
            "valid_to": payload.get("valid_to"),
            "reason": payload["reason"],
            "approved_by": actor.id,
        },
    ).scalar_one()
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.CREATE,
            entity_name="sibling_relationships",
            entity_id=relationship_id,
            new_data={
                "student_id": first_student_id,
                "sibling_student_id": second_student_id,
                "valid_from": payload["valid_from"].isoformat(),
                "valid_to": (
                    payload["valid_to"].isoformat() if payload.get("valid_to") else None
                ),
                "status": "ACTIVE",
                "reason": payload["reason"],
                "approved_by": actor.id,
            },
            ip_address=ip_address,
        )
    )
    db.session.commit()
    row = db.session.execute(
        text("SELECT * FROM sibling_relationships WHERE id = :id"),
        {"id": relationship_id},
    ).mappings().one()
    return dict(row)


def generate_cycle(enrollment_id: int, *, actor: User, ip_address: str | None) -> dict:
    enrollment = db.session.execute(
        text(
            """
            SELECT ce.id, ce.class_id, ce.student_id, ce.enrolled_date, ce.left_date,
                   ce.status, st.student_code, st.full_name,
                   c.class_code, c.name AS class_name
            FROM class_enrollments ce WITH (UPDLOCK, ROWLOCK)
            JOIN students st ON st.id = ce.student_id
            JOIN classes c ON c.id = ce.class_id
            WHERE ce.id = :enrollment_id
            """
        ),
        {"enrollment_id": enrollment_id},
    ).mappings().one_or_none()
    if enrollment is None:
        raise NotFoundError("Không tìm thấy ghi danh")
    sessions = db.session.execute(
        text(
            """
            SELECT TOP 8 s.id, s.session_date, s.start_time, s.end_time, s.status
            FROM class_sessions s WITH (UPDLOCK, HOLDLOCK)
            WHERE s.class_id = :class_id
              AND s.session_date >= :enrolled_date
              AND (:left_date IS NULL OR s.session_date <= :left_date)
              AND NOT EXISTS (
                  SELECT 1 FROM tuition_cycle_sessions tcs
                  WHERE tcs.enrollment_id = :enrollment_id AND tcs.session_id = s.id
              )
            ORDER BY s.session_date, s.start_time, s.id
            """
        ),
        {
            "class_id": enrollment["class_id"],
            "enrolled_date": enrollment["enrolled_date"],
            "left_date": enrollment["left_date"],
            "enrollment_id": enrollment_id,
        },
    ).mappings().all()
    if len(sessions) < 8:
        raise ConflictError(
            "Chưa đủ 8 buổi chưa được xếp chu kỳ cho ghi danh này",
            errors={"available_sessions": len(sessions), "required_sessions": 8},
        )
    cycle_number = db.session.execute(
        text(
            "SELECT COALESCE(MAX(cycle_number), 0) + 1 FROM tuition_cycles "
            "WHERE enrollment_id = :enrollment_id"
        ),
        {"enrollment_id": enrollment_id},
    ).scalar_one()
    try:
        cycle_id = db.session.execute(
            text(
                """
                INSERT INTO tuition_cycles
                    (enrollment_id, cycle_number, start_session_id, end_session_id,
                     start_date, end_date, status, created_by)
                OUTPUT INSERTED.id
                VALUES (:enrollment_id, :cycle_number, :start_session_id,
                        :end_session_id, :start_date, :end_date, 'DRAFT', :created_by)
                """
            ),
            {
                "enrollment_id": enrollment_id,
                "cycle_number": cycle_number,
                "start_session_id": sessions[0]["id"],
                "end_session_id": sessions[-1]["id"],
                "start_date": sessions[0]["session_date"],
                "end_date": sessions[-1]["session_date"],
                "created_by": actor.id,
            },
        ).scalar_one()
        for sequence_no, session in enumerate(sessions, start=1):
            db.session.execute(
                text(
                    """INSERT INTO tuition_cycle_sessions
                        (cycle_id, enrollment_id, session_id, sequence_no)
                       VALUES (:cycle_id, :enrollment_id, :session_id, :sequence_no)"""
                ),
                {
                    "cycle_id": cycle_id,
                    "enrollment_id": enrollment_id,
                    "session_id": session["id"],
                    "sequence_no": sequence_no,
                },
            )
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="tuition_cycles",
                entity_id=cycle_id,
                new_data={
                    "enrollment_id": enrollment_id,
                    "cycle_number": cycle_number,
                    "session_ids": [session["id"] for session in sessions],
                    "status": "DRAFT",
                },
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Một hoặc nhiều buổi đã được xếp vào chu kỳ đồng thời") from exc
    return get_cycle(cycle_id, actor=actor)


def get_cycle(cycle_id: int, *, actor: User) -> dict:
    row = db.session.execute(
        text(
            """
            SELECT tc.id, tc.enrollment_id, tc.cycle_number,
                   tc.start_session_id, tc.end_session_id, tc.start_date, tc.end_date,
                   tc.status, tc.policy_id, tc.created_by, tc.created_at,
                   tc.calculated_at, tc.issued_at,
                   tc.base_amount, tc.policy_discount_amount,
                   tc.absence_credit_amount, tc.cancellation_credit_amount,
                   tc.manual_adjustment_amount, tc.final_amount,
                   st.id AS student_id, st.student_code, st.full_name,
                   c.id AS class_id, c.class_code, c.name AS class_name,
                   st.user_id AS student_user_id
            FROM tuition_cycles tc
            JOIN class_enrollments ce ON ce.id = tc.enrollment_id
            JOIN students st ON st.id = ce.student_id
            JOIN classes c ON c.id = ce.class_id
            WHERE tc.id = :cycle_id
            """
        ),
        {"cycle_id": cycle_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy chu kỳ học phí")
    if actor.role.code != RoleCode.MANAGER:
        if actor.role.code != RoleCode.STUDENT_PARENT:
            raise ForbiddenError(MSG_FORBIDDEN)
        linked = row["student_user_id"] == actor.id or db.session.execute(
            text(
                "SELECT 1 FROM student_user_links WHERE student_id = :student_id "
                "AND user_id = :user_id AND can_view = 1"
            ),
            {"student_id": row["student_id"], "user_id": actor.id},
        ).scalar_one_or_none()
        if not linked:
            raise ForbiddenError(MSG_FORBIDDEN)
    sessions = db.session.execute(
        text(
            """
            SELECT tcs.sequence_no, s.id, s.session_date, s.start_time,
                   s.end_time, s.status
            FROM tuition_cycle_sessions tcs
            JOIN class_sessions s ON s.id = tcs.session_id
            WHERE tcs.cycle_id = :cycle_id
            ORDER BY tcs.sequence_no
            """
        ),
        {"cycle_id": cycle_id},
    ).mappings().all()
    return {
        "id": row["id"],
        "enrollment_id": row["enrollment_id"],
        "cycle_number": row["cycle_number"],
        "student": {
            "id": row["student_id"],
            "student_code": row["student_code"],
            "full_name": row["full_name"],
        },
        "class_info": {
            "id": row["class_id"],
            "class_code": row["class_code"],
            "name": row["class_name"],
        },
        "start_session_id": row["start_session_id"],
        "end_session_id": row["end_session_id"],
        "start_date": row["start_date"],
        "end_date": row["end_date"],
        "status": row["status"],
        "policy_id": row["policy_id"],
        "created_by": row["created_by"],
        "created_at": row["created_at"],
        "calculated_at": row["calculated_at"],
        "issued_at": row["issued_at"],
        "base_amount": row["base_amount"],
        "policy_discount_amount": row["policy_discount_amount"],
        "absence_credit_amount": row["absence_credit_amount"],
        "cancellation_credit_amount": row["cancellation_credit_amount"],
        "manual_adjustment_amount": row["manual_adjustment_amount"],
        "final_amount": row["final_amount"],
        "sessions": [dict(session) for session in sessions],
    }


def issue_cycle(cycle_id: int, *, actor: User, ip_address: str | None) -> dict:
    cycle = _get_cycle_context(cycle_id, lock=True)
    existing = _get_cycle_invoice(cycle_id)
    if existing is not None:
        return {
            "cycle": get_cycle(cycle_id, actor=actor),
            "invoice": existing,
            "notifications_created": 0,
        }
    if cycle["status"] not in {"DRAFT", "CALCULATED"}:
        raise ConflictError("Chu kỳ không thể phát hành")
    if cycle["status"] == "DRAFT":
        calculate_cycle(cycle_id, actor=actor, ip_address=ip_address)
        cycle = _get_cycle_context(cycle_id, lock=True)
    billing_month = cycle["start_date"].replace(day=1)
    due_date = cycle["start_date"] + timedelta(days=7)
    invoice_code = f"TC{cycle_id:08d}"
    try:
        invoice_id = db.session.execute(
            text(
                """
                INSERT INTO tuition_invoices
                    (invoice_code, student_id, class_id, billing_month,
                     base_amount, discount_amount, policy_discount_snapshot,
                     absence_credit_snapshot, cancellation_credit_snapshot,
                     manual_adjustment_snapshot, final_amount, paid_amount,
                     due_date, status, generated_by, tuition_cycle_id)
                OUTPUT INSERTED.id
                VALUES (:invoice_code, :student_id, :class_id, :billing_month,
                        :base_amount, :discount_amount, :policy_discount,
                        :absence_credit, :cancellation_credit, :manual_adjustment,
                        :final_amount, 0,
                        :due_date, 'UNPAID',
                        'MANUAL', :cycle_id)
                """
            ),
            {
                "invoice_code": invoice_code,
                "student_id": cycle["student_id"],
                "class_id": cycle["class_id"],
                "billing_month": billing_month,
                "due_date": due_date,
                "cycle_id": cycle_id,
                "base_amount": cycle["base_amount"],
                "discount_amount": max(
                    0, cycle["base_amount"] - cycle["final_amount"]
                ),
                "policy_discount": cycle["policy_discount_amount"],
                "absence_credit": cycle["absence_credit_amount"],
                "cancellation_credit": cycle["cancellation_credit_amount"],
                "manual_adjustment": cycle["manual_adjustment_amount"],
                "final_amount": cycle["final_amount"],
            },
        ).scalar_one()
        # Header/cycle amounts remain authoritative. Store the matching base
        # tuition line in the same transaction for the itemized FE invoice.
        db.session.execute(
            text(
                """INSERT INTO tuition_invoice_items
                    (invoice_id, line_no, item_type, description, amount)
                   VALUES (:invoice_id, 1, 'TUITION', N'Học phí chu kỳ 8 buổi', :amount)"""
            ),
            {"invoice_id": invoice_id, "amount": cycle["base_amount"]},
        )
        db.session.execute(
            text(
                """UPDATE tuition_cycles SET status = 'ISSUED',
                          issued_at = SYSDATETIMEOFFSET(),
                          calculated_at = COALESCE(calculated_at, SYSDATETIMEOFFSET())
                   WHERE id = :cycle_id"""
            ),
            {"cycle_id": cycle_id},
        )
        recipient_ids = db.session.execute(
            text(
                """
                SELECT user_id FROM students WHERE id = :student_id AND user_id IS NOT NULL
                UNION
                SELECT user_id FROM student_user_links
                WHERE student_id = :student_id AND can_view = 1
                """
            ),
            {"student_id": cycle["student_id"]},
        ).scalars().all()
        for recipient_id in recipient_ids:
            db.session.execute(
                text(
                    """INSERT INTO notifications
                        (recipient_user_id, notification_type, title, content,
                         related_invoice_id, created_by)
                       VALUES (:recipient, 'TUITION', N'Học phí chu kỳ mới',
                               :content, :invoice_id, :actor)"""
                ),
                {
                    "recipient": recipient_id,
                    "content": f"Chu kỳ {cycle['cycle_number']} đã được phát hành.",
                    "invoice_id": invoice_id,
                    "actor": actor.id,
                },
            )
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="tuition_invoices",
                entity_id=invoice_id,
                new_data={
                    "tuition_cycle_id": cycle_id,
                    "base_amount": int(cycle["base_amount"]),
                    "final_amount": int(cycle["final_amount"]),
                    "status": "UNPAID",
                },
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        existing = _get_cycle_invoice(cycle_id)
        if existing is None:
            raise ConflictError("Invoice được phát hành đồng thời nhưng không thể đọc lại") from exc
        return {
            "cycle": get_cycle(cycle_id, actor=actor),
            "invoice": existing,
            "notifications_created": 0,
        }
    return {
        "cycle": get_cycle(cycle_id, actor=actor),
        "invoice": _get_cycle_invoice(cycle_id),
        "notifications_created": len(recipient_ids),
    }


def _get_cycle_context(cycle_id: int, *, lock: bool = False):
    lock_sql = "WITH (UPDLOCK, ROWLOCK)" if lock else ""
    row = db.session.execute(
        text(
            f"""
            SELECT tc.id, tc.enrollment_id, tc.cycle_number, tc.start_date,
                   tc.end_date, tc.status, tc.policy_id, tc.base_amount,
                   tc.policy_discount_amount, tc.absence_credit_amount,
                   tc.cancellation_credit_amount, tc.manual_adjustment_amount,
                   tc.final_amount,
                   ce.student_id, ce.class_id
            FROM tuition_cycles tc {lock_sql}
            JOIN class_enrollments ce ON ce.id = tc.enrollment_id
            WHERE tc.id = :cycle_id
            """
        ),
        {"cycle_id": cycle_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Không tìm thấy chu kỳ học phí")
    return row


def calculate_cycle(cycle_id: int, *, actor: User, ip_address: str | None) -> dict:
    cycle = _get_cycle_context(cycle_id, lock=True)
    if cycle["status"] == "ISSUED":
        return _reconcile_issued_cycle_cancellations(
            cycle, actor=actor, ip_address=ip_address
        )
    if cycle["status"] == "CLOSED":
        raise ConflictError("Không thể tính lại chu kỳ đã phát hành bằng chức năng này")
    old_data = (
        {
            "base_amount": int(cycle["base_amount"]),
            "final_amount": int(cycle["final_amount"]),
        }
        if cycle["base_amount"] is not None
        else None
    )
    sibling_relationship = db.session.execute(
        text(
            """
            SELECT TOP 1 sr.id
            FROM sibling_relationships sr
            JOIN students sibling ON sibling.id = CASE
                WHEN sr.student_id = :student_id THEN sr.sibling_student_id
                ELSE sr.student_id
            END
            WHERE (sr.student_id = :student_id OR sr.sibling_student_id = :student_id)
              AND sr.status = 'ACTIVE'
              AND sibling.status = 'ACTIVE'
              AND sr.valid_from <= :cycle_start_date
              AND (sr.valid_to IS NULL OR sr.valid_to >= :cycle_start_date)
            ORDER BY sr.valid_from, sr.id
            """
        ),
        {
            "student_id": cycle["student_id"],
            "cycle_start_date": cycle["start_date"],
        },
    ).scalar_one_or_none()
    active_adjustment = db.session.execute(
        text(
            """
            SELECT id, amount
            FROM tuition_adjustments WITH (UPDLOCK, HOLDLOCK)
            WHERE cycle_id = :cycle_id
              AND adjustment_type = 'SIBLING_DISCOUNT'
              AND status = 'ACTIVE'
            """
        ),
        {"cycle_id": cycle_id},
    ).mappings().one_or_none()
    sibling_discount = SIBLING_DISCOUNT_AMOUNT if sibling_relationship is not None else 0
    if sibling_discount and active_adjustment is None:
        adjustment_id = db.session.execute(
            text(
                """
                INSERT INTO tuition_adjustments
                    (cycle_id, adjustment_type, amount, status, reason,
                     approved_by, created_by)
                OUTPUT INSERTED.id
                VALUES (:cycle_id, 'SIBLING_DISCOUNT', :amount, 'ACTIVE',
                        N'Giảm học phí theo quan hệ anh/chị/em đã xác nhận',
                        :actor_id, :actor_id)
                """
            ),
            {"cycle_id": cycle_id, "amount": sibling_discount, "actor_id": actor.id},
        ).scalar_one()
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="tuition_adjustments",
                entity_id=adjustment_id,
                new_data={
                    "cycle_id": cycle_id,
                    "adjustment_type": "SIBLING_DISCOUNT",
                    "amount": sibling_discount,
                    "status": "ACTIVE",
                    "sibling_relationship_id": sibling_relationship,
                },
                ip_address=ip_address,
            )
        )
    elif not sibling_discount and active_adjustment is not None:
        db.session.execute(
            text("UPDATE tuition_adjustments SET status = 'REVERSED' WHERE id = :id"),
            {"id": active_adjustment["id"]},
        )
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.UPDATE,
                entity_name="tuition_adjustments",
                entity_id=active_adjustment["id"],
                old_data={"status": "ACTIVE", "amount": int(active_adjustment["amount"])},
                new_data={"status": "REVERSED", "amount": int(active_adjustment["amount"])},
                ip_address=ip_address,
            )
        )

    current_policy = _find_effective_policy(cycle["start_date"])
    _sync_absence_credit(cycle, actor=actor, ip_address=ip_address)
    _sync_cancellation_credits(cycle, actor=actor, ip_address=ip_address)
    adjustment_totals = db.session.execute(
        text(
            """
            SELECT
                COALESCE(SUM(CASE WHEN adjustment_type = 'ABSENCE_CREDIT'
                                  THEN amount ELSE 0 END), 0) AS absence_credit,
                COALESCE(SUM(CASE WHEN adjustment_type = 'CANCELLATION_CREDIT'
                                  THEN amount ELSE 0 END), 0) AS cancellation_credit,
                COALESCE(SUM(CASE WHEN adjustment_type = 'MANUAL'
                                  THEN amount ELSE 0 END), 0) AS manual_adjustment
            FROM tuition_adjustments
            WHERE cycle_id = :cycle_id AND status = 'ACTIVE'
            """
        ),
        {"cycle_id": cycle_id},
    ).mappings().one()
    absence_credit = int(adjustment_totals["absence_credit"])
    cancellation_credit = int(adjustment_totals["cancellation_credit"])
    manual_adjustment = int(adjustment_totals["manual_adjustment"])
    final_amount = max(
        0,
        1000000
        - sibling_discount
        - absence_credit
        - cancellation_credit
        + manual_adjustment,
    )
    db.session.execute(
        text(
            """UPDATE tuition_cycles
               SET status = 'CALCULATED', base_amount = 1000000,
                   policy_id = :policy_id,
                   policy_discount_amount = :sibling_discount,
                   absence_credit_amount = :absence_credit,
                   cancellation_credit_amount = :cancellation_credit,
                   manual_adjustment_amount = :manual_adjustment,
                   final_amount = :final_amount, calculated_at = SYSDATETIMEOFFSET()
               WHERE id = :cycle_id"""
        ),
        {
            "cycle_id": cycle_id,
            "policy_id": current_policy["id"] if current_policy else None,
            "sibling_discount": sibling_discount,
            "absence_credit": absence_credit,
            "cancellation_credit": cancellation_credit,
            "manual_adjustment": manual_adjustment,
            "final_amount": final_amount,
        },
    )
    audit = AuditLog(
        actor_user_id=actor.id,
        action=AuditAction.UPDATE,
        entity_name="tuition_cycles",
        entity_id=cycle_id,
        new_data={
            "base_amount": 1000000,
            "policy_discount_amount": sibling_discount,
            "absence_credit_amount": absence_credit,
            "cancellation_credit_amount": cancellation_credit,
            "manual_adjustment_amount": manual_adjustment,
            "final_amount": final_amount,
            "status": "CALCULATED",
        },
        ip_address=ip_address,
    )
    if old_data is not None:
        audit.old_data = old_data
    db.session.add(audit)
    db.session.commit()
    return get_cycle(cycle_id, actor=actor)


def _find_effective_policy(effective_date):
    row = db.session.execute(
        text(
            """
            SELECT TOP 1 *
            FROM tuition_business_policies
            WHERE effective_from <= :effective_date
              AND (effective_to IS NULL OR effective_to >= :effective_date)
            ORDER BY version DESC
            """
        ),
        {"effective_date": effective_date},
    ).mappings().one_or_none()
    if row is None:
        return None
    result = dict(row)
    result["eligible_absence_statuses"] = (
        json.loads(result["eligible_absence_statuses"])
        if result["eligible_absence_statuses"] is not None
        else None
    )
    return result


def _sync_absence_credit(cycle, *, actor: User, ip_address: str | None) -> None:
    source_cycle = db.session.execute(
        text(
            """
            SELECT id, start_date
            FROM tuition_cycles
            WHERE enrollment_id = :enrollment_id
              AND cycle_number = :source_cycle_number
            """
        ),
        {
            "enrollment_id": cycle["enrollment_id"],
            "source_cycle_number": cycle["cycle_number"] - 1,
        },
    ).mappings().one_or_none()
    if source_cycle is None:
        return

    status_counts = db.session.execute(
        text(
            """
            SELECT a.status, COUNT(*) AS attendance_count
            FROM tuition_cycle_sessions tcs
            JOIN class_sessions s ON s.id = tcs.session_id
            JOIN attendances a
              ON a.session_id = tcs.session_id AND a.student_id = :student_id
            WHERE tcs.cycle_id = :source_cycle_id
              AND s.status <> 'CANCELLED'
              AND a.status IN ('EXCUSED_ABSENCE', 'UNEXCUSED_ABSENCE')
            GROUP BY a.status
            """
        ),
        {"source_cycle_id": source_cycle["id"], "student_id": cycle["student_id"]},
    ).mappings().all()
    candidate_absences = sum(row["attendance_count"] for row in status_counts)
    policy = _find_effective_policy(source_cycle["start_date"])
    if candidate_absences and (
        policy is None or policy["eligible_absence_statuses"] is None
    ):
        raise ConflictError(
            "Chưa cấu hình loại vắng được hưởng credit cho ngày hiệu lực của chu kỳ nguồn"
        )

    eligible_statuses = set(policy["eligible_absence_statuses"]) if policy else set()
    absence_count = sum(
        row["attendance_count"]
        for row in status_counts
        if row["status"] in eligible_statuses
    )
    threshold = policy["absence_threshold"] if policy else 4
    unit_amount = int(policy["unit_amount"]) if policy else 125000
    desired_amount = absence_count * unit_amount if absence_count > threshold else 0
    active = db.session.execute(
        text(
            """
            SELECT id, cycle_id, amount
            FROM tuition_adjustments WITH (UPDLOCK, HOLDLOCK)
            WHERE source_cycle_id = :source_cycle_id
              AND adjustment_type = 'ABSENCE_CREDIT'
              AND status = 'ACTIVE'
            """
        ),
        {"source_cycle_id": source_cycle["id"]},
    ).mappings().one_or_none()
    reversed_adjustment_id = db.session.execute(
        text(
            """
            SELECT TOP 1 id
            FROM tuition_adjustments
            WHERE source_cycle_id = :source_cycle_id
              AND adjustment_type = 'ABSENCE_CREDIT'
              AND status = 'REVERSED'
            ORDER BY id DESC
            """
        ),
        {"source_cycle_id": source_cycle["id"]},
    ).scalar_one_or_none()
    if active is not None and (
        int(active["amount"]) != desired_amount or active["cycle_id"] != cycle["id"]
    ):
        db.session.execute(
            text("UPDATE tuition_adjustments SET status = 'REVERSED' WHERE id = :id"),
            {"id": active["id"]},
        )
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.UPDATE,
                entity_name="tuition_adjustments",
                entity_id=active["id"],
                old_data={"status": "ACTIVE", "amount": int(active["amount"])},
                new_data={"status": "REVERSED", "amount": int(active["amount"])},
                ip_address=ip_address,
            )
        )
        reversed_adjustment_id = active["id"]
        active = None

    if desired_amount > 0 and active is None:
        adjustment_id = db.session.execute(
            text(
                """
                INSERT INTO tuition_adjustments
                    (cycle_id, source_cycle_id, adjustment_type, amount, status,
                     reason, created_by, reversed_adjustment_id)
                OUTPUT INSERTED.id
                VALUES (:cycle_id, :source_cycle_id, 'ABSENCE_CREDIT', :amount,
                        'ACTIVE', :reason, :created_by, :reversed_adjustment_id)
                """
            ),
            {
                "cycle_id": cycle["id"],
                "source_cycle_id": source_cycle["id"],
                "amount": desired_amount,
                "reason": (
                    f"Credit {absence_count} buổi vắng đủ điều kiện từ chu kỳ "
                    f"{cycle['cycle_number'] - 1}"
                ),
                "created_by": actor.id,
                "reversed_adjustment_id": reversed_adjustment_id,
            },
        ).scalar_one()
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="tuition_adjustments",
                entity_id=adjustment_id,
                new_data={
                    "cycle_id": cycle["id"],
                    "source_cycle_id": source_cycle["id"],
                    "adjustment_type": "ABSENCE_CREDIT",
                    "absence_count": absence_count,
                    "amount": desired_amount,
                    "status": "ACTIVE",
                    "reversed_adjustment_id": reversed_adjustment_id,
                },
                ip_address=ip_address,
            )
        )

    db.session.execute(
        text(
            """
            UPDATE tuition_recalculation_requests
            SET status = 'PROCESSED', processed_at = SYSDATETIMEOFFSET(),
                error_message = NULL
            WHERE status = 'PENDING'
              AND student_id = :student_id
              AND session_id IN (
                  SELECT session_id FROM tuition_cycle_sessions
                  WHERE cycle_id = :source_cycle_id
              )
            """
        ),
        {"student_id": cycle["student_id"], "source_cycle_id": source_cycle["id"]},
    )


def _sync_cancellation_credits(
    cycle, *, actor: User, ip_address: str | None
) -> None:
    policy = _find_effective_policy(cycle["start_date"])
    unit_amount = int(policy["unit_amount"]) if policy else 125000
    cancelled_session_ids = set(
        db.session.execute(
            text(
                """
                SELECT tcs.session_id
                FROM tuition_cycle_sessions tcs
                JOIN class_sessions s ON s.id = tcs.session_id
                WHERE tcs.cycle_id = :cycle_id AND s.status = 'CANCELLED'
                """
            ),
            {"cycle_id": cycle["id"]},
        ).scalars().all()
    )
    active_rows = db.session.execute(
        text(
            """
            SELECT id, session_id, amount
            FROM tuition_adjustments WITH (UPDLOCK, HOLDLOCK)
            WHERE cycle_id = :cycle_id
              AND adjustment_type = 'CANCELLATION_CREDIT'
              AND status = 'ACTIVE'
              AND source_cycle_id IS NULL
            """
        ),
        {"cycle_id": cycle["id"]},
    ).mappings().all()
    active_by_session = {row["session_id"]: row for row in active_rows}

    for session_id, adjustment in list(active_by_session.items()):
        if session_id in cancelled_session_ids and int(adjustment["amount"]) == unit_amount:
            continue
        db.session.execute(
            text("UPDATE tuition_adjustments SET status = 'REVERSED' WHERE id = :id"),
            {"id": adjustment["id"]},
        )
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.UPDATE,
                entity_name="tuition_adjustments",
                entity_id=adjustment["id"],
                old_data={"status": "ACTIVE", "amount": int(adjustment["amount"])},
                new_data={"status": "REVERSED", "amount": int(adjustment["amount"])},
                ip_address=ip_address,
            )
        )
        active_by_session.pop(session_id)

    for session_id in sorted(cancelled_session_ids - set(active_by_session)):
        previous_id = db.session.execute(
            text(
                """
                SELECT TOP 1 id
                FROM tuition_adjustments
                WHERE cycle_id = :cycle_id AND session_id = :session_id
                  AND adjustment_type = 'CANCELLATION_CREDIT'
                  AND status = 'REVERSED'
                  AND source_cycle_id IS NULL
                ORDER BY id DESC
                """
            ),
            {"cycle_id": cycle["id"], "session_id": session_id},
        ).scalar_one_or_none()
        adjustment_id = db.session.execute(
            text(
                """
                INSERT INTO tuition_adjustments
                    (cycle_id, session_id, adjustment_type, amount, status,
                     reason, created_by, reversed_adjustment_id)
                OUTPUT INSERTED.id
                VALUES (:cycle_id, :session_id, 'CANCELLATION_CREDIT', :amount,
                        'ACTIVE', N'Credit buổi học do trung tâm hủy',
                        :created_by, :reversed_adjustment_id)
                """
            ),
            {
                "cycle_id": cycle["id"],
                "session_id": session_id,
                "amount": unit_amount,
                "created_by": actor.id,
                "reversed_adjustment_id": previous_id,
            },
        ).scalar_one()
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="tuition_adjustments",
                entity_id=adjustment_id,
                new_data={
                    "cycle_id": cycle["id"],
                    "session_id": session_id,
                    "adjustment_type": "CANCELLATION_CREDIT",
                    "amount": unit_amount,
                    "status": "ACTIVE",
                    "reversed_adjustment_id": previous_id,
                },
                ip_address=ip_address,
            )
        )


def _reconcile_issued_cycle_cancellations(
    cycle, *, actor: User, ip_address: str | None
) -> dict:
    policy = _find_effective_policy(cycle["start_date"])
    if policy is None or policy["cancellation_after_issue_mode"] is None:
        raise ConflictError(
            "Chưa cấu hình cách xử lý buổi hủy sau khi phát hành invoice"
        )
    new_cancelled_session_ids = db.session.execute(
        text(
            """
            SELECT tcs.session_id
            FROM tuition_cycle_sessions tcs
            JOIN class_sessions s ON s.id = tcs.session_id
            WHERE tcs.cycle_id = :cycle_id
              AND s.status = 'CANCELLED'
              AND NOT EXISTS (
                  SELECT 1 FROM tuition_adjustments ta
                  WHERE ta.session_id = tcs.session_id
                    AND ta.adjustment_type = 'CANCELLATION_CREDIT'
                    AND ta.status = 'ACTIVE'
              )
            ORDER BY tcs.sequence_no
            """
        ),
        {"cycle_id": cycle["id"]},
    ).scalars().all()
    if not new_cancelled_session_ids:
        raise ConflictError("Không có buổi hủy mới cần đối soát")

    invoice = db.session.execute(
        text(
            """SELECT id, status, paid_amount, base_amount, final_amount
               FROM tuition_invoices WITH (UPDLOCK, ROWLOCK)
               WHERE tuition_cycle_id = :cycle_id"""
        ),
        {"cycle_id": cycle["id"]},
    ).mappings().one()
    unit_amount = int(policy["unit_amount"])
    recalculate_current = (
        invoice["status"] == "UNPAID"
        and policy["cancellation_after_issue_mode"] == "RECALCULATE_UNPAID"
    )
    if recalculate_current:
        for session_id in new_cancelled_session_ids:
            _create_cancellation_adjustment(
                cycle_id=cycle["id"],
                session_id=session_id,
                amount=unit_amount,
                actor=actor,
                ip_address=ip_address,
                reason="Credit buổi học hủy sau phát hành; tính lại invoice chưa thanh toán",
            )
        cancellation_credit = db.session.execute(
            text(
                """SELECT COALESCE(SUM(amount), 0)
                   FROM tuition_adjustments
                   WHERE cycle_id = :cycle_id
                     AND adjustment_type = 'CANCELLATION_CREDIT'
                     AND status = 'ACTIVE'"""
            ),
            {"cycle_id": cycle["id"]},
        ).scalar_one()
        final_amount = max(
            0,
            int(cycle["base_amount"])
            - int(cycle["policy_discount_amount"])
            - int(cycle["absence_credit_amount"])
            - int(cancellation_credit)
            + int(cycle["manual_adjustment_amount"]),
        )
        db.session.execute(
            text(
                """UPDATE tuition_cycles
                   SET cancellation_credit_amount = :cancellation_credit,
                       final_amount = :final_amount,
                       calculated_at = SYSDATETIMEOFFSET()
                   WHERE id = :cycle_id"""
            ),
            {
                "cycle_id": cycle["id"],
                "cancellation_credit": cancellation_credit,
                "final_amount": final_amount,
            },
        )
        db.session.execute(
            text(
                """UPDATE tuition_invoices
                   SET cancellation_credit_snapshot = :cancellation_credit,
                       discount_amount = :discount_amount,
                       final_amount = :final_amount
                   WHERE id = :invoice_id"""
            ),
            {
                "invoice_id": invoice["id"],
                "cancellation_credit": cancellation_credit,
                "discount_amount": max(0, int(cycle["base_amount"]) - final_amount),
                "final_amount": final_amount,
            },
        )
    else:
        target = db.session.execute(
            text(
                """SELECT id, status
                   FROM tuition_cycles WITH (UPDLOCK, ROWLOCK)
                   WHERE enrollment_id = :enrollment_id
                     AND cycle_number = :next_cycle_number"""
            ),
            {
                "enrollment_id": cycle["enrollment_id"],
                "next_cycle_number": cycle["cycle_number"] + 1,
            },
        ).mappings().one_or_none()
        if target is None:
            raise ConflictError("Chưa có chu kỳ kế tiếp để nhận credit buổi hủy")
        if target["status"] in {"ISSUED", "CLOSED"}:
            raise ConflictError("Chu kỳ kế tiếp đã phát hành, không thể nhận credit mới")
        for session_id in new_cancelled_session_ids:
            _create_cancellation_adjustment(
                cycle_id=target["id"],
                source_cycle_id=cycle["id"],
                session_id=session_id,
                amount=unit_amount,
                actor=actor,
                ip_address=ip_address,
                reason="Credit buổi học hủy sau phát hành chuyển sang chu kỳ kế tiếp",
            )
        calculate_cycle(target["id"], actor=actor, ip_address=ip_address)

    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.UPDATE,
            entity_name="tuition_invoices",
            entity_id=invoice["id"],
            old_data={
                "status": invoice["status"],
                "final_amount": int(invoice["final_amount"]),
            },
            new_data={
                "cancellation_after_issue_mode": policy[
                    "cancellation_after_issue_mode"
                ],
                "new_cancelled_session_ids": new_cancelled_session_ids,
                "applied_to": "CURRENT_INVOICE" if recalculate_current else "NEXT_CYCLE",
            },
            ip_address=ip_address,
        )
    )
    db.session.commit()
    return get_cycle(cycle["id"], actor=actor)


def _create_cancellation_adjustment(
    *,
    cycle_id: int,
    session_id: int,
    amount: int,
    actor: User,
    ip_address: str | None,
    reason: str,
    source_cycle_id: int | None = None,
) -> int:
    adjustment_id = db.session.execute(
        text(
            """
            INSERT INTO tuition_adjustments
                (cycle_id, source_cycle_id, session_id, adjustment_type, amount,
                 status, reason, created_by)
            OUTPUT INSERTED.id
            VALUES (:cycle_id, :source_cycle_id, :session_id,
                    'CANCELLATION_CREDIT', :amount, 'ACTIVE', :reason, :created_by)
            """
        ),
        {
            "cycle_id": cycle_id,
            "source_cycle_id": source_cycle_id,
            "session_id": session_id,
            "amount": amount,
            "reason": reason,
            "created_by": actor.id,
        },
    ).scalar_one()
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.CREATE,
            entity_name="tuition_adjustments",
            entity_id=adjustment_id,
            new_data={
                "cycle_id": cycle_id,
                "source_cycle_id": source_cycle_id,
                "session_id": session_id,
                "adjustment_type": "CANCELLATION_CREDIT",
                "amount": amount,
                "status": "ACTIVE",
            },
            ip_address=ip_address,
        )
    )
    return adjustment_id


def create_manual_adjustment(
    cycle_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    cycle = _get_cycle_context(cycle_id, lock=True)
    if cycle["status"] in {"ISSUED", "CLOSED"}:
        raise ConflictError("Không thể điều chỉnh thủ công chu kỳ đã phát hành")
    adjustment_id = db.session.execute(
        text(
            """
            INSERT INTO tuition_adjustments
                (cycle_id, adjustment_type, amount, status, reason,
                 approved_by, created_by)
            OUTPUT INSERTED.id
            VALUES (:cycle_id, 'MANUAL', :amount, 'ACTIVE', :reason,
                    :actor_id, :actor_id)
            """
        ),
        {
            "cycle_id": cycle_id,
            "amount": payload["amount"],
            "reason": payload["reason"],
            "actor_id": actor.id,
        },
    ).scalar_one()
    db.session.add(
        AuditLog(
            actor_user_id=actor.id,
            action=AuditAction.CREATE,
            entity_name="tuition_adjustments",
            entity_id=adjustment_id,
            new_data={
                "cycle_id": cycle_id,
                "adjustment_type": "MANUAL",
                "amount": payload["amount"],
                "status": "ACTIVE",
                "reason": payload["reason"],
                "approved_by": actor.id,
            },
            ip_address=ip_address,
        )
    )
    calculated_cycle = calculate_cycle(cycle_id, actor=actor, ip_address=ip_address)
    adjustment = db.session.execute(
        text("SELECT * FROM tuition_adjustments WHERE id = :id"),
        {"id": adjustment_id},
    ).mappings().one()
    return {"adjustment": dict(adjustment), "cycle": calculated_cycle}


def list_student_cycles(student_id: int, *, actor: User) -> dict:
    _authorize_student_tuition(student_id, actor=actor)
    cycle_ids = db.session.execute(
        text(
            """
            SELECT tc.id
            FROM tuition_cycles tc
            JOIN class_enrollments ce ON ce.id = tc.enrollment_id
            WHERE ce.student_id = :student_id
            ORDER BY tc.start_date DESC, tc.cycle_number DESC, tc.id DESC
            """
        ),
        {"student_id": student_id},
    ).scalars().all()
    items = [get_cycle(cycle_id, actor=actor) for cycle_id in cycle_ids]
    return {"items": items, "total": len(items)}


def list_adjustments(cycle_id: int, *, actor: User) -> dict:
    get_cycle(cycle_id, actor=actor)
    rows = db.session.execute(
        text(
            """
            SELECT id, cycle_id, source_cycle_id, session_id, adjustment_type,
                   amount, status, reason, approved_by, created_by, created_at,
                   reversed_adjustment_id
            FROM tuition_adjustments
            WHERE cycle_id = :cycle_id
            ORDER BY created_at, id
            """
        ),
        {"cycle_id": cycle_id},
    ).mappings().all()
    return {"items": [dict(row) for row in rows], "total": len(rows)}


def _authorize_student_tuition(student_id: int, *, actor: User) -> None:
    student = db.session.execute(
        text("SELECT user_id FROM students WHERE id = :student_id"),
        {"student_id": student_id},
    ).mappings().one_or_none()
    if student is None:
        raise NotFoundError("Không tìm thấy học sinh")
    if actor.role.code == RoleCode.MANAGER:
        return
    if actor.role.code != RoleCode.STUDENT_PARENT:
        raise ForbiddenError(MSG_FORBIDDEN)
    linked = student["user_id"] == actor.id or db.session.execute(
        text(
            "SELECT 1 FROM student_user_links WHERE student_id = :student_id "
            "AND user_id = :user_id AND can_view = 1"
        ),
        {"student_id": student_id, "user_id": actor.id},
    ).scalar_one_or_none()
    if not linked:
        raise ForbiddenError(MSG_FORBIDDEN)


def _get_cycle_invoice(cycle_id: int):
    row = db.session.execute(
        text(
            """SELECT id, invoice_code, tuition_cycle_id, student_id, class_id,
                      billing_month, base_amount, discount_amount,
                      policy_discount_snapshot, absence_credit_snapshot,
                      cancellation_credit_snapshot, manual_adjustment_snapshot,
                      final_amount, paid_amount, due_date, status, generated_by,
                      discount_policy_id, created_at
               FROM tuition_invoices WHERE tuition_cycle_id = :cycle_id"""
        ),
        {"cycle_id": cycle_id},
    ).mappings().one_or_none()
    return dict(row) if row is not None else None
