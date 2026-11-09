"""Run only through the guarded disposable SQL Server test database fixture."""
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from threading import Barrier

import pytest
from sqlalchemy import text

from app.extensions import db


PREFIX = "/api/v1"
FILE_BYTES = b"%PDF-1.4\nNeko receipt bytes\x00\xff"
FILE = {"name": "receipt.pdf", "mime": "application/pdf", "content": base64.b64encode(FILE_BYTES).decode()}


def scalar(sql, params=None):
    return db.session.execute(text(sql), params or {}).scalar_one()


@pytest.fixture
def operations_scope(app, users):
    with app.app_context():
        staff = dict(db.session.execute(text("SELECT user_id,id FROM staff_profiles")).all())
        level = scalar("""INSERT INTO levels(code,name,min_age,max_age,sort_order) OUTPUT INSERTED.id
            VALUES('KID_1',N'Kid 1',6,9,1)""")
        course = scalar("""INSERT INTO courses(course_code,level_id,name,sessions_per_week,session_minutes,monthly_fee,status)
            OUTPUT INSERTED.id VALUES('OP-COURSE',:level,N'Operations course',2,90,1000000,'ACTIVE')""", {"level": level})
        room = scalar("INSERT INTO rooms(code,name,capacity,status) OUTPUT INSERTED.id VALUES('OP-R',N'Operations room',20,'AVAILABLE')")
        cls = scalar("""INSERT INTO classes(class_code,name,course_id,lecturer_id,assistant_id,default_room_id,max_students,start_date,end_date,status)
            OUTPUT INSERTED.id VALUES('OP-CLS',N'Operations class',:course,:lecturer,:assistant,:room,20,'2026-01-01','2027-12-31','ONGOING')""",
            {"course": course, "lecturer": staff[users["lecturer"]], "assistant": staff[users["assistant"]], "room": room})
        guardian = scalar("INSERT INTO guardians(full_name,phone,relationship) OUTPUT INSERTED.id VALUES(N'Operations parent','0902000001','GUARDIAN')")
        student = scalar("""INSERT INTO students(student_code,full_name,date_of_birth,guardian_id,user_id,current_level_id,enrolled_at,status)
            OUTPUT INSERTED.id VALUES('OP001',N'Operations student','2018-01-01',:guardian,:user,:level,'2026-01-01','ACTIVE')""",
            {"guardian": guardian, "user": users["student"], "level": level})
        enrollment = scalar("""INSERT INTO class_enrollments(class_id,student_id,enrolled_date,status)
            OUTPUT INSERTED.id VALUES(:class,:student,'2026-01-01','ACTIVE')""", {"class": cls, "student": student})
        invoice = scalar("""INSERT INTO tuition_invoices(invoice_code,student_id,class_id,billing_month,base_amount,
            discount_amount,final_amount,paid_amount,due_date,status,generated_by)
            OUTPUT INSERTED.id VALUES('OP-INV',:student,:class,:month,1000000,0,1000000,0,:due,'UNPAID','IMPORT')""",
            {"student": student, "class": cls, "month": date.today().replace(day=1), "due": date.today()+timedelta(days=7)})
        db.session.execute(text("INSERT INTO finance_categories(code,name,txn_type) VALUES('TUITION',N'Thu học phí','INCOME'),('UTILITIES',N'Điện nước','EXPENSE')"))
        db.session.execute(text("UPDATE staff_profiles SET hourly_rate=300000 WHERE id=:id"), {"id": staff[users["lecturer"]]})
        db.session.execute(text("UPDATE staff_profiles SET hourly_rate=150000 WHERE id=:id"), {"id": staff[users["assistant"]]})
        session = scalar("""INSERT INTO class_sessions(class_id,session_date,start_time,end_time,room_id,lecturer_id,assistant_id,status)
            OUTPUT INSERTED.id VALUES(:class,:today,'18:00','19:30',:room,:lecturer,:assistant,'COMPLETED')""",
            {"class": cls, "today": date.today(), "room": room, "lecturer": staff[users["lecturer"]], "assistant": staff[users["assistant"]]})
        db.session.execute(text("""INSERT INTO class_sessions(class_id,session_date,start_time,end_time,room_id,lecturer_id,status)
            VALUES(:class,:today,'20:00','21:30',:room,:lecturer,'CANCELLED')"""),
            {"class": cls, "today": date.today(), "room": room, "lecturer": staff[users["lecturer"]]})
        alert = scalar("""INSERT INTO ai_alerts(alert_type,severity,student_id,title,detail,source)
            OUTPUT INSERTED.id VALUES('DEBT_RISK','HIGH',:student,N'Debt risk',N'Existing recorded debt signal','AI_ENGINE')""", {"student": student})
        proposal = scalar("""INSERT INTO ai_alerts(alert_type,severity,title,detail,source,confidence_percent)
            OUTPUT INSERTED.id VALUES('ENROLLMENT_RECOMMENDATION','LOW',N'Enrollment proposal',N'Recorded proposal','AI_ENGINE',83)""")
        db.session.commit()
    return {"student": student, "class": cls, "invoice": invoice, "session": session,
        "enrollment": enrollment, "staff": staff, "alert": alert, "proposal": proposal}


