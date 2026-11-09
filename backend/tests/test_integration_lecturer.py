"""Real SQL round trips for the existing Lecturer/Manager workflow contracts.

Uses only conftest's verified, explicitly configured disposable *_test database.
"""
import json
from datetime import datetime, timedelta
from decimal import Decimal
from io import BytesIO
from zoneinfo import ZoneInfo

import pytest
from openpyxl import Workbook
from sqlalchemy import select, text

from app.extensions import db
from app.models import StaffPosition, StaffProfile

PREFIX='/api/v1'
TZ=ZoneInfo('Asia/Ho_Chi_Minh')


def insert(table, values):
    columns=','.join(f'[{key}]' for key in values)
    names=','.join(f':{key}' for key in values)
    return db.session.execute(text(f'''SET NOCOUNT ON;
        DECLARE @ids TABLE(id BIGINT);
        INSERT INTO [{table}]({columns}) OUTPUT INSERTED.id INTO @ids VALUES({names});
        SET NOCOUNT OFF;SELECT id FROM @ids;'''),values).scalar_one()


@pytest.fixture
def workflow(app, users, create_staff):
    outsider=create_staff('gv_workflow_out',StaffPosition.LECTURER,'GV-WF-OUT')
    now=datetime.now(TZ)
    with app.app_context():
        # The suite resets identities to zero; public API IDs are positive.
        for table in ('levels','courses','rooms','guardians','classes','students','class_sessions',
                      'assessments','assessment_grading_periods','class_assistant_assignments',
                      'assistant_grading_requests','assistant_grading_grants','assistant_grade_submissions',
                      'stored_files','teaching_documents','student_comments'):
            db.session.execute(text(f"DBCC CHECKIDENT ('dbo.{table}', RESEED, 10) WITH NO_INFOMSGS"))
        staff={p.user_id:p.id for p in db.session.scalars(select(StaffProfile))}
        level=insert('levels',dict(code='KID_1',name='Kid 1',min_age=6,max_age=10,sort_order=1))
        group=db.session.execute(text("SELECT id FROM course_groups WHERE code='KID'")).scalar_one()
        course=insert('courses',dict(course_code='WF-COURSE',level_id=level,name='Workflow course',sessions_per_week=2,session_minutes=90,monthly_fee=1000000,group_id=group,curriculum_level=1))
        room=insert('rooms',dict(code='WF-ROOM',name='Workflow room',capacity=20))
        guardian=insert('guardians',dict(full_name='Workflow parent',phone='0901000001',relationship='MOTHER'))
        cid=insert('classes',dict(class_code='WF-CLASS',name='Workflow class',course_id=course,lecturer_id=staff[users['lecturer']],assistant_id=staff[users['assistant']],default_room_id=room,max_students=20,start_date=(now-timedelta(days=180)).date(),end_date=(now+timedelta(days=180)).date(),status='ONGOING'))
        db.session.execute(text("INSERT INTO class_schedules(class_id,day_of_week,start_time,end_time,room_id) VALUES(:cid,1,'17:00','18:30',:room)"),dict(cid=cid,room=room))
        students=[]
        for index in (1,2):
            sid=insert('students',dict(student_code=f'WF{index:03d}',full_name=f'Workflow student {index}',date_of_birth='2018-01-01',guardian_id=guardian,user_id=users['student'] if index==1 else None,current_level_id=level,enrolled_at=(now-timedelta(days=180)).date(),status='ACTIVE'))
            db.session.execute(text("INSERT INTO class_enrollments(class_id,student_id,enrolled_date,status) VALUES(:cid,:sid,:date,'ACTIVE')"),dict(cid=cid,sid=sid,date=(now-timedelta(days=180)).date()))
            students.append(sid)
        sessions=[]
        for offset in (-1,1):
            sessions.append(insert('class_sessions',dict(class_id=cid,session_date=(now+timedelta(days=offset)).date(),start_time='17:00',end_time='18:30',room_id=room,lecturer_id=staff[users['lecturer']],assistant_id=staff[users['assistant']],status='SCHEDULED')))
        db.session.commit()
    return dict(class_id=cid,course=course,students=students,past=sessions[0],future=sessions[1],assistant=staff[users['assistant']],outsider=outsider,now=now)


