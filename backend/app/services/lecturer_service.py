"""SQL backed adapters for the existing Lecturer and Manager workflow screens."""
import hashlib
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.common.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.extensions import db
from app.models import AuditAction, AuditLog, RoleCode
from app.services.authorization_service import require_class_access, require_session_access
from app.services import attendance_service, session_service

TZ = ZoneInfo("Asia/Ho_Chi_Minh")
SKILLS = ("listening_score", "reading_score", "speaking_score", "writing_score")


def rows(sql, **params):
    return db.session.execute(text(sql), params).mappings().all()


def one(sql, **params):
    return db.session.execute(text(sql), params).mappings().one_or_none()


def run(sql, **params):
    # pyodbc's generic datetime binding discards tzinfo. ISO strings retain the
    # offset when SQL Server converts them into DATETIMEOFFSET columns.
    params={key:value.isoformat() if isinstance(value,datetime) and value.tzinfo is not None else value
            for key,value in params.items()}
    # SQL Server requires OUTPUT INTO when a target has an enabled workflow trigger.
    if "OUTPUT INSERTED.id" in sql:
        sql = """SET NOCOUNT ON;
            BEGIN TRY
                DECLARE @ids TABLE(id BIGINT);
                """ + sql.replace("OUTPUT INSERTED.id", "OUTPUT INSERTED.id INTO @ids") + """;
                SET NOCOUNT OFF;
                SELECT id FROM @ids;
            END TRY
            BEGIN CATCH
                SET NOCOUNT OFF;
                THROW;
            END CATCH;"""
    return db.session.execute(text(sql), params)


def ident(value):
    try:
        result = int(value)
    except (ValueError, TypeError):
        raise AppError("Mã dữ liệu không hợp lệ", 422)
    if isinstance(value,bool) or result < 1 or isinstance(value,(float,Decimal)) and value != result:
        raise AppError("Mã dữ liệu không hợp lệ", 422)
    return result


def short(value):
    return value.isoformat() if value is not None else None


def local(value):
    if value is None:
        return ""
    return value.astimezone(TZ).strftime("%Y-%m-%dT%H:%M") if value.tzinfo else value.strftime("%Y-%m-%dT%H:%M")


def parse_dt(value):
    try:
        result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return result if result.tzinfo else result.replace(tzinfo=TZ)
    except (ValueError, TypeError):
        raise AppError("Thời gian không hợp lệ", 422)


def parse_date(value):
    try:
        return date.fromisoformat(str(value))
    except (ValueError, TypeError):
        raise AppError("Ngày không hợp lệ", 422)


def audit(actor, table, entity_id, data, action=AuditAction.UPDATE):
    db.session.add(AuditLog(actor_user_id=actor.id, action=action,
                            entity_name=table, entity_id=entity_id, new_data=data))


def scope(actor, class_id, *, edit=False):
    class_id = ident(class_id)
    try:
        require_class_access(actor, class_id)
    except ForbiddenError:
        substitute=not edit and actor.role.code==RoleCode.LECTURER and one("""SELECT TOP 1 ss.id FROM class_sessions ss
            JOIN staff_profiles sp ON sp.user_id=:actor WHERE ss.class_id=:cid AND sp.id=ss.lecturer_id""",actor=actor.id,cid=class_id)
        if not substitute: raise
    record = one("SELECT c.*, co.level_id FROM classes c JOIN courses co ON co.id=c.course_id WHERE c.id=:id", id=class_id)
    if edit and actor.role.code != RoleCode.MANAGER:
        staff = one("SELECT id FROM staff_profiles WHERE user_id=:id", id=actor.id)
        if actor.role.code != RoleCode.LECTURER or not staff or staff["id"] != record["lecturer_id"]:
            raise ForbiddenError("Chỉ giảng viên phụ trách được chỉnh sửa nội dung lớp")
    return record


def classes(actor):
    clause = "" if actor.role.code == RoleCode.MANAGER else """WHERE EXISTS (
        SELECT 1 FROM staff_profiles sp WHERE sp.user_id=:actor AND
        (sp.id IN (c.lecturer_id,c.assistant_id) OR EXISTS (
          SELECT 1 FROM class_sessions ss WHERE ss.class_id=c.id AND sp.id IN(ss.lecturer_id,ss.assistant_id))))"""
    result = []
    for c in rows(f"""SELECT c.*,co.name AS course_name,g.code AS group_code,r.name AS room,
        u.full_name AS teacher,au.full_name AS assistant,
        (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id=c.id AND ce.status='ACTIVE') AS size,
        (SELECT COUNT(*) FROM attendances a JOIN class_sessions cs ON cs.id=a.session_id WHERE cs.class_id=c.id) AS total_att,
        (SELECT COUNT(*) FROM attendances a JOIN class_sessions cs ON cs.id=a.session_id WHERE cs.class_id=c.id AND a.status='PRESENT') AS present_att,
        COALESCE((SELECT TOP 1 ss.session_date FROM class_sessions ss WHERE ss.class_id=c.id AND ss.status<>'CANCELLED'
                    AND ss.session_date>=:today ORDER BY ss.session_date,ss.start_time),
                 (SELECT TOP 1 ss.session_date FROM class_sessions ss WHERE ss.class_id=c.id AND ss.status<>'CANCELLED'
                    ORDER BY ss.session_date DESC,ss.start_time DESC)) AS next_session_date
        FROM classes c JOIN courses co ON co.id=c.course_id LEFT JOIN course_groups g ON g.id=co.group_id
        JOIN rooms r ON r.id=c.default_room_id JOIN staff_profiles sp ON sp.id=c.lecturer_id JOIN users u ON u.id=sp.user_id
        LEFT JOIN staff_profiles asp ON asp.id=c.assistant_id LEFT JOIN users au ON au.id=asp.user_id {clause} ORDER BY c.name""", actor=actor.id,today=datetime.now(TZ).date()):
        schedule = rows("SELECT * FROM class_schedules WHERE class_id=:id ORDER BY day_of_week,start_time", id=c["id"])
        times = f"{schedule[0]['start_time'].strftime('%H:%M')}-{schedule[0]['end_time'].strftime('%H:%M')}" if schedule else ""
        result.append({"id": str(c["id"]), "name": c["name"], "code": c["class_code"], "courseId": (c["group_code"] or "").lower(),
                       "sqlCourseId": c["course_id"], "course": c["course_name"], "teacher": c["teacher"], "lecturer": c["teacher"],
                       "assistant": c["assistant"] or "", "room": c["room"], "size": c["size"], "cap": c["max_students"],
                       "days": [s["day_of_week"]-1 for s in schedule], "time": times, "range": times,
                       "start": short(c["start_date"]), "end": short(c["end_date"]),"nextSessionDate":short(c['next_session_date']),
                       "status": {"PLANNED":"soon","ONGOING":"open","COMPLETED":"ended","CANCELLED":"ended"}[c["status"]],
                       "rate": round(c["present_att"]*100/c["total_att"], 1) if c["total_att"] else 0})
    return result


def roster(actor, class_id, on_date=None):
    scope(actor, class_id)
    condition = "ce.enrolled_date<=:on_date AND (ce.left_date IS NULL OR ce.left_date>=:on_date)" if on_date else "ce.status='ACTIVE'"
    result = rows(f"""SELECT st.*,g.phone,
        (SELECT COUNT(*) FROM attendances a JOIN class_sessions cs ON cs.id=a.session_id WHERE a.student_id=st.id AND cs.class_id=ce.class_id) AS total_att,
        (SELECT COUNT(*) FROM attendances a JOIN class_sessions cs ON cs.id=a.session_id WHERE a.student_id=st.id AND cs.class_id=ce.class_id AND a.status='PRESENT') AS present_att
        FROM class_enrollments ce JOIN students st ON st.id=ce.student_id JOIN guardians g ON g.id=st.guardian_id
        WHERE ce.class_id=:id AND {condition} ORDER BY st.student_code""", id=ident(class_id), on_date=on_date)
    return [{"id":str(s["id"]), "code":s["student_code"], "name":s["full_name"], "birth":s["date_of_birth"].strftime("%d/%m/%Y"),
             "phone":s["phone"] or "", "rate":round(s["present_att"]*100/s["total_att"],1) if s["total_att"] else 0} for s in result]