def payment(**changes):
    return {"invoice": "OP-INV", "amount": 400000, "date": date.today().isoformat(), "method": "BANK_TRANSFER", **changes}


def announcement(**changes):
    return {"title": "SQL announcement", "content": "Persisted content", "status": "SENT",
        "audience_type": "ALL_STUDENTS", "files": [FILE], **changes}


def test_payment_commit_receipt_ledger_binary_and_reload(app, client, users, auth_header, operations_scope):
    headers = auth_header(users["manager"])
    response = client.post(PREFIX+"/manager/payments", headers=headers, json=payment(files=[FILE]))
    assert response.status_code == 201, response.get_json()
    body = response.get_json()
    assert body["paid_amount"] == 400000 and body["balance"] == 600000
    history = client.get(PREFIX+"/manager/students/OP001/payments", headers=headers).get_json()
    assert history["student"]["name"] == "Operations student"
    assert history["items"][0]["paid"] == 400000 and history["items"][0]["balance"] == 600000
    assert history["payments"][0]["receipt_no"] == body["receipt_no"]
    with app.app_context():
        assert scalar("SELECT paid_amount FROM tuition_invoices WHERE id=:id", {"id": operations_scope["invoice"]}) == 400000
        assert scalar("SELECT COUNT(*) FROM receipts") == scalar("SELECT COUNT(*) FROM payments") == 1
        file_id = scalar("SELECT file_id FROM finance_transaction_attachments")
        assert bytes(scalar("SELECT content FROM stored_files WHERE id=:id", {"id": file_id})) == FILE_BYTES
        assert scalar("SELECT amount FROM finance_transactions WHERE payment_id=:id", {"id": body["payment_id"]}) == 400000
        assert scalar("SELECT COUNT(*) FROM audit_logs WHERE entity_name='payments'") == 1
    assert client.get(PREFIX+f"/manager/operations/files/{file_id}", headers=headers).data == FILE_BYTES
    assert client.post(PREFIX+"/manager/payments", headers=headers, json=payment(amount=600000)).status_code == 201
    assert client.get(PREFIX+"/manager/students/OP001/payments", headers=headers).get_json()["items"][0]["status"] == "paid"


@pytest.mark.parametrize("changes,expected", [({"amount": 0}, 422), ({"amount": -1}, 422), ({"amount": 1000001}, 409),
    ({"invoice": "MISSING"}, 404), ({"method": "CARD"}, 422), ({"files": [{**FILE, "content": "!!!"}]}, 400)])
