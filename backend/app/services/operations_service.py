"""SQL-backed Manager operations. Invoice headers and existing cycle policy remain authoritative."""
import base64
import binascii
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from functools import wraps
import hashlib
from io import BytesIO
import json
from uuid import uuid4

from flask import send_file
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.common.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.extensions import db
from app.models import AuditAction, AuditLog, RoleCode


def _params(values):
    # pyodbc can discard tzinfo when binding datetime objects to text SQL. ISO strings
    # retain the supplied offset when SQL Server converts to DATETIMEOFFSET.
    return {key: value.isoformat() if isinstance(value, datetime) else value for key, value in (values or {}).items()}


def _rows(sql, params=None):
    return [dict(r) for r in db.session.execute(text(sql), _params(params)).mappings().all()]


def _one(sql, params=None):
    return db.session.execute(text(sql), _params(params)).mappings().one_or_none()


def _scalar(sql, params=None):
    return db.session.execute(text(sql), _params(params)).scalar_one()


def _json(value):
    if isinstance(value, dict):
        return {k: _json(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [_json(v) for v in value]
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return value


def _fmt(value):
    return value.strftime("%d/%m/%Y") if value else "—"


def _code(prefix):
    return prefix + uuid4().hex[:16].upper()


def _audit(entity, entity_id, data, actor, ip_address, *, update=False):
    db.session.add(AuditLog(actor_user_id=actor.id,
        action=AuditAction.UPDATE if update else AuditAction.CREATE,
        entity_name=entity, entity_id=entity_id, new_data=_json(data), ip_address=ip_address))


def _transaction(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        try:
            result = fn(*args, **kwargs)
            db.session.commit()
            return _json(result)
        except IntegrityError as exc:
            db.session.rollback()
            raise ConflictError("Dữ liệu đã thay đổi hoặc không đáp ứng ràng buộc. Vui lòng tải lại và kiểm tra dữ liệu.") from exc
        except Exception:
            db.session.rollback()
            raise
    return wrapped


def _file(file, actor):
    try:
        content = base64.b64decode(file["content"], validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AppError("Nội dung tệp không hợp lệ") from exc
    if not 1 <= len(content) <= 20 * 1024 * 1024:
        raise AppError("Tệp phải từ 1 byte đến 20 MB")
    return _scalar("""INSERT INTO stored_files (filename,mime_type,byte_size,content,sha256,uploaded_by)
        OUTPUT INSERTED.id VALUES (:name,:mime,:size,:content,:hash,:actor)""",
        {"name": file["name"], "mime": file.get("mime") or "application/octet-stream",
         "size": len(content), "content": content, "hash": hashlib.sha256(content).hexdigest(), "actor": actor.id})


def download_file(file_id, *, actor):
    row = _one("SELECT filename,mime_type,content FROM stored_files WHERE id=:id", {"id": file_id})
    if row is None:
        raise NotFoundError("Không tìm thấy tệp")
    return send_file(BytesIO(bytes(row["content"])), mimetype=row["mime_type"],
        as_attachment=True, download_name=row["filename"])


def tuition(*, actor):
    rows = _rows("""SELECT i.id AS invoice_id,s.id AS student_id,s.student_code,s.full_name,c.name AS class_name,
        i.invoice_code,i.final_amount,i.paid_amount,i.due_date,i.status,i.tuition_cycle_id
        FROM tuition_invoices i JOIN students s ON s.id=i.student_id JOIN classes c ON c.id=i.class_id
        WHERE i.status<>'CANCELLED' ORDER BY i.due_date DESC,i.id DESC""")
    today = date.today()
    items = [{"id": r["student_code"], "backendId": r["student_id"], "invoiceId": r["invoice_id"],
        "invoiceCode": r["invoice_code"], "name": r["full_name"], "className": r["class_name"],
        "fee": int(r["final_amount"]), "paid": int(r["paid_amount"]), "due": _fmt(r["due_date"]),
        "status": "paid" if r["status"] == "PAID" or r["final_amount"] == r["paid_amount"] else
            "overdue" if r["due_date"] < today else "soon"} for r in rows]
    stats = _one("""SELECT COALESCE(SUM(final_amount-paid_amount),0) AS debt,
        COUNT(DISTINCT CASE WHEN final_amount>paid_amount THEN student_id END) AS debt_count,
        COUNT(DISTINCT CASE WHEN final_amount>paid_amount AND due_date BETWEEN CONVERT(date,GETDATE())
            AND DATEADD(day,7,CONVERT(date,GETDATE())) THEN student_id END) AS soon_count,
        SUM(CASE WHEN status='PAID' THEN 1 ELSE 0 END) AS settled,COUNT(*) AS invoice_count
        FROM tuition_invoices WHERE status<>'CANCELLED'""")
    collected = _scalar("""SELECT COALESCE(SUM(amount),0) FROM payments
        WHERE paid_at>=DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1)
        AND paid_at<DATEADD(month,1,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))""")
    return _json({"items": items, "total": len(items), "stats": {**dict(stats), "collected": collected}})


def tuition_risks(*, actor):
    rows = _rows("""SELECT a.id,a.student_id,s.student_code,s.full_name,a.detail,a.status,
        COALESCE(b.outstanding_amount,0) AS debt,
        (SELECT TOP 1 c.name FROM class_enrollments e JOIN classes c ON c.id=e.class_id
          WHERE e.student_id=s.id ORDER BY CASE WHEN e.status='ACTIVE' THEN 0 ELSE 1 END,e.id DESC) AS class_name
        FROM ai_alerts a JOIN students s ON s.id=a.student_id
        LEFT JOIN v_student_tuition_balance b ON b.student_id=s.id
        WHERE a.alert_type='DEBT_RISK' AND a.status IN ('NEW','ACKNOWLEDGED') ORDER BY a.id DESC""")
    return _json({"items": [{"id": r["id"], "studentId": r["student_id"], "code": r["student_code"],
        "name": r["full_name"], "className": r["class_name"] or "—", "debt": r["debt"],
        "reason": r["detail"], "reminded": r["status"] == "ACKNOWLEDGED"} for r in rows]})


def payment_history(student_id, *, actor):
    student = _one("SELECT id,student_code,full_name,enrolled_at FROM students WHERE student_code=:code", {"code": student_id})
    if student is None:
        raise NotFoundError("Không tìm thấy học viên")
    invoices = _rows("""SELECT i.*,c.name AS class_name,
        (SELECT MAX(p.paid_at) FROM payments p WHERE p.invoice_id=i.id) AS last_paid_at,
        (SELECT TOP 1 p.method FROM payments p WHERE p.invoice_id=i.id ORDER BY p.paid_at DESC,p.id DESC) AS last_method,
        tc.cycle_number FROM tuition_invoices i JOIN classes c ON c.id=i.class_id
        LEFT JOIN tuition_cycles tc ON tc.id=i.tuition_cycle_id
        WHERE i.student_id=:id AND i.status<>'CANCELLED' ORDER BY i.due_date DESC,i.id DESC""", {"id": student["id"]})
    payments = _rows("""SELECT p.id,p.payment_code,p.invoice_id,p.amount,p.method,p.paid_at,p.note,r.receipt_no
        FROM payments p JOIN tuition_invoices i ON i.id=p.invoice_id LEFT JOIN receipts r ON r.payment_id=p.id
        WHERE i.student_id=:id ORDER BY p.paid_at DESC,p.id DESC""", {"id": student["id"]})
    methods = {"CASH": "Tiền mặt", "BANK_TRANSFER": "Chuyển khoản", "MOMO": "MoMo", "VNPAY": "VNPAY"}
    items = [{"id": r["invoice_code"], "backendId": r["id"], "item":
        f"Học phí chu kỳ {r['cycle_number']} · 8 buổi" if r["tuition_cycle_id"] else f"Học phí · {r['class_name']}",
        "amount": r["final_amount"], "paid": r["paid_amount"], "balance": r["final_amount"]-r["paid_amount"],
        "due": _fmt(r["due_date"]), "paidAt": _fmt(r["last_paid_at"]), "method": methods.get(r["last_method"], "—"),
        "status": "paid" if r["paid_amount"] == r["final_amount"] else "overdue" if r["due_date"] < date.today() else "upcoming"}
        for r in invoices]
    return _json({"items": items, "payments": payments, "student": {
        "id": student["student_code"], "backendId": student["id"], "name": student["full_name"],
        "joined": _fmt(student["enrolled_at"]), "className": invoices[0]["class_name"] if invoices else "—"}})


def _category(name, txn_type):
    category = _one("SELECT id FROM finance_categories WHERE (name=:name OR code=:name OR CONVERT(nvarchar(30),id)=:name) AND txn_type=:type",
        {"name": name, "type": txn_type})
    if category is None:
        raise AppError("Danh mục thu/chi không hợp lệ với loại khoản đã chọn")
    return category["id"]


def _ledger_insert(category_id, amount, txn_date, description, actor, *, payment_id=None, payroll_id=None, txn_code=None):
    return _scalar("""INSERT INTO finance_transactions
        (txn_code,category_id,amount,txn_date,description,payment_id,payroll_id,created_by)
        OUTPUT INSERTED.id VALUES (:code,:category,:amount,:date,:description,:payment,:payroll,:actor)""",
        {"code": txn_code or _code("TX"), "category": category_id, "amount": amount, "date": txn_date,
         "description": description, "payment": payment_id, "payroll": payroll_id, "actor": actor.id})


@_transaction
def collect_payment(payload, *, actor, ip_address):
    invoice = _one("""SELECT id,student_id,invoice_code,status,final_amount,paid_amount
        FROM tuition_invoices WITH (UPDLOCK,HOLDLOCK) WHERE invoice_code=:code""", {"code": payload["invoice"]})
    if invoice is None:
        raise NotFoundError("Không tìm thấy hóa đơn")
    payment_code = "PT" + hashlib.sha256(payload["request_id"].encode()).hexdigest()[:16].upper() if payload.get("request_id") else _code("PT")
    previous = _one("""SELECT p.id,p.invoice_id,p.amount,p.method,p.paid_at,p.note,r.receipt_no FROM payments p
        JOIN receipts r ON r.payment_id=p.id WHERE p.payment_code=:code""", {"code": payment_code})
    if previous:
        if (previous["invoice_id"] != invoice["id"] or int(previous["amount"]) != payload["amount"] or previous["method"] != payload["method"]
                or previous["paid_at"].date() != payload["date"] or (previous["note"] or "") != payload["note"]):
            raise ConflictError("Yêu cầu thanh toán này đã được dùng với dữ liệu khác")
        return {"payment_id": previous["id"], "receipt_no": previous["receipt_no"], "paid_amount": int(invoice["paid_amount"]),
            "balance": int(invoice["final_amount"]-invoice["paid_amount"])}
    if invoice["status"] == "CANCELLED":
        raise ConflictError("Không thể thanh toán hóa đơn đã hủy")
    balance = int(invoice["final_amount"] - invoice["paid_amount"])
    if not 0 < payload["amount"] <= balance:
        raise ConflictError("Số tiền phải lớn hơn 0 và không vượt quá công nợ hóa đơn")
    paid_at = datetime.combine(payload["date"], time(12), tzinfo=timezone(timedelta(hours=7)))
    payment_id = _scalar("""INSERT INTO payments (payment_code,invoice_id,amount,method,paid_at,received_by,note)
        OUTPUT INSERTED.id VALUES (:code,:invoice,:amount,:method,:paid,:actor,:note)""",
        {"code": payment_code, "invoice": invoice["id"], "amount": payload["amount"], "method": payload["method"],
         "paid": paid_at, "actor": actor.id, "note": payload["note"]})
    total = int(invoice["paid_amount"]) + payload["amount"]
    db.session.execute(text("UPDATE tuition_invoices SET paid_amount=:total,status=:status WHERE id=:id"),
        {"total": total, "status": "PAID" if total == int(invoice["final_amount"]) else "PARTIAL", "id": invoice["id"]})
    receipt_no = _code("BL")
    db.session.execute(text("""INSERT INTO receipts(receipt_no,payment_id,issued_at,issued_by)
        VALUES(:code,:payment,SYSDATETIMEOFFSET(),:actor)"""), {"code": receipt_no, "payment": payment_id, "actor": actor.id})
    category = _one("SELECT TOP 1 id FROM finance_categories WHERE txn_type='INCOME' AND code='TUITION'")
    if category is None:
        raise ConflictError("Chưa cấu hình danh mục thu học phí (TUITION)")
    txn_id = _ledger_insert(category["id"], payload["amount"], payload["date"],
        f"Thu học phí {invoice['invoice_code']}", actor, payment_id=payment_id)
    for file in payload["files"]:
        file_id = _file(file, actor)
        db.session.execute(text("INSERT INTO finance_transaction_attachments(transaction_id,file_id) VALUES(:txn,:file)"),
            {"txn": txn_id, "file": file_id})
    _audit("payments", payment_id, {"invoice_id": invoice["id"], "amount": payload["amount"],
        "receipt_no": receipt_no, "finance_transaction_id": txn_id}, actor, ip_address)
    _audit("tuition_invoices", invoice["id"], {"paid_amount": total}, actor, ip_address, update=True)
    return {"payment_id": payment_id, "receipt_no": receipt_no, "paid_amount": total,
        "balance": int(invoice["final_amount"]) - total}


def _payroll(month):
    return _rows("""SELECT s.id,u.full_name,s.position,s.hourly_rate,
        COALESCE(h.teaching_hours,0) AS teaching_hours,COALESCE(h.session_count,0) AS session_count,
        p.id AS payroll_id,p.calculation_basis,p.total_amount,p.status,p.bonus,p.deduction,p.teaching_hours AS saved_hours,
        p.hourly_rate AS saved_rate FROM staff_profiles s JOIN users u ON u.id=s.user_id
        LEFT JOIN v_staff_teaching_hours h ON h.staff_id=s.id AND h.payroll_month=:month
        LEFT JOIN staff_payrolls p ON p.staff_id=s.id AND p.payroll_month=:month
        WHERE s.position IN ('LECTURER','TEACHING_ASSISTANT') AND (s.status='ACTIVE' OR p.id IS NOT NULL)
        ORDER BY u.full_name,s.id""", {"month": month})


def ledger(*, actor):
    month = date.today().replace(day=1)
    entries = _rows("""SELECT TOP 100 t.id,t.txn_date,t.description,t.amount,c.txn_type,
        (SELECT COUNT(*) FROM finance_transaction_attachments a WHERE a.transaction_id=t.id) AS attachment_count
        FROM finance_transactions t JOIN finance_categories c ON c.id=t.category_id ORDER BY t.txn_date DESC,t.id DESC""")
    totals = _one("""SELECT COALESCE(SUM(CASE WHEN c.txn_type='INCOME' THEN t.amount ELSE 0 END),0) AS income,
        COALESCE(SUM(CASE WHEN c.txn_type='EXPENSE' THEN t.amount ELSE 0 END),0) AS expense
        FROM finance_transactions t JOIN finance_categories c ON c.id=t.category_id
        WHERE t.txn_date>=:month AND t.txn_date<DATEADD(month,1,:month)""", {"month": month})
    payroll = []
    for r in _payroll(month):
        saved = r["payroll_id"] is not None
        hours = r["saved_hours"] if saved and r["calculation_basis"] == "HOUR" else r["teaching_hours"]
        rate = r["saved_rate"] if saved and r["calculation_basis"] == "HOUR" else r["hourly_rate"]
        pay = r["total_amount"] if saved else (Decimal(hours)*Decimal(rate)).quantize(Decimal(1), rounding=ROUND_HALF_UP) if rate is not None else None
        payroll.append({"id": r["id"], "name": r["full_name"], "role": "assistant" if r["position"] == "TEACHING_ASSISTANT" else "lecturer",
            "monthHours": hours, "rate": rate, "pay": pay, "status": r["status"], "basis": r["calculation_basis"]})
    return _json({"items": [{"id": r["id"], "date": r["txn_date"].strftime("%d/%m"), "title": r["description"],
        "amount": r["amount"]*(1 if r["txn_type"] == "INCOME" else -1), "attachments": r["attachment_count"]} for r in entries],
        "totals": {"income": totals["income"]/Decimal(1000000), "expense": totals["expense"]/Decimal(1000000)},
        "payroll": payroll, "month": month.strftime("%Y-%m"),
        "categories": _rows("SELECT id,name,txn_type FROM finance_categories ORDER BY name"),
        "closed": bool(payroll) and all(r["status"] in ("APPROVED", "PAID") for r in payroll if r["monthHours"] or r["pay"])} )


@_transaction
def add_ledger(payload, *, actor, ip_address):
    category = _category(payload["category"], "INCOME" if payload["type"] == "income" else "EXPENSE")
    description = payload["note"].strip() or payload["category"]
    code = "TX" + hashlib.sha256(payload["request_id"].encode()).hexdigest()[:16].upper() if payload.get("request_id") else _code("TX")
    previous = _one("SELECT id,category_id,amount,txn_date,description FROM finance_transactions WITH(UPDLOCK,HOLDLOCK) WHERE txn_code=:code", {"code": code})
    if previous:
        if previous["category_id"] != category or int(previous["amount"]) != payload["amount"] or previous["txn_date"] != payload["date"] or previous["description"] != description:
            raise ConflictError("Yêu cầu thu/chi này đã được dùng với dữ liệu khác")
        return {"id": previous["id"]}
    txn_id = _ledger_insert(category, payload["amount"], payload["date"], description, actor, txn_code=code)
    for file in payload["files"]:
        file_id = _file(file, actor)
        db.session.execute(text("INSERT INTO finance_transaction_attachments(transaction_id,file_id) VALUES(:txn,:file)"),
            {"txn": txn_id, "file": file_id})
    _audit("finance_transactions", txn_id, {k: v for k, v in payload.items() if k != "files"}, actor, ip_address)
    return {"id": txn_id}


@_transaction
def close_payroll(month, *, actor, ip_address):
    try:
        period = datetime.strptime(month, "%Y-%m").date()
    except ValueError as exc:
        raise AppError("Kỳ lương phải có dạng YYYY-MM") from exc
    # Serialize closes for the same period without rewriting approved/paid historical rows.
    db.session.execute(text("SELECT id FROM staff_payrolls WITH(UPDLOCK,HOLDLOCK) WHERE payroll_month=:month"), {"month": period}).all()
    rows = _payroll(period)
    count = 0
    for row in rows:
        if row["status"] in ("APPROVED", "PAID"):
            continue
        if not row["teaching_hours"] and row["payroll_id"] is None:
            continue
        if row["payroll_id"] is not None and row["calculation_basis"] == "SESSION":
            raise ConflictError("Kỳ này có bảng lương theo buổi. Cần đối soát trước khi chốt theo giờ.")
        if row["hourly_rate"] is None:
            raise ConflictError(f"Chưa cấu hình mức lương giờ cho {row['full_name']}")
        total = (Decimal(row["teaching_hours"])*Decimal(row["hourly_rate"])
            + Decimal(row["bonus"] or 0) - Decimal(row["deduction"] or 0)).quantize(Decimal(1), rounding=ROUND_HALF_UP)
        if total < 0:
            raise ConflictError(f"Tổng lương của {row['full_name']} sau điều chỉnh không được âm")
        params = {"staff": row["id"], "month": period, "sessions": row["session_count"], "hours": row["teaching_hours"],
            "rate": row["hourly_rate"], "total": total, "actor": actor.id}
        if row["payroll_id"]:
            params["id"] = row["payroll_id"]
            db.session.execute(text("""UPDATE staff_payrolls SET session_count=:sessions,teaching_hours=:hours,hourly_rate=:rate,
                total_amount=:total,status='APPROVED',approved_by=:actor,approved_at=SYSDATETIMEOFFSET()
                WHERE id=:id AND status='DRAFT'"""), params)
            payroll_id = row["payroll_id"]
        else:
            payroll_id = _scalar("""INSERT INTO staff_payrolls(staff_id,payroll_month,session_count,rate_per_session,
                total_amount,status,approved_by,calculation_basis,teaching_hours,hourly_rate,approved_at)
                OUTPUT INSERTED.id VALUES(:staff,:month,:sessions,0,:total,'APPROVED',:actor,'HOUR',:hours,:rate,SYSDATETIMEOFFSET())""", params)
        _audit("staff_payrolls", payroll_id, params, actor, ip_address, update=bool(row["payroll_id"]))
        count += 1
    return {"month": month, "approved": count}


def _announcement(row):
    pending = int(row.get("pending_count") or 0)
    status = row["status"].lower()
    audience = {"ALL_STUDENTS": "Tất cả học viên", "ALL_USERS": "Tất cả tài khoản",
        "CLASSES": "Các lớp được chọn", "STUDENTS": "Học viên được chọn"}[row["audience_type"]]
    return {"id": str(row["id"]), "title": row["title"], "content": row["content"], "messageType": row["message_type"],
        "status": status, "read": float(row["read_percent"] or 0) if row["status"] in ("SENT", "SENDING") else None,
        "audience": audience, "meta": f"{audience} · {_fmt(row['scheduled_at'] or row['sent_at'] or row['created_at'])}",
        "sender": row["sender"], "important": row["priority"] == "IMPORTANT", "pending": pending,
        "total": int(row["recipient_count"]), "readCount": int(row["read_count"] or 0),
        "scheduledAt": _json(row["scheduled_at"]), "sentAt": _json(row["sent_at"])}


_ANNOUNCEMENT_QUERY = """SELECT a.*,u.full_name AS sender,v.recipient_count,v.read_count,v.read_percent,
    (SELECT COUNT(*) FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id
        WHERE n.announcement_id=a.id AND d.status='PENDING') AS pending_count
    FROM announcements a JOIN users u ON u.id=a.created_by
    JOIN v_announcement_read_summary v ON v.announcement_id=a.id"""


def announcements(*, actor):
    rows = _rows(_ANNOUNCEMENT_QUERY + " ORDER BY a.is_pinned DESC,a.created_at DESC,a.id DESC")
    sent = [r for r in rows if r["sent_at"] and r["sent_at"].year == date.today().year and r["sent_at"].month == date.today().month]
    total = sum(int(r["recipient_count"]) for r in rows)
    read = sum(int(r["read_count"] or 0) for r in rows)
    return {"items": [_announcement(r) for r in rows], "stats": {"sentThisMonth": len(sent),
        "readPercent": round(100*read/total, 1) if total else 0}}


def announcement_options(*, actor):
    return _json({"templates": [{"id": str(r["id"]), "title": r["title"], "content": r["content"],
        "letter": r["title"][:1], "desc": r["message_type"], "messageType": r["message_type"]} for r in _rows(
        "SELECT id,title,content,message_type FROM announcement_templates WHERE is_active=1 ORDER BY id")],
        "classes": _rows("""SELECT c.id,c.name,COUNT(e.id) AS n FROM classes c LEFT JOIN class_enrollments e
            ON e.class_id=c.id AND e.status='ACTIVE' WHERE c.status IN ('PLANNED','ONGOING')
            GROUP BY c.id,c.name ORDER BY c.name"""),
        "studentCount": _scalar("SELECT COUNT(*) FROM students WHERE status='ACTIVE'")})


def announcement_detail(announcement_id, *, actor):
    row = _one(_ANNOUNCEMENT_QUERY + " WHERE a.id=:id", {"id": announcement_id})
    if row is None:
        raise NotFoundError("Không tìm thấy thông báo")
    recipients = _rows("""SELECT n.id,u.full_name AS name,n.is_read AS [read],n.read_at,
        COALESCE((SELECT TOP 1 c.name FROM class_enrollments e JOIN classes c ON c.id=e.class_id
          JOIN students s ON s.id=e.student_id WHERE s.user_id=u.id
          OR EXISTS (SELECT 1 FROM student_user_links l WHERE l.student_id=s.id AND l.user_id=u.id)
          ORDER BY CASE WHEN e.status='ACTIVE' THEN 0 ELSE 1 END,e.id DESC),N'—') AS className
        FROM notifications n JOIN users u ON u.id=n.recipient_user_id
        WHERE n.announcement_id=:id ORDER BY u.full_name,n.id""", {"id": announcement_id})
    files = _rows("""SELECT f.id,f.filename AS name,f.byte_size AS size FROM announcement_attachments a
        JOIN stored_files f ON f.id=a.file_id WHERE a.announcement_id=:id ORDER BY a.display_order""", {"id": announcement_id})
    replies = _rows("""SELECT r.id,u.full_name AS name,r.content AS text,r.created_at FROM announcement_replies r
        JOIN users u ON u.id=r.author_user_id WHERE r.announcement_id=:id ORDER BY r.created_at,r.id""", {"id": announcement_id})
    return _json({"item": _announcement(dict(row)), "recipients": [{**r, "at": _fmt(r["read_at"])} for r in recipients],
        "files": files, "replies": [{**r, "at": _fmt(r["created_at"])} for r in replies]})


def _resolve_announcement_students(payload):
    ids = set()
    if payload["audience_type"] == "CLASSES":
        for class_id in set(payload["class_ids"]):
            if not _one("SELECT id FROM classes WHERE id=:id AND status<>'CANCELLED'", {"id": class_id}):
                raise AppError("Lớp nhận thông báo không hợp lệ")
            ids.update(r["student_id"] for r in _rows("SELECT student_id FROM class_enrollments WHERE class_id=:id AND status='ACTIVE'", {"id": class_id}))
    elif payload["audience_type"] == "STUDENTS":
        for value in payload["students"]:
            rows = _rows("SELECT id FROM students WHERE student_code=:value OR full_name=:value", {"value": value.strip()})
            if len(rows) != 1:
                raise AppError(f"Không xác định duy nhất học viên '{value}'. Vui lòng dùng mã học viên.")
            ids.add(rows[0]["id"])
    return ids


def _recipients(announcement_id):
    row = _one("SELECT audience_type FROM announcements WHERE id=:id", {"id": announcement_id})
    if row["audience_type"] == "ALL_USERS":
        return [r["id"] for r in _rows("SELECT id FROM users WHERE status='ACTIVE' AND deleted_at IS NULL")]
    student_ids = {r["id"] for r in _rows("SELECT id FROM students WHERE status='ACTIVE'")} if row["audience_type"] == "ALL_STUDENTS" else {
        r["student_id"] for r in _rows("SELECT student_id FROM announcement_students WHERE announcement_id=:id", {"id": announcement_id})}
    recipients = set()
    for student_id in student_ids:
        recipients.update(r["id"] for r in _rows("""SELECT u.id FROM users u WHERE u.status='ACTIVE' AND u.deleted_at IS NULL AND
            (EXISTS (SELECT 1 FROM students s WHERE s.id=:student AND s.user_id=u.id)
            OR EXISTS (SELECT 1 FROM student_user_links l WHERE l.student_id=:student AND l.user_id=u.id AND l.can_view=1))""", {"student": student_id}))
    return sorted(recipients)


def _dispatch_announcement(announcement_id, actor):
    row = _one("SELECT * FROM announcements WITH(UPDLOCK,HOLDLOCK) WHERE id=:id", {"id": announcement_id})
    if row is None:
        raise NotFoundError("Không tìm thấy thông báo")
    if row["status"] in ("SENT", "SENDING"):
        return
    if row["status"] == "CANCELLED":
        raise ConflictError("Thông báo đã hủy")
    if row["scheduled_at"] and row["scheduled_at"] > datetime.now(timezone.utc):
        raise ConflictError("Thông báo chưa đến thời điểm gửi đã lên lịch")
    if not row["title"].strip() or not row["content"].strip():
        raise AppError("Cần tiêu đề và nội dung trước khi gửi")
    recipients = _recipients(announcement_id)
    if not recipients:
        raise ConflictError("Đối tượng nhận chưa có tài khoản đang hoạt động được liên kết")
    for recipient in recipients:
        notification = _one("SELECT id FROM notifications WHERE announcement_id=:id AND recipient_user_id=:user", {"id": announcement_id, "user": recipient})
        if notification:
            continue
        notification_id = _scalar("""INSERT INTO notifications(recipient_user_id,notification_type,title,content,created_by,announcement_id)
            OUTPUT INSERTED.id VALUES(:user,:type,:title,:content,:actor,:announcement)""", {
                "user": recipient, "type": row["message_type"] if row["message_type"] in ("TUITION", "SCHEDULE") else "GENERAL",
                "title": row["title"], "content": row["content"], "actor": actor.id, "announcement": announcement_id})
        # IN_APP is delivered by the committed notifications row. External channels remain queued.
        db.session.execute(text("""INSERT INTO notification_deliveries(notification_id,channel,status,attempt_count,delivered_at)
            VALUES(:id,'IN_APP','SENT',1,SYSDATETIMEOFFSET())"""), {"id": notification_id})
        for enabled, channel in ((row["send_email"], "EMAIL"), (row["send_push"], "PUSH")):
            if enabled:
                db.session.execute(text("INSERT INTO notification_deliveries(notification_id,channel,status) VALUES(:id,:channel,'PENDING')"""),
                    {"id": notification_id, "channel": channel})
    db.session.execute(text("""UPDATE announcements SET status=:status,sent_at=SYSDATETIMEOFFSET(),updated_at=SYSDATETIMEOFFSET()
        WHERE id=:id"""), {"id": announcement_id, "status": "SENDING" if row["send_email"] or row["send_push"] else "SENT"})


def _save_announcement(payload, *, actor, ip_address, announcement_id=None):
    if not payload["title"].strip():
        raise AppError("Tiêu đề không được để trống")
    if payload["status"] != "DRAFT" and not payload["content"].strip():
        raise AppError("Nội dung thông báo không được để trống")
    scheduled = payload["scheduled_at"]
    if scheduled and scheduled.tzinfo is None:
        raise AppError("Thời điểm hẹn giờ phải bao gồm múi giờ")
    if payload["status"] == "SCHEDULED" and (not scheduled or scheduled <= datetime.now(timezone.utc)):
        raise AppError("Thời điểm hẹn giờ phải ở tương lai")
    ids = _resolve_announcement_students(payload)
    if payload["status"] != "DRAFT" and payload["audience_type"] in ("CLASSES", "STUDENTS") and not ids:
        raise AppError("Cần chọn người nhận thông báo")
    params = {
            "template": payload["template_id"], "title": payload["title"].strip(), "content": payload["content"],
            "type": payload["message_type"], "priority": payload["priority"], "audience": payload["audience_type"],
            "status": "SCHEDULED" if payload["status"] == "SCHEDULED" else "DRAFT", "scheduled": scheduled,
            "pin": payload["is_pinned"], "mail": payload["send_email"], "push": payload["send_push"], "actor": actor.id}
    editing = announcement_id is not None
    if editing:
        previous = _one("SELECT status FROM announcements WITH(UPDLOCK,HOLDLOCK) WHERE id=:id", {"id": announcement_id})
        if previous is None:
            raise NotFoundError("Không tìm thấy bản nháp")
        if previous["status"] != "DRAFT":
            raise ConflictError("Chỉ có thể chỉnh sửa thông báo đang là bản nháp")
        params["id"] = announcement_id
        db.session.execute(text("""UPDATE announcements SET template_id=:template,title=:title,content=:content,
            message_type=:type,priority=:priority,audience_type=:audience,status=:status,scheduled_at=:scheduled,
            is_pinned=:pin,send_email=:mail,send_push=:push,updated_at=SYSDATETIMEOFFSET() WHERE id=:id"""), _params(params))
        for table in ("announcement_classes", "announcement_students", "announcement_attachments"):
            db.session.execute(text(f"DELETE FROM {table} WHERE announcement_id=:id"), {"id": announcement_id})
    else:
        announcement_id = _scalar("""INSERT INTO announcements(template_id,title,content,message_type,priority,audience_type,status,
            scheduled_at,is_pinned,send_email,send_push,created_by) OUTPUT INSERTED.id
            VALUES(:template,:title,:content,:type,:priority,:audience,:status,:scheduled,:pin,:mail,:push,:actor)""", params)
    for class_id in set(payload["class_ids"]) if payload["audience_type"] == "CLASSES" else ():
        db.session.execute(text("INSERT INTO announcement_classes(announcement_id,class_id) VALUES(:id,:class)"), {"id": announcement_id, "class": class_id})
    for student_id in ids:
        db.session.execute(text("INSERT INTO announcement_students(announcement_id,student_id) VALUES(:id,:student)"), {"id": announcement_id, "student": student_id})
    for index, file in enumerate(payload["files"], start=1):
        file_id = _file(file, actor)
        db.session.execute(text("INSERT INTO announcement_attachments(announcement_id,file_id,display_order) VALUES(:id,:file,:position)"),
            {"id": announcement_id, "file": file_id, "position": index})
    if payload["status"] == "SENT":
        _dispatch_announcement(announcement_id, actor)
    _audit("announcements", announcement_id, {k: v for k, v in payload.items() if k != "files"}, actor, ip_address, update=editing)
    return announcement_detail(announcement_id, actor=actor)


@_transaction
def create_announcement(payload, *, actor, ip_address):
    return _save_announcement(payload, actor=actor, ip_address=ip_address)


@_transaction
def update_announcement(announcement_id, payload, *, actor, ip_address):
    return _save_announcement(payload, actor=actor, ip_address=ip_address, announcement_id=announcement_id)


@_transaction
def send_announcement(announcement_id, *, actor, ip_address):
    _dispatch_announcement(announcement_id, actor)
    _audit("announcements", announcement_id, {"action": "dispatch"}, actor, ip_address, update=True)
    return announcement_detail(announcement_id, actor=actor)


@_transaction
def remind_announcement(announcement_id, *, actor, ip_address):
    row = _one("SELECT status FROM announcements WHERE id=:id", {"id": announcement_id})
    if row is None:
        raise NotFoundError("Không tìm thấy thông báo")
    if row["status"] not in ("SENDING", "SENT"):
        raise ConflictError("Chỉ có thể nhắc thông báo đã phát hành")
    count = _scalar("SELECT COUNT(*) FROM notifications WHERE announcement_id=:id AND is_read=0", {"id": announcement_id})
    db.session.execute(text("UPDATE notifications SET created_at=SYSDATETIMEOFFSET() WHERE announcement_id=:id AND is_read=0"), {"id": announcement_id})
    # Only retry failed external deliveries. Pending queues are retained without pretending to send.
    db.session.execute(text("""UPDATE d SET status='PENDING',next_attempt_at=SYSDATETIMEOFFSET() FROM notification_deliveries d
        JOIN notifications n ON n.id=d.notification_id WHERE n.announcement_id=:id AND n.is_read=0 AND d.status='FAILED'"""), {"id": announcement_id})
    _audit("announcements", announcement_id, {"action": "remind_unread", "count": count}, actor, ip_address, update=True)
    return {"reminded": count, "external_delivery": "PENDING"}


@_transaction
def reply_announcement(announcement_id, payload, *, actor, ip_address):
    if not payload["content"].strip():
        raise AppError("Phản hồi không được để trống")
    if actor.role.code != RoleCode.MANAGER and not _one("SELECT id FROM notifications WHERE announcement_id=:id AND recipient_user_id=:user", {"id": announcement_id, "user": actor.id}):
        raise ForbiddenError("Bạn không thuộc đối tượng nhận thông báo")
    if not _one("SELECT id FROM announcements WHERE id=:id", {"id": announcement_id}):
        raise NotFoundError("Không tìm thấy thông báo")
    reply_id = _scalar("""INSERT INTO announcement_replies(announcement_id,author_user_id,content)
        OUTPUT INSERTED.id VALUES(:id,:user,:content)""", {"id": announcement_id, "user": actor.id, "content": payload["content"].strip()})
    _audit("announcement_replies", reply_id, {"announcement_id": announcement_id}, actor, ip_address)
    return {"id": reply_id}


def notifications(*, actor):
    rows = _rows("SELECT id,title,content,is_read,created_at,announcement_id,notification_type FROM notifications WHERE recipient_user_id=:user ORDER BY created_at DESC,id DESC", {"user": actor.id})
    return _json({"items": [{"id": str(r["id"]), "title": r["title"], "text": r["content"], "read": bool(r["is_read"]),
        "time": _fmt(r["created_at"]), "announcementId": r["announcement_id"], "type": r["notification_type"]} for r in rows],
        "unread": sum(not r["is_read"] for r in rows)})


@_transaction
def read_notifications(*, actor, ip_address):
    result = db.session.execute(text("""UPDATE notifications SET is_read=1,read_at=SYSDATETIMEOFFSET()
        WHERE recipient_user_id=:user AND is_read=0"""), {"user": actor.id})
    return {"updated": result.rowcount}


def dashboard(*, actor):
    students = _scalar("SELECT COUNT(*) FROM students WHERE status='ACTIVE'")
    today_classes = _rows("""SELECT s.id,c.name,u.full_name AS teacher,r.name AS room,s.start_time,s.end_time,c.max_students,
        (SELECT COUNT(*) FROM class_enrollments e WHERE e.class_id=c.id AND e.status='ACTIVE') AS size,
        CASE WHEN EXISTS(SELECT 1 FROM attendances a WHERE a.session_id=s.id) THEN 1 ELSE 0 END AS done
        FROM class_sessions s JOIN classes c ON c.id=s.class_id JOIN staff_profiles p ON p.id=s.lecturer_id
        JOIN users u ON u.id=p.user_id JOIN rooms r ON r.id=s.room_id
        WHERE s.session_date=CONVERT(date,GETDATE()) AND s.status<>'CANCELLED' ORDER BY s.start_time,c.name""")
    overdue = _one("""SELECT COALESCE(SUM(final_amount-paid_amount),0) AS amount,COUNT(DISTINCT student_id) AS students
        FROM tuition_invoices WHERE status NOT IN ('PAID','CANCELLED') AND due_date<CONVERT(date,GETDATE())""")
    requests = _rows("""SELECT q.id,s.full_name AS name,q.request_type AS status FROM student_requests q
        JOIN students s ON s.id=q.student_id WHERE q.status='PENDING' ORDER BY q.created_at DESC,q.id DESC""")
    recent = _rows("SELECT TOP 8 id,title AS text,created_at FROM notifications WHERE recipient_user_id=:user ORDER BY created_at DESC,id DESC", {"user": actor.id})
    alert = _one("SELECT TOP 1 title,detail FROM ai_alerts WHERE status='NEW' AND alert_type='DEBT_RISK' ORDER BY created_at DESC,id DESC")
    return _json({"students": students, "classes": [{"id": r["id"], "name": r["name"], "teacher": r["teacher"],
        "room": r["room"], "time": f"{r['start_time'].strftime('%H:%M')}–{r['end_time'].strftime('%H:%M')}",
        "size": f"{r['size']}/{r['max_students']}", "done": bool(r["done"])} for r in today_classes],
        "overdue": overdue["amount"], "overdueStudents": overdue["students"],
        "requests": [{**r, "status": "Xin nghỉ" if r["status"] == "LEAVE" else "Bảo lưu"} for r in requests],
        "recent": [{"id": r["id"], "icon": "chat", "text": r["text"], "time": _fmt(r["created_at"])} for r in recent],
        "alert": dict(alert) if alert else None})


def proposals(*, actor):
    rows = _rows("""SELECT id,title,detail,confidence_percent,status,source,recommendation_json FROM ai_alerts
        WHERE status IN ('NEW','ACKNOWLEDGED') AND alert_type IN ('ENROLLMENT_RECOMMENDATION','REENROLLMENT_RISK','DROPOUT_RISK')
        ORDER BY created_at DESC,id DESC""")
    return _json({"items": [{"id": str(r["id"]), "title": r["title"], "why": r["detail"], "conf": r["confidence_percent"],
        "source": r["source"], "state": "accepted" if r["status"] == "ACKNOWLEDGED" else "open"} for r in rows]})


@_transaction
def review_alert(alert_id, payload, *, actor, ip_address):
    row = _one("SELECT id,status FROM ai_alerts WITH(UPDLOCK,HOLDLOCK) WHERE id=:id", {"id": alert_id})
    if row is None:
        raise NotFoundError("Không tìm thấy đề xuất")
    status = {"accepted": "ACKNOWLEDGED", "skip": "DISMISSED", "resolved": "RESOLVED"}[payload["decision"]]
    if row["status"] not in ("NEW", "ACKNOWLEDGED") and row["status"] != status:
        raise ConflictError("Đề xuất đã được xử lý")
    db.session.execute(text("""UPDATE ai_alerts SET status=:status,reviewed_by=:actor,reviewed_at=SYSDATETIMEOFFSET(),review_note=:note
        WHERE id=:id"""), {"id": alert_id, "status": status, "actor": actor.id, "note": payload["note"]})
    _audit("ai_alerts", alert_id, {"status": status, "note": payload["note"]}, actor, ip_address, update=True)
    return {"id": alert_id, "status": status}


@_transaction
def remind_tuition(alert_id, *, actor, ip_address):
    row = _one("SELECT id,student_id,title,detail FROM ai_alerts WITH(UPDLOCK,HOLDLOCK) WHERE id=:id AND alert_type='DEBT_RISK'", {"id": alert_id})
    if row is None:
        raise NotFoundError("Không tìm thấy cảnh báo học phí")
    recipients = _rows("""SELECT u.id FROM users u WHERE u.status='ACTIVE' AND u.deleted_at IS NULL AND
        (EXISTS(SELECT 1 FROM students s WHERE s.id=:student AND s.user_id=u.id)
        OR EXISTS(SELECT 1 FROM student_user_links l WHERE l.student_id=:student AND l.user_id=u.id AND l.can_view=1))""", {"student": row["student_id"]})
    if not recipients:
        raise ConflictError("Học viên chưa có tài khoản hoặc phụ huynh được liên kết để nhận thông báo")
    for recipient in recipients:
        db.session.execute(text("""INSERT INTO notifications(recipient_user_id,notification_type,title,content,created_by)
            VALUES(:user,'TUITION',:title,:content,:actor)"""), {"user": recipient["id"], "title": row["title"], "content": row["detail"], "actor": actor.id})
    db.session.execute(text("UPDATE ai_alerts SET status='ACKNOWLEDGED',reviewed_by=:actor,reviewed_at=SYSDATETIMEOFFSET() WHERE id=:id"),
        {"id": alert_id, "actor": actor.id})
    _audit("ai_alerts", alert_id, {"action": "tuition_reminder", "recipient_count": len(recipients)}, actor, ip_address, update=True)
    return {"recipient_count": len(recipients), "channel": "IN_APP"}


@_transaction
def preview_announcement(announcement_id, *, actor, ip_address):
    row = _one("SELECT title,content,message_type FROM announcements WHERE id=:id", {"id": announcement_id})
    if row is None:
        raise NotFoundError("Không tìm thấy thông báo")
    notification_id = _scalar("""INSERT INTO notifications(recipient_user_id,notification_type,title,content,created_by)
        OUTPUT INSERTED.id VALUES(:user,'GENERAL',:title,:content,:user)""", {"user": actor.id,
            "title": ("[Xem thử] " + row["title"])[:200], "content": row["content"]})
    _audit("notifications", notification_id, {"preview_announcement_id": announcement_id}, actor, ip_address)
    return {"id": notification_id, "channel": "IN_APP"}


def process_due_announcements(*, limit=100):
    """One worker batch. Persist in-app delivery; leave external channels PENDING.

    Each announcement commits independently. A failed audience does not prevent other
    due announcements from being delivered; errors remain visible in the worker result.
    """
    from app.models import User

    if not isinstance(limit, int) or not 1 <= limit <= 1000:
        raise AppError("Giới hạn xử lý phải từ 1 đến 1000")
    ids = [r["id"] for r in _rows("""SELECT TOP (:limit) id FROM announcements
        WHERE status='SCHEDULED' AND scheduled_at<=SYSDATETIMEOFFSET() ORDER BY scheduled_at,id""", {"limit": limit})]
    delivered = []
    failures = []
    for announcement_id in ids:
        try:
            row = _one("SELECT created_by FROM announcements WITH(UPDLOCK,HOLDLOCK) WHERE id=:id", {"id": announcement_id})
            actor = db.session.get(User, row["created_by"])
            if actor is None:
                raise ConflictError("Không tìm thấy người tạo thông báo")
            _dispatch_announcement(announcement_id, actor)
            _audit("announcements", announcement_id, {"action": "scheduled_dispatch"}, actor, None, update=True)
            db.session.commit()
            delivered.append(announcement_id)
        except Exception as error:
            db.session.rollback()
            failures.append({"id": announcement_id, "message": str(error) if isinstance(error, AppError) else "Không thể ghi giao dịch thông báo"})
    return {"delivered": delivered, "failed": failures}


def _forecast_points(scope, metric=None):
    run = _one("""SELECT TOP 1 id,model_name,model_version,source,completed_at FROM ai_forecast_runs
        WHERE scope=:scope AND status='COMPLETED' ORDER BY completed_at DESC,id DESC""", {"scope": scope})
    if run is None:
        return None, []
    rows = _rows("""SELECT p.*,COALESCE(c.name,g.name) AS dimension,s.full_name AS student_name,s.student_code
        FROM ai_forecast_points p LEFT JOIN courses c ON c.id=p.course_id LEFT JOIN course_groups g ON g.id=p.course_group_id
        LEFT JOIN students s ON s.id=p.student_id WHERE p.run_id=:id ORDER BY p.period_start,p.id""", {"id": run["id"]})
    return dict(run), [r for r in rows if metric is None or r["metric_code"] == metric]


def _retention_counts():
    # Completed enrollment with a later enrollment is the recorded re-enrollment evidence.
    return _one("""SELECT COUNT(*) AS completed,
        COALESCE(SUM(CASE WHEN EXISTS_LATER=1 THEN 1 ELSE 0 END),0) AS reenrolled
        FROM (SELECT student_id,MAX(EXISTS_LATER) AS EXISTS_LATER FROM
            (SELECT e.student_id,CASE WHEN EXISTS(SELECT 1 FROM class_enrollments n WHERE n.student_id=e.student_id
                AND n.id<>e.id AND n.enrolled_date>COALESCE(e.left_date,e.enrolled_date)) THEN 1 ELSE 0 END AS EXISTS_LATER
            FROM class_enrollments e WHERE e.status='COMPLETED') completed_enrollments GROUP BY student_id) q""")


def retention(*, actor):
    counts = dict(_retention_counts())
    run, points = _forecast_points("COURSE", "REENROLLMENT_PROBABILITY")
    items = []
    for p in points:
        if p["student_id"] is None:
            continue
        cls = _one("""SELECT TOP 1 c.name FROM class_enrollments e JOIN classes c ON c.id=e.class_id
            WHERE e.student_id=:id ORDER BY CASE WHEN e.status='ACTIVE' THEN 0 ELSE 1 END,e.id DESC""", {"id": p["student_id"]})
        basis = json.loads(p["basis_json"]) if p["basis_json"] else {}
        items.append({"id": p["student_code"], "name": p["student_name"], "cls": cls["name"] if cls else "—",
            "gpa": basis.get("gpa", "—"), "rate": basis.get("attendance", "—"), "prob": p["predicted_value"],
            "tip": basis.get("recommendation", "—")})
    return _json({"items": items, "counts": counts, "run": run})


def dropout(*, actor):
    count = _scalar("SELECT COUNT(*) FROM students WHERE status='DROPPED'")
    students = _scalar("SELECT COUNT(*) FROM students")
    risk = _rows("""SELECT a.id,s.student_code,s.full_name AS name,a.detail AS why,a.severity,a.status FROM ai_alerts a
        JOIN students s ON s.id=a.student_id WHERE a.alert_type='DROPOUT_RISK' AND a.status IN ('NEW','ACKNOWLEDGED')
        ORDER BY a.created_at DESC,a.id DESC""")
    return _json({"count": count, "students": students, "rate": round(100*count/students, 1) if students else 0,
        "items": [{**r, "level": "Cao" if r["severity"] == "HIGH" else "Trung bình"} for r in risk],
        "resolved": _scalar("SELECT COUNT(*) FROM ai_alerts WHERE alert_type='DROPOUT_RISK' AND status='RESOLVED'")})


def forecast(scope, *, actor):
    scope = {"khoa": "COURSE", "thang": "MONTH", "nam": "YEAR"}.get(scope, scope.upper())
    if scope == "OVERVIEW":
        return _admissions_data(actor)
    if scope not in ("COURSE", "MONTH", "YEAR"):
        raise AppError("Phạm vi dự báo không hợp lệ")
    run, points = _forecast_points(scope)
    return _json({"run": run, "items": points, "total": len(points)})


def _admissions_data(actor):
    retention_data = retention(actor=actor)
    dropout_data = dropout(actor=actor)
    completed = int(retention_data["counts"]["completed"])
    reenrolled = int(retention_data["counts"]["reenrolled"])
    retention_rate = round(100*reenrolled/completed, 1) if completed else None
    leads = _one("SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN status='ENROLLED' THEN 1 ELSE 0 END),0) AS enrolled FROM admission_leads")
    capacity = _one("""SELECT COALESCE(SUM(max_students),0) AS capacity,
        (SELECT COUNT(*) FROM class_enrollments e JOIN classes x ON x.id=e.class_id WHERE e.status='ACTIVE' AND x.status='ONGOING') AS occupied
        FROM classes WHERE status='ONGOING'""")
    colors = ["var(--success-fill)", "var(--warning-fill)", "var(--primary)"]
    data = {key: [] for key in ("REENROLL", "DROPOUT_TREND", "OVERVIEW_KPIS", "FORECASTS", "PROPOSALS",
        "COURSE_FORECAST", "BASIS", "NEXT_COURSE_ACTIONS", "MONTHS", "BY_COURSE_T10", "WEEKS", "YEAR",
        "QUARTERS", "STRATEGY", "AT_RISK_ENROLL", "REASONS", "DROPOUT_BY_COURSE", "DROPOUT_RISK")}
    data["OVERVIEW_KPIS"] = [
        {"label": "Tỉ lệ tái đăng ký", "value": f"{retention_rate}%" if retention_rate is not None else "—", "accent": colors[0]},
        {"label": "Tỉ lệ nghỉ học", "value": f"{dropout_data['rate']}%", "accent": "var(--danger)"},
        {"label": "Tỉ lệ chuyển đổi", "value": f"{round(100*leads['enrolled']/leads['total'],1)}%" if leads["total"] else "—", "accent": colors[2]},
        {"label": "Tỉ lệ lấp đầy lớp", "value": f"{round(100*capacity['occupied']/capacity['capacity'],1)}%" if capacity["capacity"] else "—", "accent": colors[1]},
    ]
    data["PROPOSALS"] = proposals(actor=actor)["items"]
    data["AT_RISK_ENROLL"] = retention_data["items"]
    data["DROPOUT_RISK"] = dropout_data["items"]
    data["summary"] = {"completed": completed, "reenrolled": reenrolled, "unregistered": completed-reenrolled,
        "retentionRate": retention_rate, "dropoutCount": dropout_data["count"], "dropoutRate": dropout_data["rate"],
        "dropoutRisk": len(dropout_data["items"]), "resolved": dropout_data["resolved"]}
    for scope, tab, caption in (("COURSE", "khoa", "Khóa tiếp theo"), ("MONTH", "thang", "Tháng tiếp theo"), ("YEAR", "nam", "Năm tiếp theo")):
        run, points = _forecast_points(scope)
        enroll = [p for p in points if p["metric_code"] == "ENROLLMENT_COUNT"]
        if run and enroll:
            confidence = [float(p["confidence_percent"]) for p in enroll if p["confidence_percent"] is not None]
            data["FORECASTS"].append({"tab": tab, "caption": caption, "value": f"{sum(p['predicted_value'] for p in enroll):g} học viên",
                "delta": "", "ai": run["model_name"], "conf": round(sum(confidence)/len(confidence)) if confidence else None, "accent": colors[0]})
        if scope == "COURSE":
            data["COURSE_FORECAST"] = [{"name": p["dimension"] or "—", "now": "—", "rate": "—", "fresh": "—", "pred": p["predicted_value"],
                "classes": "—", "trust": "Cao" if (p["confidence_percent"] or 0) >= 80 else "Trung bình"} for p in enroll]
        key = "MONTHS" if scope == "MONTH" else "YEAR" if scope == "YEAR" else None
        if key:
            data[key] = [{"label": _fmt(p["period_start"]), "value": p["predicted_value"], "color": colors[2]} for p in enroll]
        for point in points:
            if point["basis_json"]:
                basis = json.loads(point["basis_json"])
                if isinstance(basis, dict):
                    data["BASIS"].extend({"t": str(k), "d": str(v)} for k, v in basis.items())
    return _json(data)
