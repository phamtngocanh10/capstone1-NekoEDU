"""Real SQL tests; conftest requires an explicitly configured disposable *_test DB."""
from datetime import date, timedelta
from io import BytesIO
import csv

import pytest
from sqlalchemy import select, text

from app.extensions import db
from app.models import StaffProfile, User

BASE="/api/v1/manager"


@pytest.fixture
def academic(app,users,auth_header):
    with app.app_context():
        db.session.execute(text("INSERT INTO levels(code,name,min_age,max_age,sort_order) VALUES('KINDY','Kindy',3,5,0)"))
        level=db.session.execute(text("INSERT INTO levels(code,name,min_age,max_age,sort_order) OUTPUT INSERTED.id VALUES('KID_1','Kid1',6,7,1)")).scalar_one()
        group=db.session.execute(text("SELECT id FROM course_groups WHERE code='KID'")).scalar_one()
        course=db.session.execute(text("""INSERT INTO courses(course_code,name,level_id,group_id,curriculum_level,sessions_per_week,session_minutes,monthly_fee)
            OUTPUT INSERTED.id VALUES('REAL-C','Khóa KID SQL',:level,:group,1,2,90,1000000)"""),{"level":level,"group":group}).scalar_one()
        db.session.execute(text("INSERT INTO rooms(code,name,capacity) VALUES('DUMMY','Dummy',1)"))
        room=db.session.execute(text("INSERT INTO rooms(code,name,capacity) OUTPUT INSERTED.id VALUES('SQL-R','Phòng SQL',20)")).scalar_one()
        lecturer=db.session.scalar(select(StaffProfile).where(StaffProfile.user_id==users['lecturer']))
        lecturer_id=lecturer.id
        lecturer_name=lecturer.user.full_name
        db.session.commit()
    return {"headers":auth_header(users['manager']),"lecturer":lecturer_id,"lecturer_name":lecturer_name,"course":course,"room":room,"level":level,"users":users}


def class_form(academic,**overrides):
    return {"course":"Khóa KID SQL","teacher":academic["lecturer_name"],"name":"Lớp SQL mới","room":"SQL-R","cap":20,
            "days":["T2","T4"],"slot":"15:00 – 16:30","start":(date.today()+timedelta(days=1)).isoformat(),**overrides}


def make_class(client,academic,**overrides):
    response=client.post(BASE+"/classes",json=class_form(academic,**overrides),headers=academic["headers"])
    assert response.status_code==201,response.json
    return response.json


def student_form(**overrides):
    return {"fullName":"Học viên SQL thật","birth":"12/05/2016","gender":"Nữ","address":"Đà Nẵng",
        "parentName":"Phụ huynh SQL","parentPhone":"0901234567","parentRelationship":"MOTHER","email":"parent@sql.test",
        "course":"KID","className":"Lớp SQL mới","fee":"","password":"Neko@2026","note":"Ghi chú thật",**overrides}


def staff_form(**overrides):
    return {"fullName":"Giảng viên SQL","birth":"12/05/1990","gender":"Nữ","address":"Đà Nẵng","phone":"0901234568",
        "email":"newstaff@sql.test","role":"lecturer","specialty":"KID","password":"Neko@2026","contract":"Bán thời gian",
        "rate":"220000","joined":"01/01/2025",**overrides}


def test_class_create_persists_catalog_schedule_36_sessions_and_refetch(client,app,academic):
    created=make_class(client,academic)
    assert created["courseId"]=="kid"
    assert created["size"]==0
    assert created["sessionCount"]==36
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text("SELECT COUNT(*) FROM class_schedules WHERE class_id=:id"),{"id":created["backendId"]}).scalar_one()==2
        assert db.session.execute(text("SELECT COUNT(*) FROM class_sessions WHERE class_id=:id"),{"id":created["backendId"]}).scalar_one()==36
    detail=client.get(BASE+f'/classes/{created["id"]}',headers=academic["headers"])
    assert detail.status_code==200,detail.json
    assert detail.json["name"]=="Lớp SQL mới"
    assert detail.json["roster"]==[]
    courses=client.get(BASE+'/courses',headers=academic['headers']).json
    assert next(item for item in courses if item['id']=='kid')['classes']==1