def auth(users,auth_header,role='lecturer'): return auth_header(users[role])


def scores(workflow, values=(7,6.5,6,8)):
    return [{'studentId':str(sid),'scores':list(values),'note':'SQL round trip'} for sid in workflow['students']]


def save_grade(client,headers,workflow,status='draft',**extra):
    return client.put(f"{PREFIX}/lecturer/classes/{workflow['class_id']}/grades",headers=headers,
                      json={'test':'Kiểm tra giữa kỳ','status':status,'rows':scores(workflow),**extra})


def set_window(client,headers,workflow,**extra):
    return client.put(f'{PREFIX}/manager/grades/windows/kid',headers=headers,json={
        'term':'Giữa kỳ','opensAt':(workflow['now']-timedelta(days=2)).isoformat(),
        'closesAt':(workflow['now']+timedelta(days=2)).isoformat(),'mode':'confirm',**extra})


def test_workflow_read_contracts_and_scope(client,users,auth_header,workflow):
    headers=auth(users,auth_header)
    cid=workflow['class_id']
    classes=client.get(f'{PREFIX}/lecturer/classes',headers=headers).get_json()
    assert len(classes)==1 and classes[0]['id']==str(cid) and classes[0]['days']==[0]
    roster=client.get(f'{PREFIX}/lecturer/classes/{cid}/students',headers=headers).get_json()
    assert {s['id'] for s in roster}==set(map(str,workflow['students']))
    assert all(s['rate']==0 for s in roster)
    assert client.get(f'{PREFIX}/lecturer/classes/{cid}/comments',headers=auth_header(workflow['outsider'])).status_code==403
    assert client.get(f'{PREFIX}/lecturer/classes/{cid}/grades',headers=headers).get_json()['rows'][0]['scores']==['']*4
    future=client.get(f"{PREFIX}/lecturer/sessions/{workflow['future']}",headers=headers).get_json()
    assert future['id']==str(workflow['future']) and future['time']=='17:00-18:30'
    day=future['iso']
    assert len(client.get(f'{PREFIX}/lecturer/sessions?date={day}',headers=headers).get_json())==1
    manager=auth(users,auth_header,'manager')
    calendar=client.get(f'{PREFIX}/manager/schedule?weekStart={day}',headers=manager)
    assert calendar.status_code==200 and calendar.get_json()['items'][0]['id']==future['id']
    assert client.get(f'{PREFIX}/manager/schedule/slot?date={day}&slot=17:00-19:00',headers=manager).get_json()[0]['id']==future['id']
    assert client.get(f'{PREFIX}/lecturer/classes/{cid}/grading-window',headers=headers).status_code==404
    assert client.get(f'{PREFIX}/manager/grades/windows',headers=manager).status_code==200
    assert client.get(f'{PREFIX}/lecturer/assistant-candidates',headers=headers).get_json()[0]['id']==str(workflow['assistant'])


def test_workflow_grades_draft_reloads_four_skills_and_scalar_publication(app,client,users,auth_header,workflow):
    headers=auth(users,auth_header)
    saved=save_grade(client,headers,workflow)
    assert saved.status_code==200
    assert saved.get_json()['rows'][0]['scores']==[7,6.5,6,8]
    aid=saved.get_json()['assessmentId']
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text('SELECT COUNT(*) FROM assessment_skill_results WHERE assessment_id=:id'),dict(id=aid)).scalar_one()==2
    published=save_grade(client,headers,workflow,'published',version=saved.get_json()['version'])
    assert published.status_code==200 and published.get_json()['status']=='published'
    assert save_grade(client,headers,workflow).status_code==409
    manager=auth(users,auth_header,'manager')
    assert client.get(f"{PREFIX}/manager/grades/classes/{workflow['class_id']}",headers=manager).get_json()['status']=='published'
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text('SELECT score FROM assessment_results WHERE assessment_id=:id'),dict(id=aid)).scalars().all()==[Decimal('6.88')]*2
    assert client.post(f"{PREFIX}/manager/grades/classes/{workflow['class_id']}/reopen",headers=manager,json={}).get_json()['status']=='draft'


