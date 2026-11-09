"""Exercise current FE GET contracts against NEKO_EDU; block SQL writes at the engine."""
from datetime import date
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from flask_jwt_extended import create_access_token
from sqlalchemy import event, select, text

from app import create_app
from app.extensions import db
from app.models import User, Role


def main():
    app = create_app('development')
    app.config['PROPAGATE_EXCEPTIONS'] = True
    outcomes = []
    with app.app_context():
        actual = db.session.execute(text('SELECT DB_NAME()')).scalar_one()
        if actual != 'NEKO_EDU':
            raise RuntimeError('Unexpected database identity')
        actors = {}
        for role in ('MANAGER', 'LECTURER'):
            user = db.session.scalar(select(User).join(User.role).where(Role.code == role, User.status == 'ACTIVE').order_by(User.id))
            if user:
                actors[role] = (user.id, {'Authorization': 'Bearer ' + create_access_token(
                    identity=user, additional_claims={'ver': user.auth_version})})
        ids = {}
        for table in ('classes', 'students', 'staff_profiles', 'class_sessions'):
            ids[table] = db.session.execute(text(f'SELECT TOP 1 id FROM {table} ORDER BY id')).scalar_one_or_none()
        ids['staff_profiles'] = db.session.execute(text("SELECT TOP 1 id FROM staff_profiles WHERE position='LECTURER' ORDER BY id")).scalar_one_or_none()
        student_code = db.session.execute(text('SELECT TOP 1 student_code FROM students ORDER BY id')).scalar_one_or_none()
        session_date = db.session.execute(text('SELECT TOP 1 session_date FROM class_sessions ORDER BY id')).scalar_one_or_none() or date.today()
        db.session.rollback()
        engine = db.engine

        def prohibit_writes(conn, cursor, statement, parameters, context, executemany):
            if not statement.lstrip().upper().startswith('SELECT'):
                raise RuntimeError('Read-only probe blocked a SQL write: ' + statement.strip().split()[0])
        event.listen(engine, 'before_cursor_execute', prohibit_writes)
        try:
            paths = [
                '/auth/me', '/manager/catalog', '/manager/courses', '/manager/classes',
                '/manager/students', '/manager/lecturers', '/manager/accounts',
                '/manager/roles/Manager/permissions', '/manager/tuition', '/manager/tuition/risks',
                '/manager/ledger', '/manager/announcements', '/manager/announcements/options',
                '/manager/dashboard', '/manager/admissions/forecast/overview',
                '/manager/admissions/retention', '/manager/admissions/dropout',
                '/manager/admissions/proposals', '/notifications', '/manager/grades/windows',
                '/manager/schedule?start=' + session_date.isoformat(),
            ]
            for table, path in [('students', '/manager/students/{id}'), ('classes', '/manager/classes/{id}'),
                                ('staff_profiles', '/manager/lecturers/{id}'),
                                ('classes', '/manager/grades/classes/{id}')]:
                if ids[table]:
                    paths.append(path.format(id=ids[table]))
            if student_code:
                paths.append(f'/manager/students/{student_code}/payments')
            for path in paths:
                probe(app, actors['MANAGER'][1], path, outcomes, 'MANAGER')
            if 'LECTURER' in actors:
                lecturer_id, headers = actors['LECTURER']
                for path in ['/auth/me', '/lecturer/classes', '/lecturer/sessions?date=' + session_date.isoformat(),
                             '/lecturer/documents', '/lecturer/assistants', '/lecturer/assistant-candidates']:
                    probe(app, headers, path, outcomes, 'LECTURER')
                class_id = db.session.execute(text('''SELECT TOP 1 c.id FROM classes c JOIN staff_profiles s
                    ON s.id=c.lecturer_id WHERE s.user_id=:user ORDER BY c.id'''), {'user': lecturer_id}).scalar_one_or_none()
                if class_id:
                    for path in [f'/lecturer/classes/{class_id}/students', f'/lecturer/classes/{class_id}/grades',
                                 f'/lecturer/classes/{class_id}/comments', f'/lecturer/classes/{class_id}/grading-window']:
                        probe(app, headers, path, outcomes, 'LECTURER')
        finally:
            event.remove(engine, 'before_cursor_execute', prohibit_writes)
            db.session.rollback()
    report = {'database': actual, 'read_only': True, 'checked': len(outcomes),
              'passed': sum(x['status'] == 200 for x in outcomes), 'results': outcomes}
    report['pending_configuration'] = sum(bool(x.get('pending_configuration')) for x in outcomes)
    report['unexpected_failures'] = report['checked'] - report['passed'] - report['pending_configuration']
    destination = Path(__file__).resolve().parents[1] / '.local-backups/integration-read-results.json'
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True))
    return 0 if report['unexpected_failures'] == 0 else 1


def probe(app, headers, path, outcomes, role):
    try:
        response = app.test_client().get('/api/v1' + path, headers=headers)
        body = response.get_json(silent=True)
        result = {'role': role, 'path': path, 'status': response.status_code}
        if response.status_code != 200:
            result['message'] = body.get('message') if isinstance(body, dict) else 'Non-JSON response'
            if (response.status_code == 404 and path.endswith('/grading-window')
                    and result['message'] == 'Manager chưa thiết lập thời gian nhập điểm cho khóa học'):
                result['pending_configuration'] = True
        outcomes.append(result)
    except Exception as exc:
        outcomes.append({'role': role, 'path': path, 'status': 500, 'error': type(exc).__name__,
                         'message': str(exc).splitlines()[0][:200]})
    finally:
        db.session.rollback()


if __name__ == '__main__':
    raise SystemExit(main())
