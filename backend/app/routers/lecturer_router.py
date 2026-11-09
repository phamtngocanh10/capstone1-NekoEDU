"""Existing Lecturer screen contracts, backed by the shared SQL domain tables."""
from functools import wraps
from io import BytesIO
import json
from datetime import timedelta

from flask import jsonify, request, send_file
from flask_jwt_extended import current_user
from flask_smorest import Blueprint
from sqlalchemy.exc import IntegrityError, DBAPIError

from app.common.errors import AppError, ConflictError
from app.extensions import db
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.services import lecturer_service as service, session_service

lecturer_bp=Blueprint('lecturer_workflows',__name__,description='Lớp và nghiệp vụ giảng viên từ SQL Server')
workflow_bp=Blueprint('manager_workflows',__name__,description='Lịch và điểm số dùng chung với giảng viên')


def payload():
    value=request.get_json(silent=True)
    if not isinstance(value,dict): raise AppError('Dữ liệu JSON không hợp lệ',422)
    return value


def transactional(function):
    @wraps(function)
    def decorated(*args,**kwargs):
        try: return function(*args,**kwargs)
        except IntegrityError as exc:
            db.session.rollback()
            raise ConflictError('Dữ liệu trùng hoặc vi phạm ràng buộc liên quan. Vui lòng tải lại và kiểm tra dữ liệu.') from exc
        except DBAPIError as exc:
            db.session.rollback()
            if any(str(code) in str(exc.orig) for code in (51011,51012,51013,51014,51015,51017)):
                raise ConflictError('Thay đổi không phù hợp thời gian hoặc quyền trợ giảng đã lưu.') from exc
            raise
        except Exception:
            db.session.rollback();raise
    return decorated