def test_class_room_capacity_and_conflicts_leave_no_partial_rows(client,app,academic):
    assert client.post(BASE+'/classes',json=class_form(academic,cap=21),headers=academic['headers']).status_code==409
    created=make_class(client,academic)
    response=client.post(BASE+'/classes',json=class_form(academic,name='Trùng lịch SQL'),headers=academic['headers'])
    assert response.status_code==409,response.json
    with app.app_context():
        assert db.session.execute(text('SELECT COUNT(*) FROM classes')).scalar_one()==1
        assert db.session.execute(text('SELECT COUNT(*) FROM class_sessions')).scalar_one()==36


def test_student_guardian_account_enrollment_update_soft_delete_without_policy(client,app,academic):
    cls=make_class(client,academic)
    response=client.post(BASE+'/students',json=student_form(),headers=academic['headers'])
    assert response.status_code==201,response.json
    student=response.json
    assert student['className']==cls['name']
    assert student['invoiceState']=='pendingPolicy'
    assert student['tuition']=='pending'
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text('SELECT COUNT(*) FROM class_enrollments WHERE student_id=:id'),{'id':student['backendId']}).scalar_one()==1
        assert db.session.execute(text('SELECT COUNT(*) FROM tuition_invoices')).scalar_one()==0
        assert db.session.execute(text('SELECT COUNT(*) FROM student_user_links WHERE student_id=:id'),{'id':student['backendId']}).scalar_one()==1
        assert db.session.execute(text('SELECT full_name FROM guardians WHERE id=:id'),{'id':student['guardianId']}).scalar_one()=='Phụ huynh SQL'
    updated=client.patch(BASE+f'/students/{student["backendId"]}',json=student_form(fullName='Học viên đã sửa',parentPhone='0901234569',password=''),headers=academic['headers'])
    assert updated.status_code==200,updated.json
    persisted=client.get(BASE+f'/students/{student["id"]}',headers=academic['headers']).json
    assert persisted['name']=='Học viên đã sửa'
    assert persisted['parentPhone']=='0901234569'
    removed=client.delete(BASE+f'/students/{student["backendId"]}',headers=academic['headers'])
    assert removed.status_code==200,removed.json
    with app.app_context():
        assert db.session.execute(text('SELECT status FROM students WHERE id=:id'),{'id':student['backendId']}).scalar_one()=='DROPPED'
        assert db.session.execute(text('SELECT status FROM class_enrollments WHERE student_id=:id'),{'id':student['backendId']}).scalar_one()=='DROPPED'
        assert db.session.execute(text('SELECT COUNT(*) FROM student_user_links WHERE student_id=:id'),{'id':student['backendId']}).scalar_one()==1


def test_student_invalid_enrollment_rolls_back_profile_guardian_and_account(client,app,academic):
    cls=make_class(client,academic,cap=1)
    response=client.post(BASE+'/students',json=student_form(),headers=academic['headers'])
    assert response.status_code==201,response.json
    with app.app_context():
        before={table:db.session.execute(text(f'SELECT COUNT(*) FROM {table}')).scalar_one() for table in ('students','guardians','users','student_user_links')}
    rejected=client.post(BASE+'/students',json=student_form(fullName='Học viên quá sĩ số',parentName='Phụ huynh thứ hai',parentPhone='0901234999',email='second@sql.test'),headers=academic['headers'])
    assert rejected.status_code==409,rejected.json
    with app.app_context():
        after={table:db.session.execute(text(f'SELECT COUNT(*) FROM {table}')).scalar_one() for table in before}
    assert before==after