def sessions(actor, start, end=None):
    start = parse_date(start)
    end = parse_date(end) if end else start
    if end < start or (end-start).days > 62:
        raise AppError("Khoảng lịch không hợp lệ (tối đa 62 ngày)", 422)
    clause = "" if actor.role.code == RoleCode.MANAGER else "AND EXISTS(SELECT 1 FROM staff_profiles sp WHERE sp.user_id=:actor AND sp.id IN(s.lecturer_id,s.assistant_id,c.lecturer_id,c.assistant_id))"
    return [_session(s) for s in rows(f"""SELECT s.*,c.name,c.class_code,co.group_id,g.code AS group_code,r.name AS room,
        u.full_name AS teacher,au.full_name AS assistant,
        (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id=c.id AND ce.enrolled_date<=s.session_date AND (ce.left_date IS NULL OR ce.left_date>=s.session_date)) AS students,
        (SELECT COUNT(*) FROM attendances a WHERE a.session_id=s.id) AS marked,
        (SELECT COUNT(*) FROM attendances a WHERE a.session_id=s.id AND a.status='PRESENT') AS present
        FROM class_sessions s JOIN classes c ON c.id=s.class_id JOIN courses co ON co.id=c.course_id LEFT JOIN course_groups g ON g.id=co.group_id
        JOIN rooms r ON r.id=s.room_id JOIN staff_profiles sp ON sp.id=s.lecturer_id JOIN users u ON u.id=sp.user_id
        LEFT JOIN staff_profiles asp ON asp.id=s.assistant_id LEFT JOIN users au ON au.id=asp.user_id
        WHERE s.session_date BETWEEN :start AND :end {clause} ORDER BY s.session_date,s.start_time,c.name""", start=start,end=end,actor=actor.id)]


def _session(s):
    time = f"{s['start_time'].strftime('%H:%M')}-{s['end_time'].strftime('%H:%M')}"
    # Keep the established calendar sections while showing each session's actual time.
    hour = s["start_time"].hour
    slot = "07:00-09:00" if hour < 9 else "09:00-11:00" if hour < 12 else "13:00-15:00" if hour < 15 else "15:00-17:00" if hour < 17 else "17:00-19:00" if hour < 19 else "19:00-21:00"
    return {"id":str(s["id"]), "classId":str(s["class_id"]),"courseId":(s["group_code"] or "").lower(),"name":s["name"],"iso":short(s["session_date"]),
            "slot":slot,"time":time,"room":s["room"],"teacher":s["teacher"],"assistant":s["assistant"] or "", "students":s["students"],
            "status":"cancelled" if s["status"]=="CANCELLED" else "attended" if s["marked"] else "upcoming",
            "att":f"{s['present']}/{s['students']}","reason":s["note"] or ""}


def session(actor, session_id):
    require_session_access(actor, ident(session_id))
    s = one("SELECT session_date FROM class_sessions WHERE id=:id", id=ident(session_id))
    return next(s for s in sessions(actor,short(s["session_date"])) if s["id"]==str(session_id))


def attendance(actor, session_id):
    data = attendance_service.list_session_attendances(ident(session_id),actor=actor)
    saved = [r for r in data["items"] if r["attendance"]]
    if not saved:
        return None
    records = []
    for r in saved:
        a = r["attendance"]
        note = a["note"] or ""
        late = a["status"]=="PRESENT" and note.startswith("[Đi trễ] ")
        records.append({"studentId":str(r["student"]["id"]),"status":"late" if late else "present" if a["status"]=="PRESENT" else "absent",
                        "note":note[len("[Đi trễ] "):] if late else note})
    return {"classId":str(data["class_id"]),"date":short(data["session_date"]),"records":records,
            "savedAt":max(short(r["attendance"]["recorded_at"]) for r in saved)}


def save_attendance(actor, session_id, payload):
    session_id=ident(session_id)
    require_session_access(actor,session_id)
    s = one("SELECT * FROM class_sessions WITH(UPDLOCK,HOLDLOCK) WHERE id=:id",id=session_id)
    if s["status"]=="CANCELLED":
        raise ConflictError("Không thể điểm danh buổi đã hủy")
    if datetime.now(TZ).replace(tzinfo=None) < datetime.combine(s["session_date"],s["start_time"]):
        raise ConflictError("Không thể điểm danh trước khi buổi học bắt đầu")
    eligible = {r["id"] for r in roster(actor,s["class_id"],s["session_date"])}
    records=payload.get("records",[])
    if not isinstance(records,list) or any(not isinstance(r,dict) for r in records) or {str(r.get("studentId")) for r in records} != eligible or len(records)!=len(eligible):
        raise AppError("Cần điểm danh đầy đủ và đúng học viên của buổi học",422)
    validated=[]
    for item in records:
        if item.get("status") not in {"present","late","absent"}:
            raise AppError("Trạng thái điểm danh không hợp lệ",422)
        note=str(item.get("note") or "").strip()
        if item["status"]=="late": note="[Đi trễ] "+note
        if len(note)>255: raise AppError("Ghi chú điểm danh tối đa 255 ký tự (bao gồm nhãn đi trễ)",422)
        validated.append((ident(item["studentId"]),"PRESENT" if item["status"] in {"present","late"} else "UNEXCUSED_ABSENCE",note))
    for student_id,status,note in validated:
        old=one("SELECT * FROM attendances WITH(UPDLOCK,HOLDLOCK) WHERE session_id=:session AND student_id=:student",session=session_id,student=student_id)
        if old:
            # Preserve excused-absence billing semantics when the existing three-way
            # UI simply edits the note of an already excused absence.
            if old['status']=='EXCUSED_ABSENCE' and status=='UNEXCUSED_ABSENCE': status='EXCUSED_ABSENCE'
            if old["status"]==status and (old["note"] or "")==note: continue
            hid=run("""INSERT INTO attendance_histories(attendance_id,old_status,new_status,old_note,new_note,changed_by,changed_at,reason)
                OUTPUT INSERTED.id VALUES(:id,:old,:new,:oldnote,:note,:actor,SYSDATETIMEOFFSET(),N'Cập nhật từ màn hình điểm danh')""",
                id=old["id"],old=old["status"],new=status,oldnote=old["note"],note=note,actor=actor.id).scalar_one()
            if old["status"]!=status:
                run("""INSERT INTO tuition_recalculation_requests(attendance_history_id,attendance_id,session_id,student_id,requested_by,requested_at,status)
                    VALUES(:history,:attendance,:session,:student,:actor,SYSDATETIMEOFFSET(),'PENDING')""",history=hid,attendance=old["id"],session=session_id,student=student_id,actor=actor.id)
            run("UPDATE attendances SET status=:status,note=:note WHERE id=:id",status=status,note=note,id=old["id"])
            audit(actor,"attendances",old["id"],{"status":status,"note":note})
        else:
            if s["status"]=="COMPLETED": raise ConflictError("Buổi đã hoàn thành; chỉ được sửa bản ghi đã có")
            aid=run("""INSERT INTO attendances(session_id,student_id,status,note,recorded_by,recorded_at) OUTPUT INSERTED.id
                VALUES(:session,:student,:status,:note,:actor,SYSDATETIMEOFFSET())""",session=session_id,student=student_id,status=status,note=note,actor=actor.id).scalar_one()
            audit(actor,"attendances",aid,{"session_id":session_id,"student_id":student_id,"status":status},AuditAction.CREATE)
    db.session.commit()
    return attendance(actor,session_id)