def test_workflow_invalid_grades_roll_back_new_assessment_and_stale_updates(app,client,users,auth_header,workflow):
    headers=auth(users,auth_header)
    invalid=scores(workflow);invalid[1]['scores']=[6,6,6,9.5]
    assert save_grade(client,headers,workflow,rows=invalid).status_code==422
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text('SELECT COUNT(*) FROM assessments')).scalar_one()==0
    first=save_grade(client,headers,workflow).get_json()
    assert save_grade(client,headers,workflow,version='0000000000000000').status_code==409
    loaded=client.get(f"{PREFIX}/lecturer/classes/{workflow['class_id']}/grades",headers=headers).get_json()
    assert loaded['rows']==first['rows']


def test_workflow_period_configuration_window_bounds_and_reminders(app,client,users,auth_header,workflow):
    manager=auth(users,auth_header,'manager');lecturer=auth(users,auth_header)
    # Keep the open-state assertion away from the two-day closing boundary;
    # SQL/API execution time otherwise makes an exact +2 days window closing.
    configured=set_window(client,manager,workflow,closesAt=(workflow['now']+timedelta(days=3)).isoformat())
    assert configured.status_code==200
    card=next(c for c in configured.get_json() if c['id']=='kid')
    assert card['total']==1 and card['state']=='open'
    window=client.get(f"{PREFIX}/lecturer/classes/{workflow['class_id']}/grading-window",headers=lecturer)
    assert window.status_code==200 and window.get_json()['test']=='Giữa kỳ'
    assert save_grade(client,lecturer,workflow).status_code==200
    old=set_window(client,manager,workflow,opensAt=(workflow['now']-timedelta(days=4)).isoformat(),closesAt=(workflow['now']-timedelta(days=3)).isoformat())
    assert old.status_code==200
    assert save_grade(client,lecturer,workflow).status_code==409
    assert save_grade(client,manager,workflow).status_code==200
    reminder=client.post(f'{PREFIX}/manager/grades/remind',headers=manager,json={'courseId':'kid'})
    assert reminder.status_code==200 and reminder.get_json()['sent']==1
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text("SELECT COUNT(*) FROM notifications WHERE title=N'Nhắc nhập điểm'")).scalar_one()==1


def test_workflow_attendance_roundtrip_edit_history_and_recalculation(app,client,users,auth_header,workflow):
    headers=auth(users,auth_header);url=f"{PREFIX}/lecturer/sessions/{workflow['past']}/attendance"
    assert client.get(url,headers=headers).get_json() is None
    records=[{'studentId':str(sid),'status':'late' if index==0 else 'absent','note':'Traffic'} for index,sid in enumerate(workflow['students'])]
    assert client.put(url,headers=headers,json={'records':records}).status_code==200
    saved=client.get(url,headers=headers).get_json()
    assert saved['records']==records
    records[1]['status']='present'
    assert client.put(url,headers=headers,json={'records':records}).status_code==200
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text('SELECT COUNT(*) FROM attendance_histories')).scalar_one()==1
        assert db.session.execute(text("SELECT COUNT(*) FROM tuition_recalculation_requests WHERE status='PENDING'")).scalar_one()==1
    assert client.put(f"{PREFIX}/lecturer/sessions/{workflow['future']}/attendance",headers=headers,json={'records':records}).status_code==409
    assert client.put(url,headers=headers,json={'records':records[:1]}).status_code==422


def test_workflow_comments_persist_and_validate_membership(app,client,users,auth_header,workflow):
    headers=auth(users,auth_header);cid=workflow['class_id']
    body={'classId':str(cid),'studentId':str(workflow['students'][0]),'text':'Tiến bộ ở kỹ năng nói'}
    saved=client.post(f'{PREFIX}/lecturer/comments',headers=headers,json=body)
    assert saved.status_code==201 and saved.get_json()['text']==body['text']
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text('SELECT content FROM student_comments')).scalar_one()==body['text']
    assert client.get(f'{PREFIX}/lecturer/classes/{cid}/comments',headers=headers).get_json()[0]['id']==saved.get_json()['id']
    assert client.post(f'{PREFIX}/lecturer/comments',headers=headers,json={**body,'studentId':'999999'}).status_code==422