@lecturer_bp.route('/classes',methods=['GET'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
def classes(): return jsonify(service.classes(current_user))


@lecturer_bp.route('/classes/<int:cid>/students',methods=['GET'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
def roster(cid): return jsonify(service.roster(current_user,cid,service.parse_date(request.args['date']) if request.args.get('date') else None))


@lecturer_bp.route('/sessions',methods=['GET'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
def sessions(): return jsonify(service.sessions(current_user,request.args.get('date'),request.args.get('end')))


@lecturer_bp.route('/sessions/<int:sid>',methods=['GET'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
def session(sid): return jsonify(service.session(current_user,sid))


@lecturer_bp.route('/sessions/<int:sid>/attendance',methods=['GET','PUT'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
@transactional
def attendance(sid):
    return jsonify(service.save_attendance(current_user,sid,payload()) if request.method=='PUT' else service.attendance(current_user,sid))


@lecturer_bp.route('/classes/<int:cid>/grades',methods=['GET','PUT'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
@transactional
def grades(cid):
    if request.method=='PUT':
        body=payload();return jsonify(service.save_grades(current_user,cid,body.get('test'),body))
    service.process_deadlines();return jsonify(service.grades(current_user,cid,request.args.get('test','Kiểm tra giữa kỳ')))


@lecturer_bp.route('/classes/<int:cid>/comments',methods=['GET'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
def comments(cid): return jsonify(service.comments(current_user,cid))


@lecturer_bp.route('/comments',methods=['POST'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
@transactional
def add_comment(): return jsonify(service.add_comment(current_user,payload())),201


@lecturer_bp.route('/documents',methods=['GET','POST'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
@transactional
def documents():
    if request.method=='GET': return jsonify(service.documents(current_user))
    try: metadata=json.loads(request.form.get('metadata','{}'))
    except (ValueError,TypeError): raise AppError('Thông tin tài liệu không hợp lệ',422)
    if not isinstance(metadata,dict): raise AppError('Thông tin tài liệu không hợp lệ',422)
    return jsonify(service.upload_document(current_user,request.files.get('file'),metadata)),201


@lecturer_bp.route('/documents/<int:did>',methods=['PUT','DELETE'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
@transactional
def document(did):
    if request.method=='PUT': return jsonify(service.update_document(current_user,did,payload()))
    service.delete_document(current_user,did);return '',204


@lecturer_bp.route('/documents/<int:did>/download',methods=['GET'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
@transactional
def download(did):
    content,name,mime=service.download_document(current_user,did)
    return send_file(BytesIO(content),download_name=name,mimetype=mime,as_attachment=True)


@lecturer_bp.route('/assistants',methods=['GET','PUT'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
@transactional
def assistants(): return jsonify(service.save_assistant(current_user,payload()) if request.method=='PUT' else service.assistants(current_user))


@lecturer_bp.route('/assistant-candidates',methods=['GET'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
def candidates(): return jsonify(service.assistant_candidates(current_user))


@lecturer_bp.route('/classes/<int:cid>/grading-window',methods=['GET'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
def window(cid): return jsonify(service.grading_window(current_user,cid))


@lecturer_bp.route('/assistants/<int:sid>/submission',methods=['GET'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
def submission(sid): return jsonify(service.assistant_submission(current_user,sid,service.ident(request.args.get('classId'))))


@lecturer_bp.route('/assistants/<int:sid>/review',methods=['POST'])
@auth_required(RoleCode.MANAGER,RoleCode.LECTURER)
@transactional
def review(sid):
    body=payload();return jsonify(service.review_submission(current_user,sid,service.ident(body.get('classId')),body))


@lecturer_bp.route('/classes/<int:cid>/assistants/<int:sid>/requests',methods=['POST'])
@auth_required(RoleCode.TEACHING_ASSISTANT)
@transactional
def assistant_request(cid,sid): return jsonify(service.request_grading(current_user,cid,sid,payload())),201


@lecturer_bp.route('/classes/<int:cid>/assistants/<int:sid>/submissions',methods=['POST'])
@auth_required(RoleCode.TEACHING_ASSISTANT)
@transactional
def assistant_submit(cid,sid): return jsonify(service.submit_assistant_grades(current_user,cid,sid,payload())),201


@workflow_bp.route('/grades/windows',methods=['GET'])
@auth_required(RoleCode.MANAGER)
@transactional
def windows(): return jsonify(service.grade_windows(current_user))


@workflow_bp.route('/grades/windows/<group>',methods=['PUT'])
@auth_required(RoleCode.MANAGER)
@transactional
def save_window(group): return jsonify(service.save_grade_window(current_user,group,payload()))


@workflow_bp.route('/grades/classes/<int:cid>',methods=['GET','PUT'])
@auth_required(RoleCode.MANAGER)
@transactional
def manager_grades(cid):
    if request.method=='PUT':
        body=payload();return jsonify(service.save_grades(current_user,cid,body.get('test','Kiểm tra giữa kỳ'),body))
    service.process_deadlines();return jsonify(service.grades(current_user,cid,request.args.get('test','Kiểm tra giữa kỳ')))


@workflow_bp.route('/grades/classes/<int:cid>/reopen',methods=['POST'])
@auth_required(RoleCode.MANAGER)
@transactional
def reopen(cid): return jsonify(service.reopen_grades(current_user,cid,payload().get('test','Kiểm tra giữa kỳ')))


@workflow_bp.route('/grades/import',methods=['POST'])
@auth_required(RoleCode.MANAGER)
@transactional
def preview_import(): return jsonify(service.preview_grades_import(current_user,request.files.get('file'),request.form))


@workflow_bp.route('/grades/import/confirm',methods=['POST'])
@auth_required(RoleCode.MANAGER)
@transactional
def confirm_import(): return jsonify(service.confirm_grades_import(current_user,payload()))


@workflow_bp.route('/grades/remind',methods=['POST'])
@auth_required(RoleCode.MANAGER)
@transactional
def remind(): return jsonify(service.remind_grades(current_user,payload()))


@workflow_bp.route('/schedule',methods=['GET'])
@auth_required(RoleCode.MANAGER)
def manager_schedule():
    start=service.parse_date(request.args.get('start') or request.args.get('weekStart'))
    end=service.parse_date(request.args['end']) if request.args.get('end') else start+timedelta(days=6)
    return jsonify({'items':service.sessions(current_user,start.isoformat(),end.isoformat()),'freeStaff':service.free_staff(current_user,start.isoformat(),end.isoformat())})


@workflow_bp.route('/schedule/slot',methods=['GET'])
@auth_required(RoleCode.MANAGER)
def slot():
    lessons=service.sessions(current_user,request.args.get('date'))
    return jsonify([s for s in lessons if not request.args.get('slot') or s['slot']==request.args['slot']])


@workflow_bp.route('/lessons/<int:sid>/cancel',methods=['POST'])
@auth_required(RoleCode.MANAGER)
@transactional
def cancel(sid):
    return jsonify(service.cancel_calendar_session(current_user,sid,payload()))