def assessment(actor,class_id,test,create=False):
    c=scope(actor,class_id,edit=create)
    if not isinstance(test,str) or not test.strip() or len(test)>150: raise AppError("Tên bài kiểm tra không hợp lệ",422)
    a=one("""SELECT TOP 1 a.*,w.review_state,w.period_id,w.confirmed_at,w.version FROM assessments a WITH(UPDLOCK,HOLDLOCK)
        LEFT JOIN assessment_workflows w ON w.assessment_id=a.id WHERE a.class_id=:id AND a.title=:test ORDER BY a.id DESC""",id=c["id"],test=test)
    if a and a["review_state"] is None and create:
        run("INSERT INTO assessment_workflows(assessment_id,class_id,course_id,display_label) VALUES(:aid,:cid,:co,:test)",aid=a["id"],cid=c["id"],co=c["course_id"],test=test)
        return assessment(actor,class_id,test)
    if a or not create: return a
    p=one("SELECT TOP 1 * FROM assessment_grading_periods WHERE course_id=:id ORDER BY opens_at DESC,id DESC",id=c["course_id"])
    aid=run("""INSERT INTO assessments(class_id,level_id,assessment_type,title,test_date,score_min,score_max,status,created_by)
        OUTPUT INSERTED.id VALUES(:cid,:level,:type,:test,:date,0,9,'DRAFT',:actor)""",cid=c["id"],level=c["level_id"],type="END_OF_LEVEL" if "cuối" in test.lower() else "MONTHLY",test=test,date=datetime.now(TZ).date(),actor=actor.id).scalar_one()
    run("INSERT INTO assessment_workflows(assessment_id,class_id,course_id,period_id,display_label) VALUES(:aid,:cid,:co,:pid,:test)",aid=aid,cid=c["id"],co=c["course_id"],pid=p["id"] if p else None,test=test)
    return assessment(actor,class_id,test)


def grades(actor,class_id,test):
    a=assessment(actor,class_id,test)
    students=roster(actor,class_id,a["test_date"] if a else None)
    scores={str(s["student_id"]):s for s in rows("SELECT * FROM assessment_skill_results WHERE assessment_id=:id",id=a["id"])} if a else {}
    return {"assessmentId":str(a["id"]) if a else None,"test":test,"status":"published" if a and a["status"]=="PUBLISHED" else "pending" if a and a["review_state"] in {"PENDING","CONFIRMED"} else "draft",
            "rows":[{"studentId":s["id"],"name":s["name"],"code":s["code"],"scores":[float(scores[s["id"]][k]) if s["id"] in scores and scores[s["id"]][k] is not None else "" for k in SKILLS],"note":(scores[s["id"]]["note"] or "") if s["id"] in scores else ""} for s in students],
            "updatedAt":short(a["updated_at"]) if a else None,"confirmedAt":short(a["confirmed_at"]) if a else None,"publishedAt":short(a["published_at"]) if a else None,
            "version":bytes(a["version"]).hex() if a and a["version"] else None}


def validate_scores(items,eligible,complete=False):
    if not isinstance(items,list) or len(items)>1000 or any(not isinstance(item,dict) for item in items): raise AppError("Danh sách điểm không hợp lệ",422)
    seen=set(); result=[]
    for row in items:
        sid=str(row.get("studentId"))
        if sid not in eligible or sid in seen: raise AppError("Học viên không thuộc lớp hoặc bị lặp",422)
        seen.add(sid); values=row.get("scores")
        if not isinstance(values,list) or len(values)!=4: raise AppError("Mỗi học viên cần bốn kỹ năng",422)
        parsed=[]
        for value in values:
            if value is None or value=="":
                if complete: raise AppError("Cần nhập đủ bốn kỹ năng trước khi xác nhận",422)
                parsed.append(None); continue
            try: number=Decimal(str(value))
            except (InvalidOperation,ValueError): raise AppError("Điểm không hợp lệ",422)
            if not number.is_finite() or number<0 or number>9 or number*2 != (number*2).to_integral_value(): raise AppError("Điểm phải từ 0 đến 9, bước 0.5",422)
            parsed.append(number)
        note=str(row.get("note") or "")
        if len(note)>500: raise AppError("Ghi chú tối đa 500 ký tự",422)
        result.append((ident(sid),parsed,note))
    if complete and seen!=eligible: raise AppError("Cần nhập điểm cho đầy đủ học viên",422)
    return result


def save_grades(actor,class_id,test,payload,*,commit=True):
    a=assessment(actor,class_id,test,True)
    if a["status"]=="PUBLISHED": raise ConflictError("Bảng điểm đã công bố, không thể ghi đè")
    if a["review_state"]=="CONFIRMED": raise ConflictError("Bảng điểm đã xác nhận; Manager cần mở lại trước khi sửa")
    if payload.get("version") and payload["version"] != bytes(a["version"]).hex(): raise ConflictError("Bảng điểm đã thay đổi; hãy tải lại trước khi lưu")
    status=payload.get("status","draft")
    if status not in {"draft","pending","published"}: raise AppError("Trạng thái bảng điểm không hợp lệ",422)
    p=one("SELECT * FROM assessment_grading_periods WHERE id=:id",id=a["period_id"]) if a["period_id"] else None
    now=datetime.now(TZ)
    if actor.role.code!=RoleCode.MANAGER and p and (now<p["opens_at"] or (p["auto_lock"] and now>p["closes_at"])): raise ConflictError("Ngoài thời gian nhập điểm do Manager thiết lập")
    eligible={s["id"] for s in roster(actor,class_id,a["test_date"])}
    validated=validate_scores(payload.get("rows"),eligible,status!="draft")
    for sid,values,note in validated:
        params=dict(zip(SKILLS,values)); params.update(aid=a["id"],sid=sid,cid=ident(class_id),note=note,actor=actor.id)
        run("""UPDATE assessment_skill_results SET listening_score=:listening_score,reading_score=:reading_score,speaking_score=:speaking_score,writing_score=:writing_score,note=:note,recorded_by=:actor,updated_at=SYSDATETIMEOFFSET() WHERE assessment_id=:aid AND student_id=:sid;
          IF @@ROWCOUNT=0 INSERT INTO assessment_skill_results(assessment_id,student_id,class_id,listening_score,reading_score,speaking_score,writing_score,note,recorded_by)
          VALUES(:aid,:sid,:cid,:listening_score,:reading_score,:speaking_score,:writing_score,:note,:actor)""",**params)
        if all(v is not None for v in values):
            score=sum(values)/4
            old=one("SELECT * FROM assessment_results WHERE assessment_id=:aid AND student_id=:sid",aid=a["id"],sid=sid)
            if old and (old["score"]!=score or (old["comment"] or "")!=note):
                run("""INSERT INTO assessment_result_histories(result_id,old_score,new_score,old_comment,new_comment,changed_by,reason)
                    VALUES(:id,:old,:new,:oldnote,:note,:actor,N'Cập nhật điểm bốn kỹ năng')""",id=old["id"],old=old["score"],new=score,oldnote=old["comment"],note=note,actor=actor.id)
            run("""UPDATE assessment_results SET score=:score,comment=:note,recorded_by=:actor,updated_at=SYSDATETIMEOFFSET() WHERE assessment_id=:aid AND student_id=:sid;
              IF @@ROWCOUNT=0 INSERT INTO assessment_results(assessment_id,student_id,score,comment,recorded_by) VALUES(:aid,:sid,:score,:note,:actor)""",aid=a["id"],sid=sid,score=score,note=note,actor=actor.id)
    confirm=status=="published"
    run("""UPDATE assessment_workflows SET review_state=:state,confirmed_by=:actor,confirmed_at=:at,updated_at=SYSDATETIMEOFFSET() WHERE assessment_id=:id""",state="CONFIRMED" if confirm else "PENDING" if status=="pending" else "DRAFT",actor=actor.id if confirm else None,at=now if confirm else None,id=a["id"])
    publish=confirm and (not p or p["release_mode"]=="ON_CONFIRMATION" or now>=p["publishes_at"])
    run("UPDATE assessments SET updated_at=SYSDATETIMEOFFSET(),status=:state,published_by=:actor,published_at=:at WHERE id=:id",state="PUBLISHED" if publish else "DRAFT",actor=actor.id if publish else None,at=now if publish else None,id=a["id"])
    audit(actor,"assessments",a["id"],{"class_id":ident(class_id),"status":status,"skill_rows":len(validated)})
    if commit: db.session.commit()
    return grades(actor,class_id,test)