def test_payment_validation_and_atomic_rollback(app, client, users, auth_header, operations_scope, changes, expected):
    response = client.post(PREFIX+"/manager/payments", headers=auth_header(users["manager"]), json=payment(**changes))
    assert response.status_code == expected, response.get_json()
    with app.app_context():
        assert scalar("SELECT COUNT(*) FROM payments") == 0
        assert scalar("SELECT COUNT(*) FROM receipts") == 0
        assert scalar("SELECT COUNT(*) FROM finance_transactions") == 0
        assert scalar("SELECT paid_amount FROM tuition_invoices WHERE id=:id", {"id": operations_scope["invoice"]}) == 0


def test_concurrent_payments_cannot_overpay(app, users, auth_header, operations_scope):
    headers = auth_header(users["manager"])
    barrier = Barrier(2)
    def submit():
        with app.test_client() as client:
            barrier.wait(timeout=10)
            return client.post(PREFIX+"/manager/payments", headers=headers, json=payment(amount=700000)).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: submit(), range(2)))
    assert sorted(results) == [201, 409]
    with app.app_context():
        assert scalar("SELECT SUM(amount) FROM payments") == 700000
        assert scalar("SELECT paid_amount FROM tuition_invoices WHERE id=:id", {"id": operations_scope["invoice"]}) == 700000


def test_retry_same_payment_request_is_idempotent(app, client, users, auth_header, operations_scope):
    headers = auth_header(users["manager"])
    body = payment(request_id="operation-payment-retry-001")
    first = client.post(PREFIX+"/manager/payments", headers=headers, json=body)
    second = client.post(PREFIX+"/manager/payments", headers=headers, json=body)
    assert first.status_code == second.status_code == 201
    assert first.get_json()["payment_id"] == second.get_json()["payment_id"]
    assert client.post(PREFIX+"/manager/payments", headers=headers, json={**body, "amount": 300000}).status_code == 409
    with app.app_context():
        assert scalar("SELECT COUNT(*) FROM payments") == scalar("SELECT COUNT(*) FROM receipts") == 1
        assert scalar("SELECT paid_amount FROM tuition_invoices WHERE id=:id", {"id": operations_scope["invoice"]}) == 400000


def test_ledger_proof_persists_and_wrong_category_is_rejected(app, client, users, auth_header, operations_scope):
    headers = auth_header(users["manager"])
    body = {"type": "expense", "date": date.today().isoformat(), "amount": 350000,
        "category": "Điện nước", "note": "SQL utilities", "files": [FILE]}
    response = client.post(PREFIX+"/manager/ledger", headers=headers, json=body)
    assert response.status_code == 201, response.get_json()
    ledger = client.get(PREFIX+"/manager/ledger", headers=headers).get_json()
    assert ledger["items"][0]["amount"] == -350000
    assert ledger["items"][0]["attachments"] == 1
    assert ledger["totals"]["expense"] == 0.35
    assert client.post(PREFIX+"/manager/ledger", headers=headers, json={**body, "type": "income"}).status_code == 400
    with app.app_context():
        assert scalar("SELECT COUNT(*) FROM finance_transactions") == 1
        assert scalar("SELECT COUNT(*) FROM stored_files") == 1


def test_ledger_retry_has_one_transaction_and_proof(app, client, users, auth_header, operations_scope):
    headers = auth_header(users["manager"])
    body = {"request_id": "operations-ledger-retry-001", "type": "expense", "date": date.today().isoformat(),
        "amount": 350000, "category": "Điện nước", "note": "SQL utilities", "files": [FILE]}
    first = client.post(PREFIX+"/manager/ledger", headers=headers, json=body)
    second = client.post(PREFIX+"/manager/ledger", headers=headers, json=body)
    assert first.status_code == second.status_code == 201
    assert first.get_json()["id"] == second.get_json()["id"]
    assert client.post(PREFIX+"/manager/ledger", headers=headers, json={**body, "amount": 100000}).status_code == 409
    with app.app_context():
        assert scalar("SELECT COUNT(*) FROM finance_transactions") == 1
        assert scalar("SELECT COUNT(*) FROM stored_files") == 1