def test_workflow_document_bytes_rename_share_history_and_soft_delete(app,client,users,auth_header,workflow):
    headers=auth(users,auth_header);content=b'%PDF-1.4\nSQL workflow bytes\n'
    saved=client.post(f'{PREFIX}/lecturer/documents',headers=headers,data={
        'file':(BytesIO(content),'exercise.pdf'),'metadata':json.dumps({'name':'exercise.pdf','classIds':[str(workflow['class_id'])]})},content_type='multipart/form-data')
    assert saved.status_code==201
    did=saved.get_json()['id']
    assert client.get(f'{PREFIX}/lecturer/documents/{did}/download',headers=auth_header(workflow['outsider'])).status_code==403
    response=client.get(f'{PREFIX}/lecturer/documents/{did}/download',headers=headers)
    assert response.status_code==200 and response.data==content
    renamed=client.put(f'{PREFIX}/lecturer/documents/{did}',headers=headers,json={'name':'renamed.pdf','classIds':[str(workflow['class_id'])]})
    assert renamed.status_code==200 and renamed.get_json()['downloads']==1 and len(renamed.get_json()['events'])==3
    assert client.put(f'{PREFIX}/lecturer/documents/{did}',headers=headers,json={'classIds':[]}).status_code==422
    with app.app_context():
        db.session.remove()
        assert bytes(db.session.execute(text('SELECT content FROM stored_files')).scalar_one())==content
    assert client.delete(f'{PREFIX}/lecturer/documents/{did}',headers=headers).status_code==204
    assert client.get(f'{PREFIX}/lecturer/documents',headers=headers).get_json()==[]
    with app.app_context():
        assert db.session.execute(text('SELECT COUNT(*) FROM stored_files')).scalar_one()==1
        assert db.session.execute(text('SELECT deleted_at FROM teaching_documents')).scalar_one() is not None


def test_workflow_assistant_assignment_grant_request_submit_review(app,client,users,auth_header,workflow):
    lecturer=auth(users,auth_header);manager=auth(users,auth_header,'manager');assistant=auth(users,auth_header,'assistant')
    assert set_window(client,manager,workflow).status_code==200
    grade=save_grade(client,lecturer,workflow).get_json()
    body={'id':str(workflow['assistant']),'classId':str(workflow['class_id']),'permissions':['attendance','roster'],'open':False}
    assert client.put(f'{PREFIX}/lecturer/assistants',headers=lecturer,json=body).status_code==200
    request_url=f"{PREFIX}/lecturer/classes/{workflow['class_id']}/assistants/{workflow['assistant']}/requests"
    assert client.post(request_url,headers=assistant,json={'assessmentId':grade['assessmentId'],'note':'Hỗ trợ chấm bài'}).status_code==201
    assert client.post(request_url,headers=assistant,json={'assessmentId':grade['assessmentId']}).status_code==409
    allowed={**body,'open':True,'request':False,'start':(workflow['now']-timedelta(hours=1)).isoformat(),'end':(workflow['now']+timedelta(hours=1)).isoformat()}
    grant=client.put(f'{PREFIX}/lecturer/assistants',headers=lecturer,json=allowed)
    assert grant.status_code==200 and grant.get_json()[0]['open']
    with app.app_context():
        gid=db.session.execute(text('SELECT id FROM assistant_grading_grants WHERE revoked_at IS NULL')).scalar_one()
    submission_url=f"{PREFIX}/lecturer/classes/{workflow['class_id']}/assistants/{workflow['assistant']}/submissions"
    submitted=client.post(submission_url,headers=assistant,json={'grantId':str(gid),'rows':scores(workflow,(8,8,8,8))})
    assert submitted.status_code==201
    read=client.get(f"{PREFIX}/lecturer/assistants/{workflow['assistant']}/submission?classId={workflow['class_id']}",headers=lecturer)
    assert read.status_code==200 and read.get_json()['rows'][0]['scores']==[8]*4
    approved=client.post(f"{PREFIX}/lecturer/assistants/{workflow['assistant']}/review",headers=lecturer,json={'classId':str(workflow['class_id']),'approve':True,'rows':scores(workflow,(1,1,1,1))})
    assert approved.status_code==200 and not approved.get_json()[0]['pending']
    # Caller cannot replace the persisted assistant submission with forged rows.
    latest=client.get(f"{PREFIX}/lecturer/classes/{workflow['class_id']}/grades",headers=lecturer).get_json()
    assert latest['rows'][0]['scores']==[8]*4 and latest['status']=='pending'
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text('SELECT status FROM assistant_grading_requests')).scalar_one()=='APPROVED'
        assert db.session.execute(text('SELECT status FROM assistant_grade_submissions')).scalar_one()=='APPROVED'