def comments(actor,class_id):
    scope(actor,class_id)
    return [{"id":str(c["id"]),"classId":str(c["class_id"]),"studentId":str(c["student_id"]),"studentName":c["full_name"],"text":c["content"],"date":short(c["created_at"])} for c in rows("SELECT c.*,s.full_name FROM student_comments c JOIN students s ON s.id=c.student_id WHERE c.class_id=:id ORDER BY c.created_at DESC,c.id DESC",id=ident(class_id))]


def add_comment(actor,payload):
    cid=ident(payload.get("classId")); sid=ident(payload.get("studentId")); scope(actor,cid,edit=True)
    content=str(payload.get("text") or "").strip()
    if not content or len(content)>2000: raise AppError("Nhận xét cần từ 1 đến 2000 ký tự",422)
    if not one("SELECT id FROM class_enrollments WHERE class_id=:cid AND student_id=:sid",cid=cid,sid=sid): raise AppError("Học viên không thuộc lớp",422)
    new_id=run("INSERT INTO student_comments(class_id,student_id,author_user_id,content) OUTPUT INSERTED.id VALUES(:cid,:sid,:actor,:content)",cid=cid,sid=sid,actor=actor.id,content=content).scalar_one()
    audit(actor,"student_comments",new_id,{"class_id":cid,"student_id":sid},AuditAction.CREATE); db.session.commit()
    return next(c for c in comments(actor,cid) if c["id"]==str(new_id))


def documents(actor):
    accessible={c["id"] for c in classes(actor)}
    result=[]
    for d in rows("""SELECT d.*,f.byte_size FROM teaching_documents d JOIN stored_files f ON f.id=d.file_id WHERE d.deleted_at IS NULL ORDER BY d.created_at DESC,d.id DESC"""):
        class_ids=[str(c["class_id"]) for c in rows("SELECT class_id FROM teaching_document_classes WHERE document_id=:id",id=d["id"])]
        if d["uploaded_by"]!=actor.id and actor.role.code!=RoleCode.MANAGER and not accessible.intersection(class_ids): continue
        events=rows("SELECT action,detail,created_at FROM teaching_document_events WHERE document_id=:id ORDER BY created_at,id",id=d["id"])
        result.append({"id":str(d["id"]),"name":d["display_name"],"classIds":class_ids,"size":f"{d['byte_size']/1024/1024:.2f} MB","date":d["created_at"].astimezone(TZ).date().isoformat(),
                       "downloads":sum(e["action"]=="DOWNLOAD" for e in events),"events":[f"{e['detail'] or e['action']}: {local(e['created_at']).replace('T',' ')}" for e in events]})
    return result


def document_context(actor,document_id,edit=False):
    d=one("SELECT * FROM teaching_documents WHERE id=:id AND deleted_at IS NULL",id=ident(document_id))
    if not d: raise NotFoundError("Tài liệu không tồn tại hoặc đã được xóa")
    if edit and actor.role.code!=RoleCode.MANAGER and d["uploaded_by"]!=actor.id: raise ForbiddenError("Chỉ người tải tài liệu được thay đổi tài liệu")
    if not any(item["id"]==str(document_id) for item in documents(actor)): raise ForbiddenError("Không có quyền truy cập tài liệu")
    return d


def event(actor,did,action,detail):
    run("INSERT INTO teaching_document_events(document_id,actor_user_id,action,detail) VALUES(:id,:actor,:action,:detail)",id=did,actor=actor.id,action=action,detail=detail)


def upload_document(actor,file,payload):
    if file is None: raise AppError("Chọn tài liệu để tải lên",422)
    extension=file.filename.rsplit(".",1)[-1].lower()
    if extension not in {"pdf","docx","pptx","mp3"}: raise AppError("Định dạng tài liệu không được hỗ trợ",422)
    content=file.stream.read(20971521)
    if not 1<=len(content)<=20971520: raise AppError("Tài liệu cần từ 1 byte đến 20 MB",422)
    name=str(payload.get("name") or file.filename).strip()
    if not name or len(name)>255: raise AppError("Tên tài liệu không hợp lệ",422)
    cids=payload.get("classIds",[])
    if not isinstance(cids,list) or not cids: raise AppError("Chọn ít nhất một lớp",422)
    for cid in cids: scope(actor,cid,edit=True)
    fid=run("INSERT INTO stored_files(filename,mime_type,byte_size,content,sha256,uploaded_by) OUTPUT INSERTED.id VALUES(:name,:mime,:size,:content,:hash,:actor)",name=file.filename,mime=file.mimetype or "application/octet-stream",size=len(content),content=content,hash=hashlib.sha256(content).hexdigest(),actor=actor.id).scalar_one()
    did=run("INSERT INTO teaching_documents(file_id,display_name,file_extension,uploaded_by) OUTPUT INSERTED.id VALUES(:fid,:name,:ext,:actor)",fid=fid,name=name,ext=extension,actor=actor.id).scalar_one()
    for cid in set(map(ident,cids)): run("INSERT INTO teaching_document_classes(document_id,class_id,shared_by) VALUES(:id,:cid,:actor)",id=did,cid=cid,actor=actor.id)
    event(actor,did,"UPLOAD","Tải lên tài liệu"); db.session.commit()
    return next(d for d in documents(actor) if d["id"]==str(did))


def update_document(actor,did,payload):
    d=document_context(actor,did,True); did=d["id"]
    name=str(payload.get("name") or d["display_name"]).strip()
    if not name or len(name)>255 or not name.lower().endswith("."+d["file_extension"]): raise AppError("Tên tài liệu hoặc phần mở rộng không hợp lệ",422)
    cids=payload.get("classIds")
    if cids is not None:
        if not isinstance(cids,list) or not cids: raise AppError("Chọn ít nhất một lớp",422)
        for cid in cids: scope(actor,cid,edit=True)
        old={r["class_id"] for r in rows("SELECT class_id FROM teaching_document_classes WHERE document_id=:id",id=did)}
        new=set(map(ident,cids))
        for cid in old-new: run("DELETE FROM teaching_document_classes WHERE document_id=:id AND class_id=:cid",id=did,cid=cid)
        for cid in new-old: run("INSERT INTO teaching_document_classes(document_id,class_id,shared_by) VALUES(:id,:cid,:actor)",id=did,cid=cid,actor=actor.id)
        if old!=new: event(actor,did,"SHARE","Cập nhật lớp được chia sẻ")
    if name!=d["display_name"]: event(actor,did,"RENAME",f"Đổi tên: {name}")
    run("UPDATE teaching_documents SET display_name=:name,updated_at=SYSDATETIMEOFFSET() WHERE id=:id",id=did,name=name)
    db.session.commit(); return next(d for d in documents(actor) if d["id"]==str(did))


def delete_document(actor,did):
    d=document_context(actor,did,True)
    run("UPDATE teaching_documents SET deleted_by=:actor,deleted_at=SYSDATETIMEOFFSET() WHERE id=:id",id=d["id"],actor=actor.id)
    event(actor,d["id"],"DELETE","Gỡ tài liệu khỏi lớp"); db.session.commit()


def download_document(actor,did):
    d=document_context(actor,did)
    f=one("SELECT * FROM stored_files WHERE id=:id",id=d["file_id"])
    event(actor,d["id"],"DOWNLOAD","Tải xuống tài liệu"); db.session.commit()
    return bytes(f["content"]),d["display_name"],f["mime_type"]