def test_hourly_payroll_completed_only_and_idempotent(app, client, users, auth_header, operations_scope):
    month = date.today().strftime("%Y-%m")
    headers = auth_header(users["manager"])
    response = client.post(PREFIX+f"/manager/payroll/{month}/close", headers=headers)
    assert response.status_code == 200, response.get_json()
    assert response.get_json()["approved"] == 2
    assert client.post(PREFIX+f"/manager/payroll/{month}/close", headers=headers).get_json()["approved"] == 0
    with app.app_context():
        rows = db.session.execute(text("SELECT calculation_basis,teaching_hours,hourly_rate,total_amount,status FROM staff_payrolls ORDER BY total_amount DESC")).mappings().all()
        assert len(rows) == 2 and all(r["calculation_basis"] == "HOUR" and r["status"] == "APPROVED" for r in rows)
        assert float(rows[0]["teaching_hours"]) == 1.5 and int(rows[0]["total_amount"]) == 450000
        assert int(rows[1]["total_amount"]) == 225000
        assert scalar("SELECT COUNT(*) FROM finance_transactions WHERE payroll_id IS NOT NULL") == 0


def test_payroll_missing_rate_rolls_back_all_staff(app, client, users, auth_header, operations_scope):
    with app.app_context():
        db.session.execute(text("UPDATE staff_profiles SET hourly_rate=NULL WHERE id=:id"), {"id": operations_scope["staff"][users["assistant"]]})
        db.session.commit()
    response = client.post(PREFIX+f"/manager/payroll/{date.today():%Y-%m}/close", headers=auth_header(users["manager"]))
    assert response.status_code == 409
    with app.app_context():
        assert scalar("SELECT COUNT(*) FROM staff_payrolls") == 0


def test_payroll_preserves_existing_hourly_bonus_and_deduction(app, client, users, auth_header, operations_scope):
    staff = operations_scope["staff"][users["lecturer"]]
    with app.app_context():
        db.session.execute(text("""INSERT INTO staff_payrolls(staff_id,payroll_month,session_count,rate_per_session,
            bonus,deduction,total_amount,status,calculation_basis,teaching_hours,hourly_rate)
            VALUES(:staff,:month,1,0,50000,20000,480000,'DRAFT','HOUR',1.5,300000)"""),
            {"staff": staff, "month": date.today().replace(day=1)})
        db.session.commit()
    response = client.post(PREFIX+f"/manager/payroll/{date.today():%Y-%m}/close", headers=auth_header(users["manager"]))
    assert response.status_code == 200
    with app.app_context():
        row = db.session.execute(text("SELECT bonus,deduction,total_amount,status FROM staff_payrolls WHERE staff_id=:staff"), {"staff": staff}).mappings().one()
        assert int(row["bonus"]) == 50000 and int(row["deduction"]) == 20000
        assert int(row["total_amount"]) == 480000 and row["status"] == "APPROVED"


