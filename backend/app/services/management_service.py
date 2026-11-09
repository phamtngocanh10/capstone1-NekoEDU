"""SQL adapters for the original Manager screens. No browser/mock persistence."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from functools import wraps
import re
from uuid import uuid4

from marshmallow import ValidationError
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.common.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.common.security import hash_password
from app.extensions import db
from app.models import AuditAction, AuditLog, Role, RoleCode, StaffProfile, User
from app.schemas.student_schema import StudentCreateSchema
from app.services import student_service

ROLE_NAMES = {"MANAGER": "Manager", "LECTURER": "Lecturer", "TEACHING_ASSISTANT": "Teaching Assistant", "STUDENT_PARENT": "Student / Parent"}
ROLE_CODES = {value: key for key, value in ROLE_NAMES.items()}
GENDERS = {"Nam": "MALE", "Nữ": "FEMALE", "Khác": "OTHER"}
CONTRACTS = {"Toàn thời gian": "FULL_TIME", "Bán thời gian": "PART_TIME", "Thời vụ": "TEMPORARY"}
DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
ACTIONS = ["VIEW", "CREATE", "UPDATE", "DELETE"]


def rows(sql, params=None):
    return db.session.execute(text(sql), params or {}).mappings().all()


def one(sql, params=None, message="Không tìm thấy dữ liệu"):
    found = db.session.execute(text(sql), params or {}).mappings().all()
    if not found:
        raise NotFoundError(message)
    if len(found) > 1:
        raise ConflictError("Có nhiều bản ghi trùng tên. Vui lòng chọn đúng mã dữ liệu.")
    return found[0]


def scalar(sql, params=None):
    return db.session.execute(text(sql), params or {}).scalar_one()


def iso(value):
    return value.isoformat() if value else None


def display_date(value):
    return value.strftime("%d/%m/%Y") if value else ""


def _json(value):
    if isinstance(value, dict):
        return {key: _json(item) for key, item in value.items() if key != "password"}
    if isinstance(value, (list, tuple)):
        return [_json(item) for item in value]
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return int(value)
    return value


def audit(actor, entity, entity_id, payload, action=AuditAction.UPDATE):
    db.session.add(AuditLog(actor_user_id=actor.id, action=action, entity_name=entity,
                            entity_id=entity_id, new_data=_json(payload)))


def atomic(function):
    @wraps(function)
    def run(*args, **kwargs):
        try:
            result = function(*args, **kwargs)
            db.session.commit()
            return result
        except IntegrityError as exc:
            db.session.rollback()
            raise ConflictError("Dữ liệu trùng hoặc đang được liên kết. Lịch sử nghiệp vụ được giữ nguyên.") from exc
        except Exception:
            db.session.rollback()
            raise
    return run


def catalog():
    return {
        "courses": [{"id": row["id"], "name": row["name"], "groupId": row["group_code"].lower() if row["group_code"] else "", "levelId": row["level_id"], "fee": int(row["monthly_fee"])} for row in rows("""
            SELECT c.*, g.code group_code FROM courses c
            LEFT JOIN course_groups g ON g.id=c.group_id WHERE c.status='ACTIVE' ORDER BY c.id""")],
        "rooms": [{"id": row["id"], "name": row["name"], "code": row["code"], "capacity": row["capacity"]} for row in rows("SELECT * FROM rooms WHERE status='AVAILABLE' ORDER BY code")],
        "staff": [{"id": row["id"], "name": row["full_name"], "position": row["position"]} for row in rows("""
            SELECT sp.id,u.full_name,sp.position FROM staff_profiles sp JOIN users u ON u.id=sp.user_id
            WHERE sp.status='ACTIVE' AND u.status='ACTIVE' AND u.deleted_at IS NULL ORDER BY u.full_name""")],
        "fees": [{"value": str(int(row["base_amount"])), "label": f'{int(row["base_amount"]):,}đ / {row["sessions_per_cycle"]} buổi'.replace(",", ".")} for row in rows("""
            SELECT TOP 1 base_amount,sessions_per_cycle FROM tuition_business_policies
            WHERE effective_from<=CAST(SYSDATETIMEOFFSET() AS date)
            AND (effective_to IS NULL OR effective_to>=CAST(SYSDATETIMEOFFSET() AS date)) ORDER BY version DESC""")],
    }


def list_classes(group_id=None):
    result = []
    policy=rows("""SELECT TOP 1 base_amount FROM tuition_business_policies WHERE effective_from<=:today
        AND (effective_to IS NULL OR effective_to>=:today) ORDER BY version DESC""",{"today":date.today()})
    for row in rows("""
        SELECT c.*,co.name course_name,co.monthly_fee,g.code group_code,g.name group_name,
          u.full_name teacher,u.phone teacher_phone,sp.certificate teacher_certificate,
          sp.user_id lecturer_user_id,au.full_name assistant,au.phone assistant_phone,r.code room,
          (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id=c.id AND ce.status='ACTIVE') size,
          (SELECT COUNT(*) FROM class_sessions cs WHERE cs.class_id=c.id AND cs.status='COMPLETED') completed,
          (SELECT COUNT(*) FROM class_sessions cs WHERE cs.class_id=c.id) session_count
        FROM classes c JOIN courses co ON co.id=c.course_id LEFT JOIN course_groups g ON g.id=co.group_id
        JOIN staff_profiles sp ON sp.id=c.lecturer_id JOIN users u ON u.id=sp.user_id
        LEFT JOIN staff_profiles asp ON asp.id=c.assistant_id LEFT JOIN users au ON au.id=asp.user_id
        JOIN rooms r ON r.id=c.default_room_id ORDER BY c.id"""):
        group = (row["group_code"] or "").lower()
        if group_id and group != str(group_id).lower():
            continue
        schedules = rows("SELECT * FROM class_schedules WHERE class_id=:id ORDER BY day_of_week,start_time", {"id": row["id"]})
        schedule = schedules[0] if schedules else None
        start = schedule["start_time"].strftime("%H:%M") if schedule else ""
        end = schedule["end_time"].strftime("%H:%M") if schedule else ""
        day_labels = [DAYS[item["day_of_week"]-1] for item in schedules]
        state = "ended" if row["status"] in ("COMPLETED", "CANCELLED") else "soon" if row["status"] == "PLANNED" else "full" if row["size"] >= row["max_students"] else "open"
        latest = rows("SELECT TOP 1 status FROM class_sessions WHERE class_id=:id AND session_date<=CAST(SYSDATETIMEOFFSET() AS date) ORDER BY session_date DESC,start_time DESC", {"id": row["id"]})
        result.append({"id": str(row["id"]), "backendId": row["id"], "name": row["name"], "code": row["class_code"],
            "courseId": group, "sqlCourseId": row["course_id"], "course": row["group_name"] or row["course_name"],
            "teacher": row["teacher"], "lecturerId": row["lecturer_id"], "assistant": row["assistant"] or "—", "assistantId": row["assistant_id"],
            "teacherContact":" · ".join(value for value in (row["teacher_certificate"],row["teacher_phone"]) if value) or "—","assistantContact":row["assistant_phone"] or "—",
            "room": row["room"], "roomId": row["default_room_id"], "days": "-".join(day_labels), "dayLabels": day_labels,
            "listTime": start, "range": f"{start}–{end}" if schedule else "—", "slot": f"{start} – {end}" if schedule else "", "schedule": f'{"-".join(day_labels)} · {start}–{end}',
            "size": row["size"], "cap": row["max_students"], "status": state, "statusCode": row["status"],
            "latest": ("done" if latest[0]["status"] == "COMPLETED" else "todo") if latest else None,
            "start": display_date(row["start_date"]), "startDate": iso(row["start_date"]), "endDate": iso(row["end_date"]),
            "enrollable": row["status"] in ("PLANNED","ONGOING") and row["end_date"]>=date.today() and row["size"]<row["max_students"],
            "completed": row["completed"], "sessionCount": row["session_count"], "fee": int(policy[0]["base_amount"]) if policy else None,
        })
    return result


def list_courses():
    classes = list_classes()
    result = []
    for group in rows("SELECT * FROM course_groups ORDER BY sort_order,id"):
        members = [item for item in classes if item["courseId"] == group["code"].lower()]
        students = sum(item["size"] for item in members)
        result.append({"id": group["code"].lower(), "name": group["name"], "desc": group["description"] or "",
            "accent": {"KINDY": "var(--gradient)", "KID": "#1a6fc9", "TEEN": "#299b70"}.get(group["code"], "var(--gradient)"),
            "classes": len(members), "students": students, "open": sum(item["status"] in ("open", "full") for item in members),
            "soon": sum(item["status"] == "soon" for item in members), "levels": sorted({int(item["curriculum_level"]) for item in rows("SELECT curriculum_level FROM courses WHERE group_id=:id AND curriculum_level IS NOT NULL", {"id": group["id"]})}),
            "avgSize": f'{students/len(members):.1f} / {max(item["cap"] for item in members)}' if members else "0 / 0"})
    return result


def _slot(value):
    parts = re.split(r"\s*[–-]\s*", value)
    try:
        start, end = [datetime.strptime(part, "%H:%M").time() for part in parts]
    except (ValueError, TypeError):
        raise AppError("Khung giờ không hợp lệ")
    if end <= start:
        raise AppError("Giờ kết thúc phải sau giờ bắt đầu")
    return start, end


def _staff(staff_id, position=None):
    staff = one("""SELECT sp.*,u.full_name,u.status account_status,u.deleted_at FROM staff_profiles sp
        JOIN users u ON u.id=sp.user_id WHERE sp.id=:id""", {"id": staff_id}, "Không tìm thấy nhân sự")
    if staff["status"] != "ACTIVE" or staff["account_status"] != "ACTIVE" or staff["deleted_at"]:
        raise ConflictError("Nhân sự phải đang hoạt động")
    if position and staff["position"] != position:
        raise ConflictError("Vai trò nhân sự không phù hợp phân công")
    return staff


def _schedule_conflict(class_id, lecturer_id, assistant_id, room_id, day, start_time, end_time, start_date, end_date):
    conflicts = rows("""SELECT TOP 1 c.name FROM class_schedules s JOIN classes c ON c.id=s.class_id
        WHERE c.id<>:id AND c.status IN ('PLANNED','ONGOING') AND s.day_of_week=:day
        AND s.start_time<:end_time AND s.end_time>:start_time AND c.start_date<=:end_date AND c.end_date>=:start_date
        AND (s.room_id=:room OR c.lecturer_id IN (:lecturer,:assistant) OR c.assistant_id IN (:lecturer,:assistant))""",
        {"id": class_id or 0,"day":day,"start_time":start_time,"end_time":end_time,"start_date":start_date,"end_date":end_date,"room":room_id,"lecturer":lecturer_id,"assistant":assistant_id or -1})
    if conflicts:
        raise ConflictError(f'Trùng lịch phòng hoặc nhân sự với lớp {conflicts[0]["name"]}')


@atomic
def create_class(payload, actor):
    course = one("SELECT * FROM courses WHERE (name=:name OR id=TRY_CONVERT(bigint,:name)) AND status='ACTIVE'", {"name":payload["course"]}, "Không tìm thấy khóa học đang mở")
    lecturer = one("""SELECT sp.id FROM staff_profiles sp JOIN users u ON u.id=sp.user_id
        WHERE (u.full_name=:name OR sp.id=TRY_CONVERT(bigint,:name)) AND sp.position='LECTURER' AND sp.status='ACTIVE' AND u.status='ACTIVE' AND u.deleted_at IS NULL""", {"name":payload["teacher"]}, "Vui lòng chọn giảng viên đang hoạt động")
    _staff(lecturer["id"], "LECTURER")
    room = one("SELECT * FROM rooms WHERE code=:room AND status='AVAILABLE'", {"room":payload["room"]}, "Vui lòng chọn phòng đang hoạt động")
    if room["capacity"] < payload["cap"]:
        raise ConflictError("Sĩ số tối đa vượt sức chứa phòng")
    start_time,end_time = _slot(payload["slot"])
    day_numbers = sorted({DAYS.index(label)+1 for label in payload["days"]})
    # The existing class detail specifies 36 sessions. Derive its end from actual meeting days.
    meetings, current = [], payload["start"]
    while len(meetings) < 36:
        if current.isoweekday() in day_numbers:
            meetings.append(current)
        current += timedelta(days=1)
    end_date = max(meetings[-1], payload["start"] + timedelta(days=1))
    for day in day_numbers:
        _schedule_conflict(None,lecturer["id"],None,room["id"],day,start_time,end_time,payload["start"],end_date)
    class_id = scalar("""INSERT INTO classes(class_code,name,course_id,lecturer_id,default_room_id,max_students,start_date,end_date,status)
        OUTPUT INSERTED.id VALUES(:code,:name,:course,:lecturer,:room,:cap,:start,:end,'PLANNED')""",
        {"code":"CL"+uuid4().hex[:16].upper(),"name":payload["name"],"course":course["id"],"lecturer":lecturer["id"],"room":room["id"],"cap":payload["cap"],"start":payload["start"],"end":end_date})
    for day in day_numbers:
        db.session.execute(text("INSERT INTO class_schedules(class_id,day_of_week,start_time,end_time,room_id) VALUES(:id,:day,:start,:end,:room)"), {"id":class_id,"day":day,"start":start_time,"end":end_time,"room":room["id"]})
    for meeting in meetings:
        from app.services.session_service import _ensure_no_session_conflicts
        _ensure_no_session_conflicts(class_id,{"session_date":meeting,"start_time":start_time,"end_time":end_time,"room_id":room["id"],"lecturer_id":lecturer["id"],"assistant_id":None})
        db.session.execute(text("""INSERT INTO class_sessions(class_id,session_date,start_time,end_time,room_id,lecturer_id,status)
            VALUES(:id,:date,:start,:end,:room,:lecturer,'SCHEDULED')"""), {"id":class_id,"date":meeting,"start":start_time,"end":end_time,"room":room["id"],"lecturer":lecturer["id"]})
    audit(actor,"classes",class_id,payload,AuditAction.CREATE)
    return next(item for item in list_classes() if item["backendId"] == class_id)


def _class_row(class_id):
    return one("SELECT * FROM classes WITH (UPDLOCK,HOLDLOCK) WHERE id=:id", {"id":class_id}, "Không tìm thấy lớp học")


def _enroll(class_id,student_id,enrolled_date):
    class_row = _class_row(class_id)
    if class_row["status"] not in ("PLANNED","ONGOING"):
        raise ConflictError("Lớp đã kết thúc hoặc bị hủy")
    student = one("SELECT * FROM students WHERE id=:id", {"id":student_id}, "Không tìm thấy học viên")
    if student["status"] != "ACTIVE":
        raise ConflictError("Chỉ xếp lớp cho học viên đang học")
    existing = rows("SELECT * FROM class_enrollments WHERE class_id=:class AND student_id=:student", {"class":class_id,"student":student_id})
    if existing:
        if existing[0]["status"] == "ACTIVE":
            return existing[0]["id"]
        raise ConflictError("Học viên đã có lịch sử ở lớp này; không ghi đè lịch sử ghi danh")
    if enrolled_date < student["enrolled_at"] or enrolled_date > class_row["end_date"]:
        raise AppError("Ngày ghi danh phải từ ngày nhập học đến ngày kết thúc lớp")
    count = scalar("SELECT COUNT(*) FROM class_enrollments WHERE class_id=:id AND status='ACTIVE'", {"id":class_id})
    if count >= class_row["max_students"]:
        raise ConflictError("Lớp học đã đủ sĩ số")
    level_id=scalar("SELECT level_id FROM courses WHERE id=:id", {"id":class_row["course_id"]})
    if student["current_level_id"] != level_id:
        raise ConflictError("Cấp độ học viên chưa phù hợp khóa học. Hãy chuyển cấp trước khi xếp lớp.")
    return scalar("""INSERT INTO class_enrollments(class_id,student_id,enrolled_date,status)
        OUTPUT INSERTED.id VALUES(:class,:student,:date,'ACTIVE')""", {"class":class_id,"student":student_id,"date":enrolled_date})


@atomic
def enroll(class_id,payload,actor):
    enrollment_id=_enroll(class_id,payload["student_id"],payload["enrolled_date"])
    audit(actor,"class_enrollments",enrollment_id,payload,AuditAction.CREATE)
    return {"id":enrollment_id,"class_id":class_id,**payload}


@atomic
def deactivate_class(class_id,actor):
    current=_class_row(class_id)
    if current["status"]=="COMPLETED" or scalar("SELECT COUNT(*) FROM class_enrollments WHERE class_id=:id",{"id":class_id}):
        raise ConflictError("Lớp đã có ghi danh hoặc đã hoàn thành. Không thể hủy để bảo toàn lịch sử và học phí.")
    from app.services.session_service import cancel_session
    for session in rows("SELECT id FROM class_sessions WHERE class_id=:id AND status='SCHEDULED'",{"id":class_id}):
        cancel_session(session["id"],"Hủy lớp chưa ghi danh",actor=actor,ip_address=None,commit=False)
    db.session.execute(text("UPDATE classes SET status='CANCELLED' WHERE id=:id"), {"id":class_id})
    audit(actor,"classes",class_id,{"status":"CANCELLED"})
    return {"id":class_id,"status":"CANCELLED"}


@atomic
def update_class(class_id,payload,actor):
    current=_class_row(class_id)
    course=one("SELECT * FROM courses WHERE (name=:name OR id=TRY_CONVERT(bigint,:name)) AND status='ACTIVE'",{"name":payload["course"]},"Không tìm thấy khóa học")
    lecturer=one("""SELECT sp.id FROM staff_profiles sp JOIN users u ON u.id=sp.user_id
        WHERE (u.full_name=:name OR sp.id=TRY_CONVERT(bigint,:name)) AND sp.position='LECTURER'
        AND sp.status='ACTIVE' AND u.status='ACTIVE' AND u.deleted_at IS NULL""",{"name":payload["teacher"]},"Không tìm thấy giảng viên đang hoạt động")
    room=one("SELECT * FROM rooms WHERE code=:room AND status='AVAILABLE'",{"room":payload["room"]},"Không tìm thấy phòng đang hoạt động")
    count=scalar("SELECT COUNT(*) FROM class_enrollments WHERE class_id=:id AND status='ACTIVE'",{"id":class_id})
    if payload["cap"]<count or payload["cap"]>room["capacity"]:
        raise ConflictError("Sĩ số tối đa phải đủ cho học viên hiện tại và không vượt sức chứa phòng")
    if course["id"]!=current["course_id"] and scalar("SELECT COUNT(*) FROM class_enrollments WHERE class_id=:id",{"id":class_id}):
        raise ConflictError("Không thay đổi khóa học của lớp đã ghi danh")
    start_time,end_time=_slot(payload["slot"])
    day_numbers=sorted({DAYS.index(label)+1 for label in payload["days"]})
    schedules=rows("SELECT * FROM class_schedules WHERE class_id=:id ORDER BY day_of_week",{"id":class_id})
    if payload["start"]!=current["start_date"] or day_numbers!=[item["day_of_week"] for item in schedules] or any(item["start_time"]!=start_time or item["end_time"]!=end_time for item in schedules):
        raise ConflictError("Đổi ngày hoặc khung giờ phải dùng chức năng lịch để giữ nguyên lịch sử buổi học và học phí")
    for day in day_numbers:
        _schedule_conflict(class_id,lecturer["id"],current["assistant_id"],room["id"],day,start_time,end_time,current["start_date"],current["end_date"])
    db.session.execute(text("""UPDATE classes SET name=:name,course_id=:course,lecturer_id=:lecturer,default_room_id=:room,max_students=:cap WHERE id=:id"""),
        {"id":class_id,"name":payload["name"],"course":course["id"],"lecturer":lecturer["id"],"room":room["id"],"cap":payload["cap"]})
    db.session.execute(text("UPDATE class_schedules SET room_id=:room WHERE class_id=:id"),{"id":class_id,"room":room["id"]})
    from app.services.session_service import _ensure_no_session_conflicts
    for session in rows("SELECT * FROM class_sessions WHERE class_id=:id AND status='SCHEDULED' AND session_date>=:today",{"id":class_id,"today":date.today()}):
        values={**dict(session),"room_id":room["id"],"lecturer_id":lecturer["id"]}
        _ensure_no_session_conflicts(class_id,values,exclude_session_id=session["id"])
        db.session.execute(text("UPDATE class_sessions SET room_id=:room,lecturer_id=:lecturer WHERE id=:id"),{"id":session["id"],"room":room["id"],"lecturer":lecturer["id"]})
    audit(actor,"classes",class_id,payload)
    return class_detail(class_id)


@atomic
def save_catalog(kind,payload,actor,item_id=None):
    table="courses" if kind=="courses" else "rooms"
    if item_id is not None:
        one(f"SELECT id FROM {table} WHERE id=:id", {"id":item_id})
        if table=="rooms" and scalar("SELECT COUNT(*) FROM classes WHERE default_room_id=:id AND status IN ('PLANNED','ONGOING') AND max_students>:cap", {"id":item_id,"cap":payload["capacity"]}):
            raise ConflictError("Sức chứa mới nhỏ hơn sĩ số tối đa của lớp đang mở")
        db.session.execute(text(f'UPDATE {table} SET '+",".join(f"{key}=:{key}" for key in payload)+" WHERE id=:id"), {**payload,"id":item_id})
    else:
        item_id=scalar(f'INSERT INTO {table}('+",".join(payload)+") OUTPUT INSERTED.id VALUES("+",".join(f":{key}" for key in payload)+")",payload)
    audit(actor,table,item_id,payload,AuditAction.UPDATE if item_id else AuditAction.CREATE)
    return dict(one(f"SELECT * FROM {table} WHERE id=:id", {"id":item_id}))


@atomic
def deactivate_catalog(kind,item_id,actor):
    table="courses" if kind=="courses" else "rooms"
    one(f"SELECT id FROM {table} WHERE id=:id", {"id":item_id})
    column="course_id" if table=="courses" else "default_room_id"
    if scalar(f"SELECT COUNT(*) FROM classes WHERE {column}=:id AND status IN ('PLANNED','ONGOING')", {"id":item_id}):
        raise ConflictError("Danh mục đang được lớp học sử dụng; hãy xử lý lớp trước")
    state="INACTIVE" if table=="courses" else "MAINTENANCE"
    db.session.execute(text(f"UPDATE {table} SET status=:status WHERE id=:id"), {"id":item_id,"status":state})
    audit(actor,table,item_id,{"status":state})
    return {"id":item_id,"status":state}


def list_students(class_id=None,identifier=None):
    result=[]
    fee_options=catalog()["fees"]
    current_fee=str(fee_options[0]["value"]) if fee_options else ""
    for row in rows("""SELECT s.*,g.full_name parent_name,g.phone parent_phone,g.relationship parent_relationship,
        g.email parent_email,l.code level_code,ce.class_id,c.name class_name,co.name course_name,cg.name group_name,
        (SELECT COALESCE(SUM(final_amount-paid_amount),0) FROM tuition_invoices i WHERE i.student_id=s.id AND i.status<>'CANCELLED') balance,
        (SELECT COUNT(*) FROM tuition_invoices i WHERE i.student_id=s.id AND i.status<>'CANCELLED' AND i.final_amount>i.paid_amount AND i.due_date<CAST(SYSDATETIMEOFFSET() AS date)) overdue,
        (SELECT COUNT(*) FROM tuition_invoices i WHERE i.student_id=s.id AND i.status<>'CANCELLED') invoice_count,
        (SELECT TOP 1 sul.user_id FROM student_user_links sul WHERE sul.student_id=s.id ORDER BY sul.id) linked_user_id
        FROM students s JOIN guardians g ON g.id=s.guardian_id JOIN levels l ON l.id=s.current_level_id
        OUTER APPLY (SELECT TOP 1 e.class_id FROM class_enrollments e WHERE e.student_id=s.id AND e.status='ACTIVE' ORDER BY e.enrolled_date DESC,e.id DESC) ce
        LEFT JOIN classes c ON c.id=ce.class_id LEFT JOIN courses co ON co.id=c.course_id LEFT JOIN course_groups cg ON cg.id=co.group_id
        WHERE (:identifier IS NULL OR s.student_code=:identifier OR s.id=TRY_CONVERT(bigint,:identifier))
        ORDER BY s.student_code""",{"identifier":str(identifier) if identifier is not None else None}):
        if class_id is not None and not scalar("SELECT COUNT(*) FROM class_enrollments WHERE student_id=:student AND class_id=:class AND status='ACTIVE'", {"student":row["id"],"class":class_id}):
            continue
        result.append({"id":row["student_code"],"backendId":row["id"],"studentCode":row["student_code"],"name":row["full_name"],
            "className":row["class_name"] or "Chưa xếp lớp","classId":str(row["class_id"]) if row["class_id"] else None,"course":row["group_name"] or row["course_name"] or "",
            "sqlCourseId":scalar("SELECT course_id FROM classes WHERE id=:id",{"id":row["class_id"]}) if row["class_id"] else None,"levelId":row["current_level_id"],"enrollmentState":"active" if row["class_id"] else "pending",
            "joined":display_date(row["enrolled_at"]),"enrolledAt":iso(row["enrolled_at"]),"birth":display_date(row["date_of_birth"]),"dateOfBirth":iso(row["date_of_birth"]),
            "gender":{value:key for key,value in GENDERS.items()}.get(row["gender"],""),"address":row["address"] or "",
            "parent":row["parent_name"],"parentName":row["parent_name"],"parentPhone":row["parent_phone"],"parentRelationship":row["parent_relationship"],
            "email":row["contact_email"] or row["parent_email"] or "","guardianId":row["guardian_id"],"userId":row["linked_user_id"] or row["user_id"],
            "tuition":"overdue" if row["overdue"] else "pending" if row["balance"]>0 or not row["invoice_count"] else "paid",
            "balance":int(row["balance"]),"invoiceState":"issued" if row["invoice_count"] else "pending" if current_fee else "pendingPolicy","fee":current_fee,
            "status":"studying" if row["status"]=="ACTIVE" else "stopped","statusCode":row["status"],"note":row["note"] or ""})
    return result


def get_student(identifier):
    student=next(iter(list_students(identifier=identifier)),None)
    if not student:
        raise NotFoundError("Không tìm thấy học viên")
    attendance=rows("""SELECT TOP 11 s.session_date,a.status FROM attendances a JOIN class_sessions s ON s.id=a.session_id
        WHERE a.student_id=:id ORDER BY s.session_date DESC,s.start_time DESC""",{"id":student["backendId"]})
    student["attendance"]=[[item["session_date"].strftime("%d/%m"),{"PRESENT":"Có mặt","LATE":"Đi muộn","ABSENT":"Vắng","EXCUSED":"Vắng có phép"}.get(item["status"],item["status"]),item["status"]=="LATE"] for item in attendance]
    counts=one("SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN status IN ('PRESENT','LATE') THEN 1 ELSE 0 END),0) present FROM attendances WHERE student_id=:id",{"id":student["backendId"]})
    student["attendanceRate"]=f'{round(100*counts["present"]/counts["total"])}%' if counts["total"] else "—"
    scores=rows("""SELECT TOP 1 r.score,a.score_max FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id
        WHERE r.student_id=:id AND a.status='PUBLISHED' ORDER BY a.test_date DESC,a.id DESC""",{"id":student["backendId"]})
    student["latestScore"]=f'{scores[0]["score"]} / {scores[0]["score_max"]}' if scores else "—"
    return student


def _validate_email(email):
    if email:
        from marshmallow import fields
        try:
            fields.Email().deserialize(email)
        except ValidationError as exc:
            raise AppError("Email liên hệ không hợp lệ") from exc


@atomic
def save_student(payload,actor,student_id=None):
    phone=re.sub(r"\D","",payload["parentPhone"])
    if not re.fullmatch(r"0\d{9}",phone):
        raise AppError("Số điện thoại phụ huynh cần 10 chữ số bắt đầu bằng 0")
    _validate_email(payload["email"])
    if payload["birth"]>=date.today():
        raise AppError("Ngày sinh phải trước ngày hiện tại")
    if payload["className"] and payload["className"]!="Chưa xếp lớp":
        selected=one("""SELECT c.*,co.level_id,g.name group_name FROM classes c JOIN courses co ON co.id=c.course_id
            LEFT JOIN course_groups g ON g.id=co.group_id WHERE c.name=:name""",{"name":payload["className"]},"Không tìm thấy lớp đã chọn")
        if payload["course"] not in (str(selected["course_id"]),selected["group_name"],scalar("SELECT name FROM courses WHERE id=:id",{"id":selected["course_id"]})):
            raise AppError("Lớp không thuộc khóa học đã chọn")
    else:
        course=one("SELECT * FROM courses WHERE (id=TRY_CONVERT(bigint,:course) OR name=:course) AND status='ACTIVE'",{"course":payload["course"]},"Vui lòng chọn khóa học để xác định trình độ")
        selected={"id":None,"course_id":course["id"],"level_id":course["level_id"]}
    policy=rows("""SELECT TOP 1 base_amount FROM tuition_business_policies WHERE effective_from<=:today
        AND (effective_to IS NULL OR effective_to>=:today) ORDER BY version DESC""",{"today":date.today()})
    if policy and payload["fee"] is not None and int(policy[0]["base_amount"])!=payload["fee"]:
        raise ConflictError("Học phí kỳ đầu phải khớp chính sách 8 buổi hiện hành")
    if not policy and payload["fee"] is not None:
        raise ConflictError("Chưa có chính sách học phí 8 buổi; không thể ghi nhận số tiền kỳ đầu")
    if student_id is None:
        if not payload["parentName"]:
            raise AppError("Họ tên phụ huynh là bắt buộc")
        code="HV"+uuid4().hex[:8].upper()
        body={"student_code":code,"full_name":payload["fullName"],"date_of_birth":payload["birth"].isoformat(),"gender":GENDERS[payload["gender"]],
            "address":payload["address"] or None,"contact_email":payload["email"] or None,"current_level_id":selected["level_id"],"enrolled_at":date.today().isoformat(),
            "guardian":{"full_name":payload["parentName"],"phone":phone,"relationship":payload["parentRelationship"],"email":payload["email"] or None},"note":payload["note"] or None}
        if payload["password"]:
            body["account"]={"username":code,"password":payload["password"],"full_name":payload["parentName"],"phone":phone,"email":None}
            body["account_relationship"]=payload["parentRelationship"]
        student=student_service.create_student(StudentCreateSchema().load(body),actor=actor,ip_address=None,commit=False)
        student_id=student["id"]
    else:
        current=one("SELECT * FROM students WITH (UPDLOCK,HOLDLOCK) WHERE id=:id",{"id":student_id},"Không tìm thấy học viên")
        if payload["birth"]>=current["enrolled_at"]:
            raise AppError("Ngày sinh phải trước ngày nhập học")
        if current["current_level_id"]!=selected["level_id"]:
            latest=scalar("SELECT MAX(effective_date) FROM student_level_transfers WHERE student_id=:id",{"id":student_id})
            if latest and latest>=date.today():
                raise ConflictError("Học viên đã chuyển cấp trong ngày; không ghi đè lịch sử")
            db.session.execute(text("""INSERT INTO student_level_transfers(student_id,old_level_id,new_level_id,effective_date,reason,transferred_by)
                VALUES(:id,:old,:new,:date,:reason,:actor)"""),{"id":student_id,"old":current["current_level_id"],"new":selected["level_id"],"date":date.today(),"reason":"Chuyển lớp từ hồ sơ học viên","actor":actor.id})
        db.session.execute(text("""UPDATE students SET full_name=:name,date_of_birth=:birth,gender=:gender,address=:address,
            contact_email=:email,note=:note,current_level_id=:level,updated_at=SYSDATETIMEOFFSET() WHERE id=:id"""),{"id":student_id,"name":payload["fullName"],"birth":payload["birth"],"gender":GENDERS[payload["gender"]],"address":payload["address"] or None,"email":payload["email"] or None,"note":payload["note"] or None,"level":selected["level_id"]})
        old_phone=scalar("SELECT phone FROM guardians WHERE id=:id",{"id":current["guardian_id"]})
        if old_phone!=phone:
            db.session.execute(text("UPDATE guardians SET phone=:phone WHERE id=:id"),{"phone":phone,"id":current["guardian_id"]})
            audit(actor,"guardians",current["guardian_id"],{"old_phone":old_phone,"phone":phone,"student_id":student_id})
        if payload["password"]:
            links=rows("SELECT TOP 1 user_id FROM student_user_links WHERE student_id=:id ORDER BY id",{"id":student_id})
            if links:
                user=db.session.get(User,links[0]["user_id"])
                user.password_hash=hash_password(payload["password"])
                user.auth_version+=1
            else:
                user=User(username=current["student_code"],email=None,password_hash=hash_password(payload["password"]),full_name=payload["fullName"],phone=phone,role=db.session.scalar(select(Role).where(Role.code==RoleCode.STUDENT_PARENT)))
                db.session.add(user)
                db.session.flush()
                db.session.execute(text("""INSERT INTO student_user_links(student_id,user_id,relationship,can_view,created_by)
                    VALUES(:student,:user,'GUARDIAN',1,:actor)"""),{"student":student_id,"user":user.id,"actor":actor.id})
        db.session.execute(text("""UPDATE class_enrollments SET status='TRANSFERRED',left_date=CASE WHEN enrolled_date>:today THEN enrolled_date ELSE :today END
            WHERE student_id=:student AND status='ACTIVE' AND (:class IS NULL OR class_id<>:class)"""),{"student":student_id,"class":selected["id"],"today":date.today()})
        audit(actor,"students",student_id,payload)
    if selected["id"] and not scalar("SELECT COUNT(*) FROM class_enrollments WHERE student_id=:student AND class_id=:class AND status='ACTIVE'",{"student":student_id,"class":selected["id"]}):
        _enroll(selected["id"],student_id,date.today())
    result=get_student(student_id)
    result["guardianStudents"]=scalar("SELECT COUNT(*) FROM students WHERE guardian_id=:id",{"id":result["guardianId"]})
    return result


@atomic
def deactivate_student(student_id,actor):
    one("SELECT id FROM students WHERE id=:id",{"id":student_id},"Không tìm thấy học viên")
    db.session.execute(text("UPDATE students SET status='DROPPED',updated_at=SYSDATETIMEOFFSET() WHERE id=:id"),{"id":student_id})
    db.session.execute(text("""UPDATE class_enrollments SET status='DROPPED',left_date=CASE WHEN enrolled_date>:today THEN enrolled_date ELSE :today END
        WHERE student_id=:id AND status='ACTIVE'"""),{"id":student_id,"today":date.today()})
    audit(actor,"students",student_id,{"status":"DROPPED"},AuditAction.DELETE)
    return {"id":student_id,"status":"DROPPED"}


def class_detail(class_id):
    result=next((item for item in list_classes() if item["backendId"]==class_id),None)
    if result is None:
        raise NotFoundError("Không tìm thấy lớp học")
    roster=[]
    for student in list_students(class_id):
        detail=get_student(student["backendId"])
        today=rows("""SELECT TOP 1 a.status FROM attendances a JOIN class_sessions s ON s.id=a.session_id
            WHERE a.student_id=:student AND s.class_id=:class AND s.session_date=:today ORDER BY s.start_time DESC""",{"student":student["backendId"],"class":class_id,"today":date.today()})
        roster.append({**student,"today":{"PRESENT":"present","LATE":"late"}.get(today[0]["status"],"absent") if today else "pending","rate":detail["attendanceRate"],"score":detail["latestScore"],"fee":student["tuition"]})
    result["roster"]=roster
    today_sessions=rows("SELECT status FROM class_sessions WHERE class_id=:id AND session_date=:today ORDER BY start_time",{"id":class_id,"today":date.today()})
    result["todayStatus"]="done" if today_sessions and all(item["status"]=="COMPLETED" for item in today_sessions) else "todo" if today_sessions else "none"
    return result


def list_lecturers():
    classes=list_classes()
    result=[]
    today=date.today()
    week_start=today-timedelta(days=today.weekday())
    for row in rows("""SELECT sp.*,u.full_name,u.email,u.phone,u.date_of_birth,u.gender,u.address,u.status account_status
        FROM staff_profiles sp JOIN users u ON u.id=sp.user_id
        WHERE sp.position IN ('LECTURER','TEACHING_ASSISTANT') AND u.deleted_at IS NULL ORDER BY sp.id"""):
        teaching=[item for item in classes if row["id"] in (item["lecturerId"],item["assistantId"]) and item["status"]!="ended"]
        schedules=rows("""SELECT s.* FROM class_schedules s JOIN classes c ON c.id=s.class_id
            WHERE (c.lecturer_id=:id OR c.assistant_id=:id) AND c.status IN ('PLANNED','ONGOING')""",{"id":row["id"]})
        hours=sum((datetime.combine(today,item["end_time"])-datetime.combine(today,item["start_time"])).total_seconds()/3600 for item in schedules)
        sessions=rows("""SELECT s.*,c.name,r.code room FROM class_sessions s JOIN classes c ON c.id=s.class_id JOIN rooms r ON r.id=s.room_id
            WHERE (s.lecturer_id=:id OR s.assistant_id=:id) AND s.session_date BETWEEN :start AND :end AND s.status<>'CANCELLED'""",{"id":row["id"],"start":week_start,"end":week_start+timedelta(days=6)})
        plan={}
        for session in sessions:
            key=f'{session["start_time"].strftime("%H:%M")}-{session["end_time"].strftime("%H:%M")}'
            plan.setdefault(key,{})[session["session_date"].weekday()]={"id":str(session["id"]),"name":session["name"],"room":session["room"],"status":"attended" if session["status"]=="COMPLETED" else "upcoming"}
        month_hours=scalar("""SELECT COALESCE(SUM(DATEDIFF(minute,start_time,end_time)),0)/60.0 FROM class_sessions
            WHERE (lecturer_id=:id OR assistant_id=:id) AND status='COMPLETED' AND YEAR(session_date)=:year AND MONTH(session_date)=:month""",{"id":row["id"],"year":today.year,"month":today.month})
        today_sessions=[item for item in sessions if item["session_date"]==today]
        now=datetime.now().time()
        is_teaching=any(item["start_time"]<=now<item["end_time"] for item in today_sessions)
        result.append({"id":str(row["id"]),"backendId":row["id"],"staffCode":row["staff_code"],"userId":row["user_id"],"name":row["full_name"],
            "role":"lecturer" if row["position"]=="LECTURER" else "assistant","cert":row["certificate"] or row["specialization"] or "—",
            "gender":{value:key for key,value in GENDERS.items()}.get(row["gender"],""),"birth":display_date(row["date_of_birth"]),"address":row["address"] or "",
            "phone":row["phone"] or "","email":row["email"] or "","specialty":row["specialization"] or "","certificate":row["certificate"] or "—",
            "contract":{value:key for key,value in CONTRACTS.items()}.get(row["contract_type"],""),"rate":int(row["hourly_rate"]) if row["hourly_rate"] is not None else None,
            "joined":display_date(row["hire_date"]),"account":"Đã kích hoạt" if row["account_status"]=="ACTIVE" else "Đã khóa",
            "summary":f'{len(teaching)} lớp · '+", ".join(item["name"] for item in teaching) if teaching else "Chưa có lớp","hours":round(hours,2),"monthHours":float(month_hours),
            "rating":"—","punctual":"—","status":"stopped" if row["status"]!="ACTIVE" else "teaching" if is_teaching else "free" if teaching else "none",
            "cells":[int(any(item["start_time"].hour<hour+2 and item["end_time"].hour>hour for item in today_sessions)) for hour in (7,9,13,15,17,19)],
            "classes":teaching,"plan":plan,"weekStart":iso(week_start),"weekEnd":iso(week_start+timedelta(days=6))})
    return result


def get_lecturer(staff_id):
    result=next((item for item in list_lecturers() if item["backendId"]==staff_id),None)
    if result is None:
        raise NotFoundError("Không tìm thấy giảng viên")
    return result


def _unique_email(email,user_id=None):
    if scalar("SELECT COUNT(*) FROM users WHERE LOWER(email)=LOWER(:email) AND id<>:id",{"email":email,"id":user_id or 0}):
        raise ConflictError("Email đã được một tài khoản khác sử dụng")


@atomic
def save_lecturer(payload,actor,staff_id=None):
    position="LECTURER" if payload["role"]=="lecturer" else "TEACHING_ASSISTANT"
    if payload["birth"] and payload["birth"]>=payload["joined"]:
        raise AppError("Ngày sinh phải trước ngày bắt đầu làm việc")
    if staff_id is not None:
        profile=db.session.get(StaffProfile,staff_id)
        if not profile:
            raise NotFoundError("Không tìm thấy hồ sơ nhân sự")
        user=db.session.get(User,profile.user_id)
        if user.id==actor.id and user.role.code!=position:
            raise ForbiddenError("Không tự thay đổi vai trò của chính mình")
        if profile.position!=position and scalar("SELECT COUNT(*) FROM classes WHERE (lecturer_id=:id OR assistant_id=:id) AND status IN ('PLANNED','ONGOING')",{"id":staff_id}):
            raise ConflictError("Cần phân công lại lớp trước khi đổi vai trò")
        _unique_email(payload["email"],user.id)
    else:
        if not payload["password"]:
            raise AppError("Cần nhập mật khẩu cho tài khoản nhân sự mới")
        _unique_email(payload["email"])
        code=("GV" if position=="LECTURER" else "TG")+uuid4().hex[:8].upper()
        user=User(username=code,email=payload["email"].lower(),password_hash=hash_password(payload["password"]),full_name=payload["fullName"],role=db.session.scalar(select(Role).where(Role.code==position)))
        db.session.add(user)
        db.session.flush()
        profile=StaffProfile(user_id=user.id,staff_code=code,position=position,rate_per_session=0,hire_date=payload["joined"])
        db.session.add(profile)
        db.session.flush()
        staff_id=profile.id
    user.full_name=payload["fullName"]
    user.email=payload["email"].lower()
    user.phone=payload["phone"]
    user.date_of_birth=payload["birth"]
    user.gender=GENDERS[payload["gender"]]
    user.address=payload["address"] or None
    if user.role.code!=position:
        user.role=db.session.scalar(select(Role).where(Role.code==position))
        user.auth_version+=1
    if payload["password"]:
        user.password_hash=hash_password(payload["password"])
        user.auth_version+=1
    user.updated_at=datetime.now(timezone.utc)
    profile.position=position
    profile.specialization=payload["specialty"] or None
    profile.contract_type=CONTRACTS[payload["contract"]]
    profile.hourly_rate=payload["rate"]
    profile.hire_date=payload["joined"]
    db.session.flush()
    audit(actor,"staff_profiles",staff_id,payload)
    return get_lecturer(staff_id)


@atomic
def assign_lecturer(staff_id,payload,actor):
    position="LECTURER" if payload["role"]=="lecturer" else "TEACHING_ASSISTANT"
    _staff(staff_id,position)
    label=payload["cls"].split(" · ")[0]
    candidate=one("SELECT * FROM classes WHERE name=:name OR class_code=:name",{"name":label},"Không tìm thấy lớp đã chọn")
    current=_class_row(candidate["id"])
    if current["status"] not in ("PLANNED","ONGOING"):
        raise ConflictError("Không phân công cho lớp đã kết thúc")
    if not current["start_date"]<=payload["start"]<=current["end_date"]:
        raise AppError("Ngày bắt đầu phân công phải nằm trong thời gian lớp")
    start_time,end_time=_slot(payload["slot"])
    days=sorted({DAYS.index(label)+1 for label in payload["days"]})
    schedules=rows("SELECT * FROM class_schedules WHERE class_id=:id ORDER BY day_of_week",{"id":current["id"]})
    changed=days!=[item["day_of_week"] for item in schedules] or any(item["start_time"]!=start_time or item["end_time"]!=end_time for item in schedules)
    # Editing dated sessions here would change tuition/attendance history. Existing calendar owns that workflow.
    if changed and scalar("SELECT COUNT(*) FROM class_sessions WHERE class_id=:id",{"id":current["id"]}):
        raise ConflictError("Lớp đã có buổi học. Hãy đổi lịch tại Lịch & phân công trước khi phân công nhân sự.")
    lecturer_id=staff_id if position=="LECTURER" else current["lecturer_id"]
    assistant_id=staff_id if position=="TEACHING_ASSISTANT" else current["assistant_id"]
    for day in days:
        _schedule_conflict(current["id"],lecturer_id,assistant_id,current["default_room_id"],day,start_time,end_time,payload["start"],current["end_date"])
    if changed:
        db.session.execute(text("DELETE FROM class_schedules WHERE class_id=:id"),{"id":current["id"]})
        for day in days:
            db.session.execute(text("INSERT INTO class_schedules(class_id,day_of_week,start_time,end_time,room_id) VALUES(:id,:day,:start,:end,:room)"),{"id":current["id"],"day":day,"start":start_time,"end":end_time,"room":current["default_room_id"]})
    column="lecturer_id" if position=="LECTURER" else "assistant_id"
    db.session.execute(text(f"UPDATE classes SET {column}=:staff WHERE id=:id"),{"staff":staff_id,"id":current["id"]})
    db.session.execute(text(f"UPDATE class_sessions SET {column}=:staff WHERE class_id=:id AND status='SCHEDULED' AND session_date>=:start"),{"staff":staff_id,"id":current["id"],"start":payload["start"]})
    audit(actor,"classes",current["id"],{column:staff_id,"effective_date":payload["start"]})
    return get_lecturer(staff_id)


def _notify(user_id,title,content,actor):
    db.session.execute(text("""INSERT INTO notifications(recipient_user_id,notification_type,title,content,created_by)
        VALUES(:user,'GENERAL',:title,:content,:actor)"""),{"user":user_id,"title":title,"content":content,"actor":actor.id})


@atomic
def stop_lecturer(staff_id,payload,actor):
    staff=_staff(staff_id)
    column="lecturer_id" if staff["position"]=="LECTURER" else "assistant_id"
    classes=rows(f"SELECT * FROM classes WITH (UPDLOCK,HOLDLOCK) WHERE {column}=:staff AND status IN ('PLANNED','ONGOING')",{"staff":staff_id})
    for class_row in classes:
        picked=payload["picks"].get(str(class_row["id"]))
        replacement=one("""SELECT sp.id FROM staff_profiles sp JOIN users u ON u.id=sp.user_id
            WHERE (u.full_name=:name OR sp.id=TRY_CONVERT(bigint,:name)) AND sp.position=:position AND sp.status='ACTIVE' AND u.status='ACTIVE' AND u.deleted_at IS NULL""",{"name":picked or "","position":staff["position"]},f'Cần chọn nhân sự thay thế cho lớp {class_row["name"]}')
        if replacement["id"]==staff_id:
            raise AppError("Nhân sự thay thế phải khác nhân sự ngừng dạy")
        for schedule in rows("SELECT * FROM class_schedules WHERE class_id=:id",{"id":class_row["id"]}):
            _schedule_conflict(class_row["id"],replacement["id"] if column=="lecturer_id" else class_row["lecturer_id"],replacement["id"] if column=="assistant_id" else class_row["assistant_id"],schedule["room_id"],schedule["day_of_week"],schedule["start_time"],schedule["end_time"],date.today(),class_row["end_date"])
        db.session.execute(text(f"UPDATE classes SET {column}=:replacement WHERE id=:id"),{"replacement":replacement["id"],"id":class_row["id"]})
        db.session.execute(text(f"UPDATE class_sessions SET {column}=:replacement WHERE class_id=:id AND status='SCHEDULED' AND session_date>=:today"),{"replacement":replacement["id"],"id":class_row["id"],"today":date.today()})
        if payload["notify"]:
            for user in rows("""SELECT DISTINCT sul.user_id FROM student_user_links sul JOIN class_enrollments ce ON ce.student_id=sul.student_id
                WHERE ce.class_id=:class AND ce.status='ACTIVE' AND sul.can_view=1""",{"class":class_row["id"]}):
                _notify(user["user_id"],"Thay đổi nhân sự lớp học",f'Lớp {class_row["name"]} được phân công lại nhân sự từ ngày {display_date(date.today())}.',actor)
    db.session.execute(text("UPDATE staff_profiles SET status='INACTIVE' WHERE id=:id"),{"id":staff_id})
    audit(actor,"staff_profiles",staff_id,{"status":"INACTIVE","replacements":payload["picks"]})
    return get_lecturer(staff_id)


def list_accounts(actor):
    return [{"id":str(row["id"]),"backendId":row["id"],"name":row["full_name"],"email":row["email"] or row["username"],"username":row["username"],
        "role":ROLE_NAMES[row["role_code"]],"status":"active" if row["status"]=="ACTIVE" else "locked","statusCode":row["status"],"self":row["id"]==actor.id,
        "last":row["last_login_at"].strftime("%d/%m/%Y %H:%M") if row["last_login_at"] else "Chưa đăng nhập",
        "loginToday":bool(row["last_login_at"] and row["last_login_at"].date()==date.today()),"lockedUntil":iso(row["locked_until"]),"lockReason":row["lock_reason"]}
        for row in rows("SELECT u.*,r.code role_code FROM users u JOIN roles r ON r.id=u.role_id WHERE u.deleted_at IS NULL ORDER BY u.id")]


@atomic
def save_account(payload,actor,user_id=None):
    from app.services.user_service import _ensure_profile_role_compatible
    role=ROLE_CODES[payload["role"]]
    if user_id is not None:
        user=db.session.get(User,user_id)
        if not user or user.deleted_at:
            raise NotFoundError("Không tìm thấy tài khoản")
        if user.id==actor.id and role!=user.role.code:
            raise ForbiddenError("Không thể tự thay đổi vai trò của mình")
        _ensure_profile_role_compatible(user_id,role)
        _unique_email(payload["email"],user_id)
    else:
        if not payload["password"]:
            raise AppError("Mật khẩu là bắt buộc khi tạo tài khoản")
        _unique_email(payload["email"])
        user=User(username="u"+uuid4().hex[:20],email=payload["email"].lower(),password_hash=hash_password(payload["password"]),full_name=payload["name"],role=db.session.scalar(select(Role).where(Role.code==role)))
        db.session.add(user)
        db.session.flush()
        user_id=user.id
    if role!=user.role.code:
        user.role=db.session.scalar(select(Role).where(Role.code==role))
        user.auth_version+=1
    user.full_name=payload["name"]
    user.email=payload["email"].lower()
    if payload["password"]:
        user.password_hash=hash_password(payload["password"])
        user.auth_version+=1
    user.updated_at=datetime.now(timezone.utc)
    db.session.flush()
    audit(actor,"users",user_id,payload)
    return next(item for item in list_accounts(actor) if item["backendId"]==user_id)


@atomic
def account_state(user_id,state,actor,payload=None):
    user=db.session.get(User,user_id)
    if not user or user.deleted_at:
        raise NotFoundError("Không tìm thấy tài khoản")
    if user_id==actor.id:
        raise ForbiddenError("Không thể khóa hoặc xóa tài khoản của chính mình")
    if state=="INACTIVE":
        if scalar("""SELECT COUNT(*) FROM classes c JOIN staff_profiles sp ON sp.id=c.lecturer_id OR sp.id=c.assistant_id
            WHERE sp.user_id=:id AND c.status IN ('PLANNED','ONGOING')""",{"id":user_id}):
            raise ConflictError("Cần phân công lại các lớp đang phụ trách trước khi xóa tài khoản")
        user.deleted_at=datetime.now(timezone.utc)
        user.deleted_by=actor.id
    user.status=state
    if not payload or payload.get("logout",True):
        user.auth_version+=1
    user.updated_at=datetime.now(timezone.utc)
    user.lock_reason=payload["reason"] if payload and state=="LOCKED" else None
    user.locked_at=datetime.now(timezone.utc) if state=="LOCKED" else None
    user.locked_by=actor.id if state=="LOCKED" else None
    user.locked_until=(datetime.now(timezone.utc)+timedelta(days=int(payload["period"]))) if payload and payload["period"]!="forever" else None
    audit(actor,"users",user_id,{"status":state,**(payload or {})})
    # Email requires an actual provider; never claim that an email was delivered.
    return {"id":str(user_id),"status":state,"emailSent":False,"message":"Đã lưu tài khoản. Chưa cấu hình dịch vụ gửi email." if payload and payload.get("mail") else "Đã lưu tài khoản"}


# These are authorization policy defaults already represented by the original UI,
# not fabricated business records. Persisted rows override them without broadening role scopes.
DEFAULT_PERMISSIONS={
    "MANAGER":[[2,2,2,2],[2,2,2,2],[2,2,2,2],[2,2,2,2],[2,0,2,0],[2,2,2,2],[2,2,2,2],[2,2,2,2],[2,2,2,2]],
    "LECTURER":[[2,0,0,0],[2,0,0,0],[2,0,0,0],[2,2,2,0],[2,2,2,0],[2,2,2,2],[2,2,2,2],[2,2,2,0],[0,0,0,0]],
    "TEACHING_ASSISTANT":[[2,0,0,0],[2,0,0,0],[2,0,0,0],[2,2,2,0],[1,1,1,0],[0,0,0,0],[2,2,0,0],[2,0,0,0],[0,0,0,0]],
    "STUDENT_PARENT":[[2,0,0,0],[2,0,0,0],[2,0,0,0],[2,0,0,0],[2,0,0,0],[0,0,0,0],[2,0,0,0],[2,0,0,0],[0,0,0,0]],
}
DEFAULT_PERMISSION_NOTES={
    "MANAGER":["Toàn trung tâm","Toàn trung tâm","Xếp lịch & phân công","Mọi lớp","Đặt thời gian · không sửa điểm của giảng viên","","","","Học phí, thu chi, tuyển sinh, giảng viên, phân quyền"],
    "LECTURER":["Chỉ học viên trong lớp mình dạy","Chỉ lớp mình phụ trách","Xem lịch giảng dạy của mình","Lớp mình dạy","Trong thời gian Manager đặt · xác nhận để công bố","Mở quyền nhập điểm · duyệt điểm trợ giảng nhập","Tài liệu của mình","","Học phí, thu chi, tuyển sinh, giảng viên, phân quyền"],
    "TEACHING_ASSISTANT":["Chỉ lớp được phân công","Chỉ lớp được phân công","Xem lịch hỗ trợ của mình","Điểm danh hỗ trợ","Chỉ khi giảng viên mở quyền · điểm cần giảng viên duyệt","Chỉ giảng viên quản lý trợ giảng","Tải lên khi được giao","","Học phí, thu chi, tuyển sinh, giảng viên, phân quyền"],
    "STUDENT_PARENT":["Chỉ hồ sơ của mình / con","Lớp đang theo học","Lịch học của mình","Xem điểm danh của mình","Chỉ khi điểm đã công bố","","Tải về tài liệu lớp mình","Nhận xét dành cho mình","Học phí, thu chi, tuyển sinh, giảng viên, phân quyền"],
}


def role_permissions(role_name,defaults=False):
    code=ROLE_CODES.get(role_name,role_name)
    if code not in DEFAULT_PERMISSIONS:
        raise NotFoundError("Không tìm thấy vai trò")
    role=one("SELECT * FROM roles WHERE code=:code",{"code":code})
    result=[]
    for index,resource in enumerate(rows("SELECT * FROM permission_resources ORDER BY sort_order,id")):
        persisted=rows("SELECT * FROM role_permissions WHERE role_id=:role AND resource_id=:resource",{"role":role["id"],"resource":resource["id"]}) if not defaults else []
        by_action={item["action_code"]:item for item in persisted}
        result.append({"resource":resource["code"],"perms":[{"DENY":0,"CONDITIONAL":1,"ALLOW":2}[by_action[action]["effect"]] if action in by_action else DEFAULT_PERMISSIONS[code][index][column] for column,action in enumerate(ACTIONS)],"note":next((item["note"] for item in persisted if item["note"]),DEFAULT_PERMISSION_NOTES[code][index])})
    return {"role":ROLE_NAMES[code],"rows":result}


@atomic
def save_permissions(role_name,payload,actor):
    code=ROLE_CODES.get(role_name,role_name)
    role=one("SELECT * FROM roles WHERE code=:code",{"code":code},"Không tìm thấy vai trò")
    resources=rows("SELECT * FROM permission_resources ORDER BY sort_order,id")
    if len(payload["rows"])!=len(resources):
        raise AppError("Số dòng quyền không khớp danh mục chức năng")
    if code=="MANAGER" and any(value!=2 for value in payload["rows"][-1]["perms"]):
        raise ConflictError("Vai trò Manager phải giữ quyền quản trị để tránh khóa quản trị hệ thống")
    for resource,row in zip(resources,payload["rows"]):
        for action,value in zip(ACTIONS,row["perms"]):
            params={"role":role["id"],"resource":resource["id"],"action":action,"effect":{0:"DENY",1:"CONDITIONAL",2:"ALLOW"}[value],"condition":"EXISTING_SCOPE" if value==1 else None,"note":row["note"] or None,"actor":actor.id}
            db.session.execute(text("""UPDATE role_permissions WITH (UPDLOCK,HOLDLOCK) SET effect=:effect,condition_code=:condition,note=:note,updated_by=:actor,updated_at=SYSDATETIMEOFFSET()
                WHERE role_id=:role AND resource_id=:resource AND action_code=:action;
                IF @@ROWCOUNT=0 INSERT INTO role_permissions(role_id,resource_id,action_code,effect,condition_code,note,updated_by)
                VALUES(:role,:resource,:action,:effect,:condition,:note,:actor)"""),params)
    audit(actor,"role_permissions",role["id"],payload)
    return role_permissions(role_name)