def release_due():
    """Apply confirmed scheduled releases when their persisted deadline is reached."""
    if not one("""SELECT TOP 1 a.id FROM assessments a JOIN assessment_workflows w ON w.assessment_id=a.id
        JOIN assessment_grading_periods p ON p.id=w.period_id WHERE a.status='DRAFT'
        AND w.review_state='CONFIRMED' AND p.release_mode='SCHEDULED' AND p.publishes_at<=SYSDATETIMEOFFSET()"""):
        return 0
    result=run("""UPDATE a SET status='PUBLISHED',published_by=w.confirmed_by,
        published_at=p.publishes_at,updated_at=SYSDATETIMEOFFSET()
        FROM assessments a JOIN assessment_workflows w ON w.assessment_id=a.id
        JOIN assessment_grading_periods p ON p.id=w.period_id
        WHERE a.status='DRAFT' AND w.review_state='CONFIRMED' AND p.release_mode='SCHEDULED'
          AND p.publishes_at<=SYSDATETIMEOFFSET()""")
    if result.rowcount: db.session.commit()
    return result.rowcount


def process_deadlines():
    """Process persisted releases/reminders; also callable by a scheduled CLI job."""
    published=release_due()
    due=rows("""SELECT p.id,p.term_name,p.closes_at,c.id AS class_id,c.name,sp.user_id
        FROM assessment_grading_periods p JOIN classes c ON c.course_id=p.course_id
        JOIN staff_profiles sp ON sp.id=c.lecturer_id
        WHERE p.remind_before_deadline=1 AND p.opens_at<=SYSDATETIMEOFFSET()
          AND p.closes_at>SYSDATETIMEOFFSET() AND p.closes_at<=DATEADD(day,1,SYSDATETIMEOFFSET())
          AND c.status IN('PLANNED','ONGOING') AND NOT EXISTS(
            SELECT 1 FROM assessment_workflows w JOIN assessments a ON a.id=w.assessment_id
            WHERE w.class_id=c.id AND w.period_id=p.id AND w.review_state='CONFIRMED')""")
    count=0
    for item in due:
        title=f"Nhắc nhập điểm: {item['name']} · {item['term_name']}"[:200]
        content=f"Vui lòng hoàn tất bảng điểm lớp {item['name']} trước {local(item['closes_at']).replace('T',' ')}."
        if not one("SELECT TOP 1 id FROM notifications WITH(UPDLOCK,HOLDLOCK) WHERE recipient_user_id=:user AND title=:title AND content=:content",user=item['user_id'],title=title,content=content):
            run("INSERT INTO notifications(recipient_user_id,notification_type,title,content) VALUES(:user,'GENERAL',:title,:content)",user=item['user_id'],title=title,content=content)
            count+=1
    if count: db.session.commit()
    return {'published':published,'reminders':count}


def grading_window(actor,class_id):
    c=scope(actor,class_id)
    p=one("SELECT TOP 1 * FROM assessment_grading_periods WHERE course_id=:id ORDER BY opens_at DESC,id DESC",id=c["course_id"])
    if not p: raise NotFoundError("Manager chưa thiết lập thời gian nhập điểm cho khóa học")
    return {"id":str(p["id"]),"opensAt":local(p["opens_at"]),"closesAt":local(p["closes_at"]),"test":p["term_name"]}


def assistant_candidates(actor):
    return [{"id":str(s["id"]),"name":s["full_name"],"email":s["email"] or ""} for s in rows("""SELECT sp.id,u.full_name,u.email FROM staff_profiles sp JOIN users u ON u.id=sp.user_id
        WHERE sp.position='TEACHING_ASSISTANT' AND sp.status='ACTIVE' AND u.status='ACTIVE' ORDER BY u.full_name""")]


def assistants(actor):
    owned={c["id"] for c in classes(actor)}
    result=[]
    # Existing class assignments are read without writing migration/seed rows.
    assignments=rows("""SELECT ca.id AS assignment_id,ca.class_id,ca.assistant_id,ca.can_attend,ca.can_view_roster,ca.can_upload_documents,u.full_name,u.email
        FROM class_assistant_assignments ca JOIN staff_profiles sp ON sp.id=ca.assistant_id JOIN users u ON u.id=sp.user_id WHERE ca.revoked_at IS NULL
        UNION ALL SELECT NULL,c.id,c.assistant_id,1,1,0,u.full_name,u.email FROM classes c
        JOIN staff_profiles sp ON sp.id=c.assistant_id JOIN users u ON u.id=sp.user_id
        WHERE NOT EXISTS(SELECT 1 FROM class_assistant_assignments ca WHERE ca.class_id=c.id AND ca.assistant_id=c.assistant_id)""")
    for a in assignments:
        if str(a["class_id"]) not in owned: continue
        aid=a["assignment_id"]
        grant=one("""SELECT TOP 1 * FROM assistant_grading_grants WHERE assignment_id=:id AND revoked_at IS NULL ORDER BY granted_at DESC,id DESC""",id=aid) if aid else None
        request=one("SELECT TOP 1 * FROM assistant_grading_requests WHERE assignment_id=:id AND status='PENDING' ORDER BY id DESC",id=aid) if aid else None
        submission=one("""SELECT TOP 1 s.*,a.title FROM assistant_grade_submissions s JOIN assessments a ON a.id=s.assessment_id WHERE s.assignment_id=:id AND s.status='PENDING' ORDER BY s.id DESC""",id=aid) if aid else None
        returned=one("SELECT TOP 1 return_reason,status FROM assistant_grade_submissions WHERE assignment_id=:id ORDER BY id DESC",id=aid) if aid else None
        now=datetime.now(TZ)
        result.append({"id":str(a["assistant_id"]),"assignmentId":str(aid) if aid else None,"classId":str(a["class_id"]),"name":a["full_name"],"email":a["email"] or "",
          "permissions":[key for key,col in (("attendance","can_attend"),("roster","can_view_roster"),("documents","can_upload_documents")) if a[col]],
          "open":bool(grant and grant["opens_at"]<=now<=grant["closes_at"]),"start":local(grant["opens_at"]) if grant else "","end":local(grant["closes_at"]) if grant else "",
          "request":bool(request),"requestId":str(request["id"]) if request else None,"requestNote":request["request_note"] if request else "",
          "pending":bool(submission),"submissionId":str(submission["id"]) if submission else None,"submissionTest":submission["title"] if submission else "",
          "returned":bool(returned and returned["status"]=="RETURNED"),"returnReason":returned["return_reason"] if returned else ""})
    return result