def test_announcement_send_targets_files_read_and_replies(app, client, users, auth_header, operations_scope):
    headers = auth_header(users["manager"])
    response = client.post(PREFIX+"/manager/announcements", headers=headers,
        json=announcement(audience_type="CLASSES", class_ids=[operations_scope["class"]], send_email=True, send_push=True))
    assert response.status_code == 201, response.get_json()
    item = response.get_json()["item"]
    assert item["status"] == "sending" and item["total"] == 1 and item["pending"] == 2
    aid = item["id"]
    with app.app_context():
        assert scalar("SELECT COUNT(*) FROM announcement_classes") == 1
        assert scalar("SELECT COUNT(*) FROM announcement_students") == 1
        assert scalar("SELECT COUNT(*) FROM notification_deliveries WHERE channel='IN_APP' AND status='SENT'") == 1
        assert scalar("SELECT COUNT(*) FROM notification_deliveries WHERE channel IN ('EMAIL','PUSH') AND status='PENDING'") == 2
    # Calling send again does not create duplicate recipient rows or deliveries.
    assert client.post(PREFIX+f"/manager/announcements/{aid}/send", headers=headers).status_code == 200
    student_headers = auth_header(users["student"])
    notices = client.get(PREFIX+"/notifications", headers=student_headers).get_json()
    assert notices["unread"] == 1 and notices["items"][0]["title"] == "SQL announcement"
    assert client.post(PREFIX+"/notifications/read-all", headers=student_headers).get_json()["updated"] == 1
    assert client.post(PREFIX+f"/manager/announcements/{aid}/replies", headers=student_headers, json={"content": "Real reply"}).status_code == 201
    detail = client.get(PREFIX+f"/manager/announcements/{aid}", headers=headers).get_json()
    assert detail["item"]["read"] == 100 and detail["recipients"][0]["read"] is True
    assert detail["replies"][0]["text"] == "Real reply" and detail["files"][0]["name"] == "receipt.pdf"
    assert client.get(PREFIX+f"/manager/operations/files/{detail['files'][0]['id']}", headers=headers).data == FILE_BYTES


def test_draft_schedule_dispatch_preview_and_unread_reminder(app, client, users, auth_header, operations_scope):
    headers = auth_header(users["manager"])
    draft = client.post(PREFIX+"/manager/announcements", headers=headers, json=announcement(status="DRAFT"))
    assert draft.status_code == 201
    aid = draft.get_json()["item"]["id"]
    assert client.post(PREFIX+f"/manager/announcements/{aid}/preview", headers=headers).status_code == 200
    assert client.get(PREFIX+"/notifications", headers=headers).get_json()["items"][0]["title"].startswith("[Xem thử]")
    assert client.post(PREFIX+f"/manager/announcements/{aid}/send", headers=headers).status_code == 200
    assert client.post(PREFIX+f"/manager/announcements/{aid}/remind", headers=headers).get_json()["reminded"] == 1
    schedule = client.post(PREFIX+"/manager/announcements", headers=headers,
        json=announcement(status="SCHEDULED", scheduled_at=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()))
    assert schedule.status_code == 201 and schedule.get_json()["item"]["status"] == "scheduled"
    assert client.post(PREFIX+f"/manager/announcements/{schedule.get_json()['item']['id']}/send", headers=headers).status_code == 409


def test_announcement_offset_roundtrip_and_due_worker(app, client, users, auth_header, operations_scope):
    from app.services.operations_service import process_due_announcements
    offset = timezone(timedelta(hours=7))
    planned = (datetime.now(offset)+timedelta(days=2)).replace(microsecond=0)
    response = client.post(PREFIX+"/manager/announcements", headers=auth_header(users["manager"]),
        json=announcement(status="SCHEDULED", scheduled_at=planned.isoformat(), send_email=True))
    assert response.status_code == 201, response.get_json()
    aid = int(response.get_json()["item"]["id"])
    with app.app_context():
        stored = scalar("SELECT scheduled_at FROM announcements WHERE id=:id", {"id": aid})
        assert stored == planned
        assert stored.utcoffset() == timedelta(hours=7)
        assert process_due_announcements()["delivered"] == []
        db.session.execute(text("UPDATE announcements SET scheduled_at=DATEADD(minute,-1,SYSDATETIMEOFFSET()) WHERE id=:id"), {"id": aid})
        db.session.commit()
        result = process_due_announcements()
        assert result == {"delivered": [aid], "failed": []}
        assert process_due_announcements()["delivered"] == []
        assert scalar("SELECT status FROM announcements WHERE id=:id", {"id": aid}) == "SENDING"
        assert scalar("SELECT COUNT(*) FROM notifications WHERE announcement_id=:id", {"id": aid}) == 1
        assert scalar("SELECT status FROM notification_deliveries WHERE channel='EMAIL'") == "PENDING"


