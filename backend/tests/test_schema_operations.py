"""Exercise persisted FE operations without sending messages or using the demo DB."""
from decimal import Decimal

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.extensions import db
from app.models import StaffProfile


def reject(sql, values):
    with pytest.raises(DBAPIError):
        db.session.execute(text(sql), values)
    db.session.rollback()


def announcement(author):
    result = db.session.execute(text("""
        INSERT INTO announcements (title, content, message_type, audience_type, created_by)
        OUTPUT INSERTED.id VALUES (N'Lịch học', N'Nội dung', 'SCHEDULE', 'ALL_STUDENTS', :author)
    """), {"author": author}).scalar_one()
    db.session.commit()
    return result


def test_scheduled_and_sent_announcements_require_valid_workflow(app, users):
    with app.app_context():
        item = announcement(users["manager"])
        reject("UPDATE announcements SET status='SCHEDULED' WHERE id=:id", {"id": item})
        reject("UPDATE announcements SET status='SENT' WHERE id=:id", {"id": item})
        reject("UPDATE announcements SET audience_type='UNKNOWN' WHERE id=:id", {"id": item})
        db.session.execute(text("""
            UPDATE announcements SET status='SCHEDULED', scheduled_at='2026-12-01T08:00:00+07:00'
            WHERE id=:id
        """), {"id": item})
        db.session.commit()
        reject("UPDATE announcements SET content=N'' WHERE id=:id", {"id": item})


def test_notification_fanout_is_unique_and_read_rate_is_derived(app, users):
    with app.app_context():
        item = announcement(users["manager"])
        sql = """INSERT INTO notifications
            (recipient_user_id, notification_type, title, content, announcement_id)
            VALUES (:recipient, 'GENERAL', N'Thông báo', N'Nội dung', :item)"""
        db.session.execute(text(sql), {"recipient": users["lecturer"], "item": item})
        db.session.execute(text(sql), {"recipient": users["student"], "item": item})
        db.session.execute(text("""UPDATE notifications SET is_read=1, read_at=SYSDATETIMEOFFSET()
            WHERE recipient_user_id=:user AND announcement_id=:item"""),
            {"user": users["lecturer"], "item": item})
        db.session.commit()
        reject(sql, {"recipient": users["lecturer"], "item": item})
        row = db.session.execute(text("SELECT * FROM v_announcement_read_summary WHERE announcement_id=:id"),
                                 {"id": item}).mappings().one()
        assert row["recipient_count"] == 2
        assert row["read_count"] == 1
        assert row["read_percent"] == Decimal("50.00")
        notification = db.session.execute(text("SELECT MIN(id) FROM notifications WHERE announcement_id=:id"),
                                         {"id": item}).scalar_one()
        reject("INSERT INTO notification_deliveries(notification_id,channel,status) VALUES (:id,'EMAIL','SENT')",
               {"id": notification})


def test_announcement_attachments_limit_five_and_share_real_file_storage(app, users):
    with app.app_context():
        item = announcement(users["manager"])
        files = []
        for position in range(1, 7):
            file_id = db.session.execute(text("""INSERT INTO stored_files
                (filename,mime_type,byte_size,content,uploaded_by) OUTPUT INSERTED.id
                VALUES (:name,'application/pdf',4,:data,:author)"""),
                {"name": f"notice-{position}.pdf", "data": b"test", "author": users["manager"]}).scalar_one()
            files.append(file_id)
            if position <= 5:
                db.session.execute(text("INSERT INTO announcement_attachments VALUES (:item,:file,:pos)"),
                                   {"item": item, "file": file_id, "pos": position})
        db.session.commit()
        reject("INSERT INTO announcement_attachments VALUES (:item,:file,6)", {"item": item, "file": files[-1]})
        assert db.session.execute(text("SELECT COUNT(*) FROM announcement_attachments WHERE announcement_id=:id"),
                                  {"id": item}).scalar_one() == 5
        assert db.session.execute(text("SELECT content FROM stored_files WHERE id=:id"),
                                  {"id": files[0]}).scalar_one() == b"test"