def save_assistant(actor,payload):
    cid=ident(payload.get("classId")); sid=ident(payload.get("id")); scope(actor,cid,edit=True)
    if not one("SELECT id FROM staff_profiles WHERE id=:id AND position='TEACHING_ASSISTANT' AND status='ACTIVE'",id=sid): raise AppError("Trợ giảng không hợp lệ",422)
    permissions=payload.get("permissions",[])
    if not isinstance(permissions,list) or set(permissions)-{"attendance","roster","documents"}: raise AppError("Quyền trợ giảng không hợp lệ",422)
    a=one("SELECT * FROM class_assistant_assignments WITH(UPDLOCK,HOLDLOCK) WHERE class_id=:cid AND assistant_id=:sid",cid=cid,sid=sid)
    if not a:
        aid=run("""INSERT INTO class_assistant_assignments(class_id,assistant_id,can_attend,can_view_roster,can_upload_documents,assigned_by)
            OUTPUT INSERTED.id VALUES(:cid,:sid,:att,:roster,:doc,:actor)""",cid=cid,sid=sid,att="attendance" in permissions,roster="roster" in permissions,doc="documents" in permissions,actor=actor.id).scalar_one()
    else:
        aid=a["id"]
        run("""UPDATE class_assistant_assignments SET can_attend=:att,can_view_roster=:roster,can_upload_documents=:doc,revoked_by=NULL,revoked_at=NULL WHERE id=:id""",id=aid,att="attendance" in permissions,roster="roster" in permissions,doc="documents" in permissions)
    pending=one("SELECT TOP 1 * FROM assistant_grading_requests WHERE assignment_id=:id AND status='PENDING' ORDER BY id DESC",id=aid)
    if payload.get("open"):
        start=parse_dt(payload.get("start")); end=parse_dt(payload.get("end"))
        c=scope(actor,cid,edit=True)
        p=one("SELECT TOP 1 * FROM assessment_grading_periods WHERE course_id=:id ORDER BY opens_at DESC,id DESC",id=c["course_id"])
        if not p or start>=end or start<p["opens_at"] or end>p["closes_at"]: raise AppError("Thời gian phải nằm trong kỳ nhập điểm Manager đã thiết lập",422)
        if pending:
            assessment_id=pending["assessment_id"]
            run("UPDATE assistant_grading_requests SET status='APPROVED',reviewed_by=:actor,reviewed_at=SYSDATETIMEOFFSET() WHERE id=:id",id=pending["id"],actor=actor.id)
        else:
            test="Kiểm tra cuối kỳ" if "cuối" in p["term_name"].lower() else "Kiểm tra giữa kỳ"
            assessment_id=assessment(actor,cid,test,True)["id"]
        run("UPDATE assistant_grading_grants SET revoked_by=:actor,revoked_at=SYSDATETIMEOFFSET() WHERE assignment_id=:id AND assessment_id=:assessment AND revoked_at IS NULL",id=aid,assessment=assessment_id,actor=actor.id)
        run("""INSERT INTO assistant_grading_grants(assignment_id,class_id,assessment_id,request_id,opens_at,closes_at,granted_by)
            VALUES(:aid,:cid,:assessment,:request,:start,:end,:actor)""",aid=aid,cid=cid,assessment=assessment_id,request=pending["id"] if pending else None,start=start,end=end,actor=actor.id)
    else:
        run("UPDATE assistant_grading_grants SET revoked_by=:actor,revoked_at=SYSDATETIMEOFFSET() WHERE assignment_id=:id AND revoked_at IS NULL",id=aid,actor=actor.id)
        if pending and payload.get("request") is False:
            run("UPDATE assistant_grading_requests SET status='REJECTED',reviewed_by=:actor,reviewed_at=SYSDATETIMEOFFSET() WHERE id=:id",id=pending["id"],actor=actor.id)
    audit(actor,"class_assistant_assignments",aid,{"class_id":cid,"assistant_id":sid,"permissions":permissions,"open":bool(payload.get("open"))})
    db.session.commit(); return assistants(actor)


def assistant_submission(actor,sid,cid):
    scope(actor,cid,edit=True)
    s=one("""SELECT TOP 1 s.*,a.title FROM assistant_grade_submissions s JOIN class_assistant_assignments ca ON ca.id=s.assignment_id
        JOIN assessments a ON a.id=s.assessment_id WHERE ca.assistant_id=:sid AND ca.class_id=:cid AND s.status='PENDING' ORDER BY s.id DESC""",sid=ident(sid),cid=ident(cid))
    if not s: raise NotFoundError("Không có bảng điểm trợ giảng chờ duyệt")
    return {"id":str(s["id"]),"test":s["title"],"rows":[{"studentId":str(r["student_id"]),"scores":[float(r[k]) for k in SKILLS],"note":r["note"] or ""} for r in rows("SELECT * FROM assistant_grade_submission_rows WHERE submission_id=:id ORDER BY student_id",id=s["id"])]}


def review_submission(actor,sid,cid,payload):
    submission=assistant_submission(actor,sid,cid)
    approve=payload.get("approve")
    if not isinstance(approve,bool): raise AppError("Kết quả duyệt không hợp lệ",422)
    reason=str(payload.get("reason") or "").strip()
    if not approve and (not reason or len(reason)>500): raise AppError("Lý do trả lại cần từ 1 đến 500 ký tự",422)
    if approve:
        # Approved values always come from the stored submission, never from caller edits.
        save_grades(actor,cid,submission["test"],{"status":"pending","rows":submission["rows"]},commit=False)
    changed=run("""UPDATE assistant_grade_submissions SET status=:state,reviewed_by=:actor,reviewed_at=SYSDATETIMEOFFSET(),return_reason=:reason
        WHERE id=:id AND status='PENDING'""",id=ident(submission["id"]),state="APPROVED" if approve else "RETURNED",actor=actor.id,reason=None if approve else reason)
    if changed.rowcount!=1: raise ConflictError("Yêu cầu đã được xử lý")
    audit(actor,"assistant_grade_submissions",ident(submission["id"]),{"status":"APPROVED" if approve else "RETURNED"})
    db.session.commit(); return assistants(actor)


def require_assignment(actor,cid,sid):
    a=one("""SELECT ca.* FROM class_assistant_assignments ca JOIN staff_profiles sp ON sp.id=ca.assistant_id
        WHERE ca.class_id=:cid AND ca.assistant_id=:sid AND sp.user_id=:actor AND ca.revoked_at IS NULL""",cid=ident(cid),sid=ident(sid),actor=actor.id)
    if not a: raise ForbiddenError("Không được phân công trợ giảng cho lớp")
    return a


def request_grading(actor,cid,sid,payload):
    a=require_assignment(actor,cid,sid)
    # A request targets an assessment already created by the class lecturer/Manager.
    target=one("SELECT a.id FROM assessments a JOIN assessment_workflows w ON w.assessment_id=a.id WHERE a.id=:id AND a.class_id=:cid AND a.status='DRAFT'",id=ident(payload.get("assessmentId")),cid=ident(cid))
    if not target: raise AppError("Bài kiểm tra không thuộc lớp hoặc đã công bố",422)
    if one("SELECT id FROM assistant_grading_requests WHERE assignment_id=:id AND assessment_id=:assessment AND status='PENDING'",id=a["id"],assessment=target["id"]): raise ConflictError("Đã có yêu cầu đang chờ duyệt")
    note=str(payload.get("note") or "").strip()
    if len(note)>500: raise AppError("Lý do tối đa 500 ký tự",422)
    rid=run("INSERT INTO assistant_grading_requests(assignment_id,class_id,assessment_id,requested_by,request_note) OUTPUT INSERTED.id VALUES(:assignment,:cid,:assessment,:actor,:note)",assignment=a["id"],cid=ident(cid),assessment=target["id"],actor=actor.id,note=note).scalar_one()
    db.session.commit(); return {"id":str(rid),"status":"PENDING"}


def submit_assistant_grades(actor,cid,sid,payload):
    a=require_assignment(actor,cid,sid)
    grant=one("SELECT * FROM assistant_grading_grants WHERE id=:id AND assignment_id=:aid AND revoked_at IS NULL",id=ident(payload.get("grantId")),aid=a["id"])
    now=datetime.now(TZ)
    if not grant or not grant["opens_at"]<=now<=grant["closes_at"]: raise ForbiddenError("Quyền nhập điểm chưa mở hoặc đã hết hạn")
    assessment_row=one("SELECT * FROM assessments WHERE id=:id",id=grant["assessment_id"])
    if assessment_row["status"]=="PUBLISHED": raise ConflictError("Bảng điểm đã công bố")
    eligible={str(r["student_id"]) for r in rows("SELECT student_id FROM class_enrollments WHERE class_id=:cid AND enrolled_date<=:date AND (left_date IS NULL OR left_date>=:date)",cid=ident(cid),date=assessment_row["test_date"])}
    validated=validate_scores(payload.get("rows"),eligible,True)
    if one("SELECT id FROM assistant_grade_submissions WHERE grant_id=:id AND status='PENDING'",id=grant["id"]): raise ConflictError("Đã có bảng điểm đang chờ duyệt")
    submission_id=run("""INSERT INTO assistant_grade_submissions(grant_id,assignment_id,class_id,assessment_id,submitted_by) OUTPUT INSERTED.id
        VALUES(:grant,:assignment,:cid,:assessment,:actor)""",grant=grant["id"],assignment=a["id"],cid=ident(cid),assessment=grant["assessment_id"],actor=actor.id).scalar_one()
    for student,values,note in validated:
        params=dict(zip(SKILLS,values)); params.update(id=submission_id,sid=student,cid=ident(cid),aid=grant["assessment_id"],note=note)
        run("""INSERT INTO assistant_grade_submission_rows(submission_id,student_id,class_id,assessment_id,listening_score,reading_score,speaking_score,writing_score,note)
            VALUES(:id,:sid,:cid,:aid,:listening_score,:reading_score,:speaking_score,:writing_score,:note)""",**params)
    db.session.commit(); return {"id":str(submission_id),"status":"PENDING"}