def test_autosaved_draft_updates_same_sql_row_then_dispatches(app, client, users, auth_header, operations_scope):
    headers = auth_header(users["manager"])
    first = client.post(PREFIX+"/manager/announcements", headers=headers, json=announcement(status="DRAFT", files=[]))
    assert first.status_code == 201
    aid = first.get_json()["item"]["id"]
    updated = client.patch(PREFIX+f"/manager/announcements/{aid}", headers=headers,
        json=announcement(status="DRAFT", title="Edited SQL draft", audience_type="STUDENTS", students=["OP001"]))
    assert updated.status_code == 200, updated.get_json()
    assert updated.get_json()["item"]["title"] == "Edited SQL draft"
    dispatched = client.patch(PREFIX+f"/manager/announcements/{aid}", headers=headers,
        json=announcement(title="Edited SQL draft", audience_type="STUDENTS", students=["OP001"]))
    assert dispatched.status_code == 200 and dispatched.get_json()["item"]["status"] == "sent"
    with app.app_context():
        assert scalar("SELECT COUNT(*) FROM announcements") == 1
        assert scalar("SELECT COUNT(*) FROM announcement_students") == 1
        assert scalar("SELECT COUNT(*) FROM notifications WHERE announcement_id=:id", {"id": aid}) == 1


def test_draft_update_rolls_back_and_sent_content_is_immutable(client, users, auth_header, operations_scope):
    headers = auth_header(users["manager"])
    first = client.post(PREFIX+"/manager/announcements", headers=headers, json=announcement(status="DRAFT"))
    assert first.status_code == 201
    aid = first.get_json()["item"]["id"]
    response = client.patch(PREFIX+f"/manager/announcements/{aid}", headers=headers,
        json=announcement(status="DRAFT", title="Should roll back", files=[{**FILE, "content": "!!!"}]))
    assert response.status_code == 400
    unchanged = client.get(PREFIX+f"/manager/announcements/{aid}", headers=headers).get_json()
    assert unchanged["item"]["title"] == "SQL announcement" and unchanged["files"][0]["name"] == "receipt.pdf"
    assert client.post(PREFIX+f"/manager/announcements/{aid}/send", headers=headers).status_code == 200
    assert client.patch(PREFIX+f"/manager/announcements/{aid}", headers=headers, json=announcement(title="Cannot overwrite sent")).status_code == 409


def test_payment_keeps_vietnam_date_offset(app, client, users, auth_header, operations_scope):
    response = client.post(PREFIX+"/manager/payments", headers=auth_header(users["manager"]), json=payment())
    assert response.status_code == 201
    with app.app_context():
        paid_at = scalar("SELECT paid_at FROM payments WHERE id=:id", {"id": response.get_json()["payment_id"]})
        assert paid_at.date() == date.today()
        assert paid_at.utcoffset() == timedelta(hours=7)


@pytest.mark.parametrize("changes", [
    {"audience_type": "STUDENTS", "students": ["DOES-NOT-EXIST"]},
    {"audience_type": "CLASSES", "class_ids": [999999]},
    {"files": [{**FILE, "content": "corrupt"}]},
    {"status": "SCHEDULED", "scheduled_at": "2020-01-01T08:00:00+07:00"},
    {"content": " "},
])
def test_announcement_invalid_targets_attachments_or_schedule_roll_back(app, client, users, auth_header, operations_scope, changes):
    response = client.post(PREFIX+"/manager/announcements", headers=auth_header(users["manager"]), json=announcement(**changes))
    assert response.status_code in (400, 422), response.get_json()
    with app.app_context():
        assert scalar("SELECT COUNT(*) FROM announcements") == 0
        assert scalar("SELECT COUNT(*) FROM notifications") == 0
        assert scalar("SELECT COUNT(*) FROM stored_files") == 0