def test_hourly_payroll_and_legacy_session_payroll_coexist(app, users):
    with app.app_context():
        staff_id = db.session.scalar(select(StaffProfile.id).where(StaffProfile.user_id == users["lecturer"]))
        insert = """INSERT INTO staff_payrolls
            (staff_id,payroll_month,session_count,rate_per_session,total_amount,status,
             calculation_basis,teaching_hours,hourly_rate)
            VALUES (:staff,:month,10,250000,:total,'DRAFT',:basis,:hours,:rate)"""
        db.session.execute(text(insert), {"staff": staff_id, "month": "2026-09-01", "total": 2500000,
                                          "basis": "SESSION", "hours": None, "rate": None})
        db.session.execute(text(insert), {"staff": staff_id, "month": "2026-10-01", "total": 2250000,
                                          "basis": "HOUR", "hours": Decimal("22.50"), "rate": 100000})
        db.session.commit()
        for total, hours, rate in [(1, Decimal("22.50"), 100000), (0, None, 100000), (0, 0, None)]:
            reject(insert, {"staff": staff_id, "month": "2026-11-01", "total": total,
                            "basis": "HOUR", "hours": hours, "rate": rate})
        assert db.session.execute(text("SELECT COUNT(*) FROM staff_payrolls WHERE staff_id=:id"),
                                  {"id": staff_id}).scalar_one() == 2


def test_forecast_probabilities_intervals_and_json_are_validated(app, users):
    with app.app_context():
        run = db.session.execute(text("""INSERT INTO ai_forecast_runs
            (model_name,model_version,source,scope,created_by)
            OUTPUT INSERTED.id VALUES ('test-model','v1','RULE','MONTH',:user)"""),
            {"user": users["manager"]}).scalar_one()
        db.session.commit()
        insert = """INSERT INTO ai_forecast_points
            (run_id,metric_code,period_start,period_end,predicted_value,lower_bound,upper_bound,confidence_percent,basis_json)
            VALUES (:run,'DROPOUT_PROBABILITY','2026-12-01','2026-12-31',:value,:lo,:hi,:confidence,:basis)"""
        good = {"run": run, "value": 60, "lo": 50, "hi": 70, "confidence": 80, "basis": '{"attendance": 0.7}'}
        for change in [{"value": 101, "hi": 110}, {"hi": 150}, {"lo": 61}, {"confidence": -1}, {"basis": "not-json"}]:
            reject(insert, good | change)
        db.session.execute(text(insert), good)
        db.session.commit()
        reject(insert, good)


def test_forecast_course_must_belong_to_selected_group(app, users):
    with app.app_context():
        group_ids = dict(db.session.execute(text("SELECT code,id FROM course_groups")).all())
        level = db.session.execute(text("""INSERT INTO levels(code,name,min_age,max_age,sort_order)
            OUTPUT INSERTED.id VALUES ('KID_1','Kid 1',6,8,1)""")).scalar_one()
        course = db.session.execute(text("""INSERT INTO courses
            (course_code,level_id,name,sessions_per_week,session_minutes,monthly_fee,group_id)
            OUTPUT INSERTED.id VALUES ('FORECAST',:level,'Forecast test',2,90,1000000,:group)"""),
            {"level": level, "group": group_ids["KID"]}).scalar_one()
        run = db.session.execute(text("""INSERT INTO ai_forecast_runs(model_name,model_version,source,scope)
            OUTPUT INSERTED.id VALUES ('test','1','RULE','COURSE')""")).scalar_one()
        db.session.commit()
        sql = """INSERT INTO ai_forecast_points
            (run_id,metric_code,period_start,period_end,course_group_id,course_id,predicted_value)
            VALUES (:run,'ENROLLMENT_COUNT','2026-12-01','2026-12-31',:group,:course,20)"""
        reject(sql, {"run": run, "course": course, "group": group_ids["TEEN"]})
        db.session.execute(text(sql), {"run": run, "course": course, "group": group_ids["KID"]})
        db.session.commit()