def test_workflow_excel_preview_import_atomic_and_cancel_notifications(app,client,users,auth_header,workflow):
    manager=auth(users,auth_header,'manager')
    workbook=Workbook();sheet=workbook.active;sheet.title='Workflow class'
    sheet.append(['Mã học viên','Nghe','Đọc','Nói','Viết'])
    sheet.append(['WF001',7,7.5,6,8]);sheet.append(['WF002',6,6.5,7,8])
    stream=BytesIO();workbook.save(stream);stream.seek(0)
    preview=client.post(f'{PREFIX}/manager/grades/import',headers=manager,data={'file':(stream,'scores.xlsx')},content_type='multipart/form-data')
    assert preview.status_code==200 and preview.get_json()['total']==2
    batches=preview.get_json()['sheets']
    for batch in batches:
        batch['rows']=[{'studentId':r['studentId'],'scores':r['scores']} for r in batch['rows']]
    imported=client.post(f'{PREFIX}/manager/grades/import/confirm',headers=manager,json={'sheets':batches,'overwrite':True})
    assert imported.status_code==200 and imported.get_json()['imported']==2
    cancelled=client.post(f"{PREFIX}/manager/lessons/{workflow['future']}/cancel",headers=manager,json={'reason':'Giảng viên báo nghỉ','note':'Sắp xếp lịch sau','notify':True,'makeup':True})
    assert cancelled.status_code==200 and cancelled.get_json()['status']=='cancelled' and cancelled.get_json()['makeupRequested']
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text("SELECT COUNT(*) FROM notifications WHERE notification_type='SCHEDULE'")).scalar_one()==1
        assert db.session.execute(text("SELECT COUNT(*) FROM notifications WHERE notification_type='REQUEST'")).scalar_one()==1


def test_workflow_scheduled_release_reminder_and_auto_lock_setting(app,client,users,auth_header,workflow):
    from app.services import lecturer_service
    manager=auth(users,auth_header,'manager');lecturer=auth(users,auth_header)
    now=workflow['now']
    setup=set_window(client,manager,workflow,mode='timed',closesAt=(now+timedelta(hours=12)).isoformat(),publishesAt=(now+timedelta(hours=1)).isoformat())
    assert setup.status_code==200
    # Processing the deadline twice creates exactly one in-app reminder.
    with app.app_context():
        first=lecturer_service.process_deadlines();second=lecturer_service.process_deadlines()
        assert first['published']==0 and second['reminders']==0
        assert db.session.execute(text("SELECT COUNT(*) FROM notifications WHERE title LIKE N'Nhắc nhập điểm:%'")).scalar_one()==1
    confirmed=save_grade(client,lecturer,workflow,'published')
    assert confirmed.status_code==200 and confirmed.get_json()['status']=='pending' and confirmed.get_json()['confirmedAt']
    assert save_grade(client,lecturer,workflow).status_code==409
    with app.app_context():
        db.session.execute(text("UPDATE assessment_grading_periods SET publishes_at=:at"),{'at':(now-timedelta(minutes=1)).isoformat()});db.session.commit()
        assert lecturer_service.process_deadlines()['published']==1
        db.session.remove()
        assert db.session.execute(text('SELECT status FROM assessments')).scalar_one()=='PUBLISHED'
    assert client.post(f"{PREFIX}/manager/grades/classes/{workflow['class_id']}/reopen",headers=manager,json={}).status_code==200
    closed=set_window(client,manager,workflow,opensAt=(now-timedelta(days=4)).isoformat(),closesAt=(now-timedelta(days=3)).isoformat(),autoLock=False)
    assert closed.status_code==200
    assert save_grade(client,lecturer,workflow).status_code==200