def test_staff_create_edit_assignment_stop_preserves_sessions(client,app,academic):
    cls=make_class(client,academic)
    response=client.post(BASE+'/lecturers',json=staff_form(),headers=academic['headers'])
    assert response.status_code==201,response.json
    staff=response.json
    changed=client.put(BASE+f'/lecturers/{staff["id"]}',json=staff_form(fullName='Giảng viên đã sửa',rate='230000',password=''),headers=academic['headers'])
    assert changed.status_code==200,changed.json
    assert changed.json['rate']==230000
    assigned=client.post(BASE+f'/lecturers/{staff["id"]}/assignments',json={'cls':cls['name'],'role':'lecturer','start':cls['start'],'days':['T2','T4'],'slot':'15:00 – 16:30'},headers=academic['headers'])
    assert assigned.status_code==200,assigned.json
    with app.app_context():
        assert db.session.execute(text('SELECT lecturer_id FROM classes WHERE id=:id'),{'id':cls['backendId']}).scalar_one()==staff['backendId']
        assert db.session.execute(text('SELECT COUNT(*) FROM class_sessions WHERE class_id=:id AND lecturer_id=:staff'),{'id':cls['backendId'],'staff':staff['backendId']}).scalar_one()==36
    stopped=client.post(BASE+f'/lecturers/{staff["id"]}/stop',json={'picks':{cls['id']:academic['lecturer_name']},'notify':True},headers=academic['headers'])
    assert stopped.status_code==200,stopped.json
    assert stopped.json['status']=='stopped'
    with app.app_context():
        assert db.session.execute(text('SELECT COUNT(*) FROM class_sessions WHERE class_id=:id'),{'id':cls['backendId']}).scalar_one()==36
        assert db.session.execute(text('SELECT lecturer_id FROM classes WHERE id=:id'),{'id':cls['backendId']}).scalar_one()==academic['lecturer']


def test_accounts_persist_password_lock_metadata_unlock_and_soft_delete(client,app,academic):
    response=client.post(BASE+'/accounts',json={'name':'Tài khoản SQL','email':'account@sql.test','role':'Student / Parent','password':'Neko@2026'},headers=academic['headers'])
    assert response.status_code==201,response.json
    account=response.json
    changed=client.put(BASE+f'/accounts/{account["id"]}',json={'name':'Tài khoản đã sửa','email':'updated@sql.test','role':'Student / Parent','password':'Changed@2026'},headers=academic['headers'])
    assert changed.status_code==200,changed.json
    locked=client.post(BASE+f'/accounts/{account["id"]}/lock',json={'reason':'Kiểm thử SQL','period':'7','logout':True,'mail':False},headers=academic['headers'])
    assert locked.status_code==200,locked.json
    with app.app_context():
        user=db.session.get(User,account['backendId'])
        assert user.status=='LOCKED'
        assert user.lock_reason=='Kiểm thử SQL'
        assert user.locked_until is not None
        assert user.auth_version>=2
    assert client.post(BASE+f'/accounts/{account["id"]}/unlock',headers=academic['headers']).status_code==200
    assert client.delete(BASE+f'/accounts/{account["id"]}',headers=academic['headers']).status_code==200
    with app.app_context():
        user=db.session.get(User,account['backendId'])
        assert user.status=='INACTIVE'
        assert user.deleted_at is not None
    assert all(item['id']!=account['id'] for item in client.get(BASE+'/accounts',headers=academic['headers']).json)


def test_permission_matrix_sql_round_trip_and_self_protection(client,app,academic):
    defaults=client.get(BASE+'/roles/Lecturer/permissions',headers=academic['headers']).json
    body={'rows':[{'perms':row['perms'],'note':'Điều kiện SQL'} for row in defaults['rows']]}
    body['rows'][0]['perms'][0]=1
    saved=client.put(BASE+'/roles/Lecturer/permissions',json=body,headers=academic['headers'])
    assert saved.status_code==200,saved.json
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text('SELECT COUNT(*) FROM role_permissions')).scalar_one()==36
        assert db.session.execute(text("SELECT COUNT(*) FROM role_permissions WHERE effect='CONDITIONAL' AND condition_code='EXISTING_SCOPE'")).scalar_one()==1
    assert client.get(BASE+'/roles/Lecturer/permissions',headers=academic['headers']).json['rows'][0]['perms'][0]==1
    assert client.post(BASE+f'/accounts/{academic["users"]["manager"]}/lock',json={'reason':'Self'},headers=academic['headers']).status_code==403


def test_student_csv_import_rolls_back_all_rows_on_error(client,app,academic):
    make_class(client,academic)
    data=student_form()
    headers=list(data)
    def line(record):
        return ','.join('"'+str(record.get(key,'')).replace('"','""')+'"' for key in headers)
    content=','.join(headers)+'\n'+line(data)+'\n'+line({**data,'fullName':'Lỗi','birth':'not-a-date'})
    response=client.post(BASE+'/students/import',data={'file':(BytesIO(content.encode('utf-8')),'students.csv')},content_type='multipart/form-data',headers=academic['headers'])
    assert response.status_code==400,response.json
    with app.app_context():
        assert db.session.execute(text('SELECT COUNT(*) FROM students')).scalar_one()==0
        assert db.session.execute(text('SELECT COUNT(*) FROM guardians')).scalar_one()==0