def grade_windows(actor):
    process_deadlines()
    all_classes=classes(actor)
    result=[]
    for group in rows("SELECT * FROM course_groups ORDER BY id"):
        group_classes=[c for c in all_classes if c["courseId"]==group["code"].lower()]
        p=one("""SELECT TOP 1 p.* FROM assessment_grading_periods p JOIN courses co ON co.id=p.course_id
            WHERE co.group_id=:id ORDER BY p.updated_at DESC,p.id DESC""",id=group["id"])
        progress=[]
        for c in group_classes:
            a=one("""SELECT TOP 1 a.*,w.review_state,w.confirmed_at FROM assessments a LEFT JOIN assessment_workflows w ON w.assessment_id=a.id
                WHERE a.class_id=:id ORDER BY a.updated_at DESC,a.id DESC""",id=ident(c["id"]))
            average=one("SELECT AVG(score) AS value FROM assessment_results WHERE assessment_id=:id",id=a["id"]) if a else None
            progress.append({"id":c["id"],"name":c["name"],"teacher":c["teacher"],"students":c["size"],"test":a['title'] if a else 'Kiểm tra giữa kỳ',"state":"published" if a and a["status"]=="PUBLISHED" else "pending" if a else "empty", "at":local(a["confirmed_at"]) if a and a["confirmed_at"] else "—","avg":f"{average['value']:.1f}" if average and average["value"] is not None else "—"})
        now=datetime.now(TZ)
        state="notopen" if not p or now<p["opens_at"] else "closed" if now>p["closes_at"] else "closing" if p["closes_at"]-now<timedelta(days=2) else "open"
        mean_values=[float(r["avg"]) for r in progress if r["avg"]!="—"]
        result.append({"id":group["code"].lower(),"name":group["name"],"meta":f"{len(group_classes)} lớp · {sum(c['size'] for c in group_classes)} học viên",
          "state":state,"deadline":p["closes_at"].astimezone(TZ).strftime("%d/%m") if p else "—","published":sum(r["state"]=="published" for r in progress),"total":len(progress),"term":p["term_name"] if p else "Chưa thiết lập",
          "window":f"{local(p['opens_at']).replace('T',' ')} → {local(p['closes_at']).replace('T',' ')}" if p else " → ","opensAt":local(p["opens_at"]) if p else "","closesAt":local(p["closes_at"]) if p else "",
          "publishesAt":local(p["publishes_at"]) if p else "","release":"Hẹn giờ "+local(p["publishes_at"]) if p and p["release_mode"]=="SCHEDULED" else "Ngay khi GV xác nhận",
          "remind":bool(p["remind_before_deadline"]) if p else True,"autoLock":bool(p["auto_lock"]) if p else True,"note":"Đóng lúc "+local(p["closes_at"]).replace("T"," ") if p else "Chưa thiết lập thời gian nhập điểm",
          "avg":f"{sum(mean_values)/len(mean_values):.1f}" if mean_values else "—","left":str(max(0,(p["closes_at"]-now).days))+" ngày" if p else "—","accent":{"KINDY":"#43aeb2","KID":"#267dbe","TEEN":"#8b70be"}.get(group["code"],"#267dbe"),"rows":progress})
    return result


def save_grade_window(actor,group_code,payload):
    courses=rows("SELECT co.id FROM courses co JOIN course_groups g ON g.id=co.group_id WHERE LOWER(g.code)=:code",code=group_code.lower())
    if not courses: raise NotFoundError("Không tìm thấy khóa học")
    start=parse_dt(payload.get("opensAt")); end=parse_dt(payload.get("closesAt"))
    term=str(payload.get("term") or "").strip()
    if not term or len(term)>150 or start>=end: raise AppError("Tên kỳ và thời gian nhập điểm không hợp lệ",422)
    scheduled=payload.get("mode")=="timed" or str(payload.get("release") or "").startswith("Hẹn")
    publication=parse_dt(payload.get("publishesAt")) if scheduled else None
    if publication and publication<start: raise AppError("Thời gian công bố không được trước thời gian mở",422)
    for c in courses:
        p=one("SELECT TOP 1 * FROM assessment_grading_periods WHERE course_id=:id ORDER BY opens_at DESC,id DESC",id=c["id"])
        params={"course":c["id"],"term":term,"start":start,"end":end,"mode":"SCHEDULED" if scheduled else "ON_CONFIRMATION","publication":publication,"remind":bool(payload.get("remind",True)),"lock":bool(payload.get("autoLock",True)),"actor":actor.id}
        if p:
            run("""UPDATE assessment_grading_periods SET term_name=:term,opens_at=:start,closes_at=:end,release_mode=:mode,publishes_at=:publication,remind_before_deadline=:remind,auto_lock=:lock,updated_at=SYSDATETIMEOFFSET() WHERE id=:id""",id=p["id"],**params)
            period=p["id"]
        else:
            period=run("""INSERT INTO assessment_grading_periods(course_id,term_name,opens_at,closes_at,release_mode,publishes_at,remind_before_deadline,auto_lock,created_by)
                OUTPUT INSERTED.id VALUES(:course,:term,:start,:end,:mode,:publication,:remind,:lock,:actor)""",**params).scalar_one()
        run("UPDATE assessment_workflows SET period_id=:period WHERE course_id=:course AND period_id IS NULL",period=period,course=c["id"])
        audit(actor,"assessment_grading_periods",period,{"course_id":c["id"],"term":term,"opens_at":short(start),"closes_at":short(end)})
    db.session.commit(); return grade_windows(actor)


def reopen_grades(actor,cid,test):
    a=assessment(actor,cid,test)
    if not a: raise NotFoundError("Chưa có bảng điểm")
    scope(actor,cid,edit=True)
    run("UPDATE assessments SET status='DRAFT',published_by=NULL,published_at=NULL,updated_at=SYSDATETIMEOFFSET() WHERE id=:id",id=a["id"])
    run("UPDATE assessment_workflows SET review_state='DRAFT',confirmed_by=NULL,confirmed_at=NULL,updated_at=SYSDATETIMEOFFSET() WHERE assessment_id=:id",id=a["id"])
    audit(actor,"assessments",a["id"],{"status":"DRAFT","reason":"Manager mở lại bảng điểm"});db.session.commit()
    return grades(actor,cid,test)


def free_staff(actor,start,end):
    start=parse_date(start);end=parse_date(end)
    return [{"id":str(s["id"]),"name":s["full_name"],"note":"Giảng viên" if s["position"]=="LECTURER" else "Trợ giảng"} for s in rows("""SELECT sp.id,sp.position,u.full_name FROM staff_profiles sp JOIN users u ON u.id=sp.user_id
        WHERE sp.status='ACTIVE' AND sp.position IN('LECTURER','TEACHING_ASSISTANT') AND NOT EXISTS(
          SELECT 1 FROM class_sessions s WHERE s.session_date BETWEEN :start AND :end AND s.status<>'CANCELLED' AND sp.id IN(s.lecturer_id,s.assistant_id)) ORDER BY u.full_name""",start=start,end=end)]