def test_workflow_assistant_reject_return_revoke_and_bad_window_rollback(app,client,users,auth_header,workflow):
    manager=auth(users,auth_header,'manager');lecturer=auth(users,auth_header);assistant=auth(users,auth_header,'assistant')
    assert set_window(client,manager,workflow).status_code==200
    grade=save_grade(client,lecturer,workflow).get_json();cid=workflow['class_id'];sid=workflow['assistant']
    body={'id':str(sid),'classId':str(cid),'permissions':['attendance','roster'],'open':False}
    assert client.put(f'{PREFIX}/lecturer/assistants',headers=lecturer,json=body).status_code==200
    url=f'{PREFIX}/lecturer/classes/{cid}/assistants/{sid}'
    assert client.post(url+'/requests',headers=assistant,json={'assessmentId':grade['assessmentId']}).status_code==201
    rejected=client.put(f'{PREFIX}/lecturer/assistants',headers=lecturer,json={**body,'request':False})
    assert rejected.status_code==200 and not rejected.get_json()[0]['request']
    with app.app_context():
        assert db.session.execute(text('SELECT status FROM assistant_grading_requests')).scalar_one()=='REJECTED'
    bad={**body,'open':True,'start':(workflow['now']-timedelta(days=8)).isoformat(),'end':(workflow['now']+timedelta(hours=1)).isoformat()}
    assert client.put(f'{PREFIX}/lecturer/assistants',headers=lecturer,json=bad).status_code==422
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text('SELECT COUNT(*) FROM assistant_grading_grants')).scalar_one()==0
    valid={**bad,'start':(workflow['now']-timedelta(hours=1)).isoformat()}
    assert client.put(f'{PREFIX}/lecturer/assistants',headers=lecturer,json=valid).status_code==200
    with app.app_context(): gid=db.session.execute(text('SELECT id FROM assistant_grading_grants WHERE revoked_at IS NULL')).scalar_one()
    assert client.post(url+'/submissions',headers=assistant,json={'grantId':str(gid),'rows':scores(workflow,(8,8,8,8))}).status_code==201
    review=f'{PREFIX}/lecturer/assistants/{sid}/review'
    assert client.post(review,headers=lecturer,json={'classId':str(cid),'approve':False,'reason':''}).status_code==422
    assert client.post(review,headers=lecturer,json={'classId':str(cid),'approve':False,'reason':'Kiểm tra lại kỹ năng nghe'}).status_code==200
    current=client.get(f'{PREFIX}/lecturer/classes/{cid}/grades',headers=lecturer).get_json()
    assert current['rows'][0]['scores']==[7,6.5,6,8]
    assert client.put(f'{PREFIX}/lecturer/assistants',headers=lecturer,json=body).status_code==200
    assert client.post(url+'/submissions',headers=assistant,json={'grantId':str(gid),'rows':scores(workflow)}).status_code==403


def test_workflow_invalid_document_and_multi_class_import_roll_back(app,client,users,auth_header,workflow):
    lecturer=auth(users,auth_header);manager=auth(users,auth_header,'manager')
    body={'name':'invalid.pdf','classIds':[str(workflow['class_id']),'999999']}
    assert client.post(f'{PREFIX}/lecturer/documents',headers=lecturer,data={'file':(BytesIO(b'%PDF-1.4'), 'invalid.pdf'),'metadata':json.dumps(body)},content_type='multipart/form-data').status_code==404
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text('SELECT COUNT(*) FROM stored_files')).scalar_one()==0
    first={'classId':str(workflow['class_id']),'test':'Kiểm tra giữa kỳ','rows':scores(workflow)}
    second={**first,'classId':'999999'}
    response=client.post(f'{PREFIX}/manager/grades/import/confirm',headers=manager,json={'sheets':[first,second],'overwrite':True})
    assert response.status_code==404
    with app.app_context():
        db.session.remove()
        assert db.session.execute(text('SELECT COUNT(*) FROM assessments')).scalar_one()==0
        assert db.session.execute(text('SELECT COUNT(*) FROM assessment_skill_results')).scalar_one()==0