def test_academic_routes_reject_lecturer_and_unauthenticated(client,academic,auth_header):
    assert client.get(BASE+'/students').status_code==401
    headers=auth_header(academic['users']['lecturer'])
    for path in ('/students','/accounts','/courses','/classes','/catalog','/lecturers'):
        assert client.get(BASE+path,headers=headers).status_code==403


def test_class_update_and_empty_cancel_preserve_all_session_rows(client,app,academic):
    cls=make_class(client,academic)
    response=client.put(BASE+f'/classes/{cls["id"]}',json=class_form(academic,name='Lớp đã cập nhật SQL'),headers=academic['headers'])
    assert response.status_code==200,response.json
    assert response.json['name']=='Lớp đã cập nhật SQL'
    removed=client.delete(BASE+f'/classes/{cls["id"]}',headers=academic['headers'])
    assert removed.status_code==200,removed.json
    with app.app_context():
        assert db.session.execute(text('SELECT COUNT(*) FROM class_sessions WHERE class_id=:id'),{'id':cls['backendId']}).scalar_one()==36
        assert db.session.execute(text("SELECT COUNT(*) FROM class_sessions WHERE class_id=:id AND status='CANCELLED'"),{'id':cls['backendId']}).scalar_one()==36
    assert client.get(BASE+f'/classes/{cls["id"]}',headers=academic['headers']).json['status']=='ended'


def test_shared_guardian_phone_is_audited_and_enrolled_class_delete_is_rejected(client,app,academic):
    cls=make_class(client,academic)
    first=client.post(BASE+'/students',json=student_form(),headers=academic['headers'])
    assert first.status_code==201,first.json
    second=client.post(BASE+'/students',json=student_form(fullName='Anh chị em SQL',password=''),headers=academic['headers'])
    assert second.status_code==201,second.json
    assert first.json['guardianId']==second.json['guardianId']
    changed=client.patch(BASE+f'/students/{first.json["backendId"]}',json=student_form(parentPhone='0901234888',password=''),headers=academic['headers'])
    assert changed.status_code==200,changed.json
    assert changed.json['guardianStudents']==2
    sibling=client.get(BASE+f'/students/{second.json["id"]}',headers=academic['headers'])
    assert sibling.json['parentPhone']=='0901234888'
    assert client.delete(BASE+f'/classes/{cls["id"]}',headers=academic['headers']).status_code==409
    with app.app_context():
        assert db.session.execute(text("SELECT COUNT(*) FROM audit_logs WHERE entity_name='guardians' AND action='UPDATE'")).scalar_one()==1
        assert db.session.execute(text('SELECT COUNT(*) FROM class_enrollments')).scalar_one()==2


def test_duplicate_account_and_self_role_changes_do_not_modify_sql(client,app,academic):
    form={'name':'Tài khoản trùng','email':'duplicate@sql.test','role':'Student / Parent','password':'Neko@2026'}
    assert client.post(BASE+'/accounts',json=form,headers=academic['headers']).status_code==201
    assert client.post(BASE+'/accounts',json=form,headers=academic['headers']).status_code==409
    response=client.put(BASE+f'/accounts/{academic["users"]["manager"]}',json={**form,'email':'mg01@neko.edu.vn','role':'Lecturer'},headers=academic['headers'])
    assert response.status_code==403,response.json
    with app.app_context():
        assert db.session.execute(text("SELECT COUNT(*) FROM users WHERE email='duplicate@sql.test'")).scalar_one()==1
        assert db.session.get(User,academic['users']['manager']).role.code=='MANAGER'


def test_profile_creation_without_available_class_preserves_explicit_course_level(client,app,academic):
    response=client.post(BASE+'/students',json=student_form(course=str(academic['course']),className='',password=''),headers=academic['headers'])
    assert response.status_code==201,response.json
    assert response.json['enrollmentState']=='pending'
    assert response.json['classId'] is None
    with app.app_context():
        assert db.session.execute(text('SELECT current_level_id FROM students WHERE id=:id'),{'id':response.json['backendId']}).scalar_one()==academic['level']
        assert db.session.execute(text('SELECT COUNT(*) FROM class_enrollments')).scalar_one()==0
        assert db.session.execute(text('SELECT COUNT(*) FROM tuition_invoices')).scalar_one()==0