def preview_grades_import(actor,file,payload):
    from io import BytesIO
    from openpyxl import load_workbook
    if file is None or not file.filename.lower().endswith('.xlsx'):
        raise AppError("Chọn tệp .xlsx",422)
    content=file.stream.read(5*1024*1024+1)
    if not content or len(content)>5*1024*1024: raise AppError("Tệp Excel tối đa 5 MB",422)
    try: workbook=load_workbook(BytesIO(content),read_only=True,data_only=True)
    except Exception as exc: raise AppError("Không đọc được tệp Excel",422) from exc
    known=classes(actor); sheets=[]
    tests=str(payload.get('test') or 'Kiểm tra giữa kỳ')
    total=0
    try:
        for worksheet in workbook.worksheets:
            selected=next((c for c in known if c['id']==str(payload.get('classId'))),None) if payload.get('classId') else next((c for c in known if c['name'].casefold()==worksheet.title.split(' (')[0].casefold()),None)
            if not selected: raise AppError(f"Không xác định được lớp của sheet {worksheet.title}",422)
            headers=[str(v or '').strip().casefold() for v in next(worksheet.iter_rows(values_only=True),())]
            aliases=[('mã học viên','mã hv','studentid','id'),('nghe','listening'),('đọc','reading'),('nói','speaking'),('viết','writing')]
            indexes=[next((headers.index(alias) for alias in options if alias in headers),None) for options in aliases]
            if None in indexes: raise AppError("Thiếu cột Mã học viên, Nghe, Đọc, Nói, Viết",422)
            students=roster(actor,selected['id']);by_id={s['id']:s for s in students};by_code={s['code']:s for s in students};seen=set();parsed=[]
            for number,values in enumerate(worksheet.iter_rows(min_row=2,values_only=True),2):
                if not any(v is not None for v in values): continue
                total+=1
                if total>1000: raise AppError("Tệp Excel tối đa 1000 dòng",422)
                get=lambda index: values[index] if index<len(values) else None
                identifier=str(get(indexes[0]) or '').strip();student=by_id.get(identifier) or by_code.get(identifier)
                scores=[get(index) for index in indexes[1:]];problem=''
                if not student: problem='Mã HV không có trong lớp'
                elif student['id'] in seen: problem='Trùng mã học viên'
                else:
                    try: validate_scores([{'studentId':student['id'],'scores':scores}],set(by_id),False)
                    except AppError as exc: problem=exc.message
                    if any(s is None for s in scores): problem='Cần nhập đủ bốn kỹ năng'
                if student: seen.add(student['id'])
                parsed.append({'line':number,'id':identifier,'studentId':student['id'] if student else identifier,'name':student['name'] if student else '—','s':[float(v) if isinstance(v,(int,float,Decimal)) else str(v or '') for v in scores],'scores':[float(v) if isinstance(v,(int,float,Decimal)) else str(v or '') for v in scores],'res':'err' if problem else 'ok','msg':problem})
            sheets.append({'name':worksheet.title,'classId':selected['id'],'test':tests,'rows':parsed})
    finally: workbook.close()
    if not total: raise AppError("Tệp Excel không có dữ liệu",422)
    return {'sheets':sheets,'total':total}


def confirm_grades_import(actor,payload):
    batches=payload.get('sheets')
    if not isinstance(batches,list) or not batches or any(not isinstance(batch,dict) for batch in batches): raise AppError("Chưa có dữ liệu nhập điểm",422)
    count=0
    for batch in batches:
        current=grades(actor,ident(batch.get('classId')),batch.get('test') or 'Kiểm tra giữa kỳ')
        imported=batch.get('rows',[])
        valid=validate_scores(imported,{r['studentId'] for r in current['rows']},False)
        mapping={str(sid):(values,note) for sid,values,note in valid}
        updated=[]
        for row in current['rows']:
            values=mapping.get(row['studentId'])
            if values and (payload.get('overwrite') or all(v=='' for v in row['scores'])):
                updated.append({**row,'scores':[float(v) if v is not None else '' for v in values[0]],'note':values[1]});count+=1
            else: updated.append(row)
        save_grades(actor,batch['classId'],batch.get('test') or 'Kiểm tra giữa kỳ',{'status':'draft','rows':updated,'version':current['version']},commit=False)
    db.session.commit();return {'imported':count}


def remind_grades(actor,payload):
    group=str(payload.get('courseId') or '').lower()
    selected=ident(payload['classId']) if payload.get('classId') else None
    recipients=rows("""SELECT c.id,c.name,u.id AS user_id FROM classes c JOIN courses co ON co.id=c.course_id
        JOIN course_groups g ON g.id=co.group_id JOIN staff_profiles sp ON sp.id=c.lecturer_id JOIN users u ON u.id=sp.user_id
        OUTER APPLY(SELECT TOP 1 a.status FROM assessments a WHERE a.class_id=c.id ORDER BY a.updated_at DESC,a.id DESC) latest
        WHERE LOWER(g.code)=:group AND (:cid IS NULL OR c.id=:cid) AND c.status IN('PLANNED','ONGOING')
        AND COALESCE(latest.status,'DRAFT')<>'PUBLISHED'""",group=group,cid=selected)
    for r in recipients:
        run("""INSERT INTO notifications(recipient_user_id,notification_type,title,content,created_by)
            VALUES(:user,'GENERAL',N'Nhắc nhập điểm',:content,:actor)""",user=r['user_id'],content=f"Vui lòng hoàn tất và xác nhận bảng điểm lớp {r['name']}.",actor=actor.id)
    db.session.commit();return {'sent':len(recipients)}


def cancel_calendar_session(actor,sid,payload):
    reason=str(payload.get('reason') or '').strip();note=str(payload.get('note') or '').strip()
    if not reason or len(reason)+(len(note)+2 if note else 0)>255: raise AppError('Lý do hủy cần từ 1 đến 255 ký tự',422)
    context=session(actor,sid)
    session_service.cancel_session(sid,reason+(': '+note if note else ''),actor=actor,ip_address=None,commit=False)
    notified=0
    if payload.get('notify'):
        recipients=rows("""SELECT DISTINCT u.id FROM users u WHERE u.status='ACTIVE' AND (
            EXISTS(SELECT 1 FROM class_enrollments ce JOIN students st ON st.id=ce.student_id
              WHERE ce.class_id=:cid AND ce.enrolled_date<=:date AND (ce.left_date IS NULL OR ce.left_date>=:date) AND st.user_id=u.id)
            OR EXISTS(SELECT 1 FROM class_enrollments ce JOIN student_user_links sul ON sul.student_id=ce.student_id
              WHERE ce.class_id=:cid AND ce.enrolled_date<=:date AND (ce.left_date IS NULL OR ce.left_date>=:date) AND sul.user_id=u.id AND sul.can_view=1))""",cid=ident(context['classId']),date=parse_date(context['iso']))
        for recipient in recipients:
            run("INSERT INTO notifications(recipient_user_id,notification_type,title,content,created_by) VALUES(:user,'SCHEDULE',:title,:content,:actor)",user=recipient['id'],title=f"Hủy buổi học {context['name']}",content=f"{context['iso']} {context['time']}: {reason}. {note}",actor=actor.id)
        notified=len(recipients)
    if payload.get('makeup'):
        # The existing form explicitly defers choosing a date. Persist its scheduling task;
        # do not fabricate a replacement session with an arbitrary date/room/staff.
        run("""INSERT INTO notifications(recipient_user_id,notification_type,title,content,created_by)
            VALUES(:actor,'REQUEST',N'Chờ xếp lịch học bù',:content,:actor)""",actor=actor.id,content=f"Xếp buổi học bù cho lớp {context['name']}, buổi #{sid} ngày {context['iso']} {context['time']} đã hủy. Chọn ngày, phòng và giảng viên trước khi tạo buổi học.")
    audit(actor,'class_sessions',sid,{'cancelled':True,'notify':bool(payload.get('notify')),'notifications':notified,'makeup_requested':bool(payload.get('makeup'))})
    db.session.commit();return {**session(actor,sid),'notifications':notified,'makeupRequested':bool(payload.get('makeup'))}