def test_tuition_reminder_and_proposal_review_persist(app, client, users, auth_header, operations_scope):
    headers = auth_header(users["manager"])
    assert client.post(PREFIX+f"/manager/tuition/risks/{operations_scope['alert']}/remind", headers=headers).status_code == 200
    risks = client.get(PREFIX+"/manager/tuition/risks", headers=headers).get_json()["items"]
    assert risks[0]["reminded"] is True and risks[0]["debt"] == 1000000
    response = client.post(PREFIX+f"/manager/ai-alerts/{operations_scope['proposal']}/review", headers=headers, json={"decision": "accepted"})
    assert response.status_code == 200 and response.get_json()["status"] == "ACKNOWLEDGED"
    proposals = client.get(PREFIX+"/manager/admissions/proposals", headers=headers).get_json()["items"]
    assert proposals[0]["state"] == "accepted" and proposals[0]["conf"] == 83
    assert client.post(PREFIX+f"/manager/ai-alerts/{operations_scope['proposal']}/review", headers=headers, json={"decision": "skip"}).status_code == 200
    assert client.get(PREFIX+"/manager/admissions/proposals", headers=headers).get_json()["items"] == []
    with app.app_context():
        assert scalar("SELECT COUNT(*) FROM notifications WHERE notification_type='TUITION'") == 1
        assert scalar("SELECT status FROM ai_alerts WHERE id=:id", {"id": operations_scope["proposal"]}) == "DISMISSED"


@pytest.mark.parametrize("path", ["/manager/tuition", "/manager/tuition/risks", "/manager/students/OP001/payments",
    "/manager/ledger", "/manager/announcements", "/manager/announcements/options", "/manager/dashboard",
    "/manager/admissions/forecast/course", "/manager/admissions/forecast/month", "/manager/admissions/forecast/year",
    "/manager/admissions/forecast/overview", "/manager/admissions/retention", "/manager/admissions/dropout", "/manager/admissions/proposals"])
def test_all_manager_operation_reads_sql_response_and_role_scope(client, users, auth_header, operations_scope, path):
    response = client.get(PREFIX+path, headers=auth_header(users["manager"]))
    assert response.status_code == 200, response.get_json()
    assert isinstance(response.get_json(), dict)
    assert client.get(PREFIX+path, headers=auth_header(users["student"])).status_code == 403
    assert client.get(PREFIX+path).status_code == 401


def test_dashboard_aggregates_and_empty_forecast_are_honest(client, users, auth_header, operations_scope):
    headers = auth_header(users["manager"])
    data = client.get(PREFIX+"/manager/dashboard", headers=headers).get_json()
    assert data["students"] == 1 and len(data["classes"]) == 1
    assert data["classes"][0]["name"] == "Operations class" and data["classes"][0]["size"] == "1/20"
    assert data["overdue"] == 0 and data["alert"]["title"] == "Debt risk"
    for scope in ("course", "month", "year"):
        result = client.get(PREFIX+f"/manager/admissions/forecast/{scope}", headers=headers).get_json()
        assert result["run"] is None and result["items"] == []
    result = client.get(PREFIX+"/manager/admissions/forecast/overview", headers=headers).get_json()
    assert result["COURSE_FORECAST"] == result["MONTHS"] == result["YEAR"] == []


def test_unlinked_user_cannot_reply_or_download_finance_file(client, users, auth_header, operations_scope):
    response = client.post(PREFIX+"/manager/announcements", headers=auth_header(users["manager"]), json=announcement())
    assert response.status_code == 201
    aid = response.get_json()["item"]["id"]
    headers = auth_header(users["lecturer"])
    assert client.post(PREFIX+f"/manager/announcements/{aid}/replies", headers=headers, json={"content": "Unauthorized"}).status_code == 403
    assert client.get(PREFIX+f"/manager/operations/files/{response.get_json()['files'][0]['id']}", headers=headers).status_code == 403
