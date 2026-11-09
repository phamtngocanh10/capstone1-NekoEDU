"""Xác thực (JWT) và phân quyền theo role.

Dùng ở router, đặt ngay dưới @router.route để kiểm tra quyền TRƯỚC khi validate input:

    @router.route("", methods=["GET"])
    @auth_required(RoleCode.MANAGER)          # chỉ Manager
    @router.arguments(...)
    def ...

    @auth_required()                          # mọi tài khoản đã đăng nhập
    @auth_required(*STAFF_ROLES)              # Manager, Giảng viên, Trợ giảng
"""

from functools import wraps

from flask import request
from flask_jwt_extended import JWTManager, current_user, verify_jwt_in_request
from sqlalchemy import text

from app.common.errors import ForbiddenError, error_response
from app.extensions import db
from app.models import RevokedToken, RoleCode, User

MSG_MISSING_TOKEN = "Bạn chưa đăng nhập hoặc thiếu access token"
MSG_INVALID_TOKEN = "Access token không hợp lệ"
MSG_EXPIRED_TOKEN = "Access token đã hết hạn, vui lòng đăng nhập lại"
MSG_ACCOUNT_UNAVAILABLE = "Tài khoản không tồn tại hoặc đã bị khóa"
MSG_REVOKED_TOKEN = "Access token đã bị thu hồi, vui lòng đăng nhập lại"
MSG_FORBIDDEN = "Bạn không có quyền thực hiện chức năng này"


def auth_required(*roles: RoleCode):
    unknown = set(roles) - set(RoleCode)
    if unknown:
        raise ValueError(f"Role không hợp lệ: {unknown}")

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Kiểm tra token + nạp user từ DB (xem load_user bên dưới); lỗi -> 401
            verify_jwt_in_request()
            # Lấy role hiện tại trong DB, không tin role trong token (role có thể đã bị đổi)
            if roles and current_user.role.code not in roles:
                raise ForbiddenError(MSG_FORBIDDEN)
            _require_configured_permission()
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def _require_configured_permission():
    """Explicit DENY can narrow, never expand, the existing role and row scopes."""
    path = request.path.removeprefix('/api/v1/').strip('/')
    if path.startswith(('auth/', 'health', 'notifications')):
        return
    # Managers must retain a way to repair their permission configuration.
    if path.startswith('manager/roles') and current_user.role.code == RoleCode.MANAGER:
        return
    parts = path.split('/')
    section = parts[1] if parts[0] in ('manager', 'lecturer') and len(parts) > 1 else parts[0]
    resources = {
        'students': 'STUDENTS', 'guardians': 'STUDENTS',
        'courses': 'COURSES_CLASSES', 'classes': 'COURSES_CLASSES', 'catalog': 'COURSES_CLASSES',
        'schedules': 'SCHEDULES', 'schedule': 'SCHEDULES', 'sessions': 'SCHEDULES',
        'attendance': 'ATTENDANCE', 'attendances': 'ATTENDANCE',
        'grades': 'GRADES', 'grade-periods': 'GRADES', 'assessments': 'GRADES', 'results': 'GRADES',
        'assistants': 'ASSISTANTS', 'assistant-candidates': 'ASSISTANTS',
        'assistant-requests': 'ASSISTANTS', 'assistant-submissions': 'ASSISTANTS',
        'documents': 'LEARNING_MATERIALS', 'comments': 'STUDENT_COMMENTS',
        'student-comments': 'STUDENT_COMMENTS',
    }
    resource = resources.get(section, 'CENTER_ADMINISTRATION')
    # Nested class operations belong to their actual module, not the roster's module.
    for segment, code in (('attendance', 'ATTENDANCE'), ('grades', 'GRADES'), ('grading-window', 'GRADES'),
                          ('documents', 'LEARNING_MATERIALS'), ('comments', 'STUDENT_COMMENTS'),
                          ('assistants', 'ASSISTANTS')):
        if segment in parts:
            resource = code
    if section == 'grades' or (
        section in ('assistants', 'classes')
        and any(segment in parts for segment in ('submission', 'submissions', 'requests', 'review'))
    ):
        resource = 'GRADES'
    action = {'GET': 'VIEW', 'HEAD': 'VIEW', 'POST': 'CREATE',
              'PUT': 'UPDATE', 'PATCH': 'UPDATE', 'DELETE': 'DELETE'}.get(request.method)
    if action is None:
        return
    if request.method == 'POST' and parts[-1] in {
        'publish', 'unpublish', 'cancel', 'send', 'read-all', 'review', 'approve',
        'confirm', 'close', 'lock', 'unlock', 'assign', 'stop', 'share', 'download',
    }:
        action = 'UPDATE'
    if request.method == 'POST' and section == 'grades' and parts[-1] in {'import', 'remind', 'reopen'}:
        action = 'UPDATE'
    effect = db.session.execute(text('''
        SELECT rp.effect FROM role_permissions rp
        JOIN permission_resources pr ON pr.id=rp.resource_id
        WHERE rp.role_id=:role AND pr.code=:resource AND rp.action_code=:action
    '''), {'role': current_user.role_id, 'resource': resource, 'action': action}).scalar_one_or_none()
    if effect == 'DENY':
        raise ForbiddenError(MSG_FORBIDDEN)


def register_jwt_callbacks(manager: JWTManager) -> None:
    @manager.token_in_blocklist_loader
    def token_is_revoked(_jwt_header, jwt_data) -> bool:
        return db.session.query(RevokedToken.id).filter_by(jti=jwt_data.get("jti")).first() is not None

    @manager.user_identity_loader
    def user_identity(user: User) -> str:
        # Claim "sub" của JWT phải là chuỗi
        return str(user.id)

    @manager.user_lookup_loader
    def load_user(_jwt_header, jwt_data) -> User | None:
        try:
            user_id = int(jwt_data["sub"])
        except (KeyError, TypeError, ValueError):
            return None
        user = db.session.get(User, user_id)
        if user is not None and user.status == 'LOCKED':
            from app.services.auth_service import unlock_if_expired
            unlock_if_expired(user)
        # Tài khoản bị xóa/khóa sau khi đăng nhập thì token cũ không dùng được nữa
        if (
            user is None
            or not user.is_active
            or jwt_data.get("ver") != user.auth_version
        ):
            return None
        return user

    @manager.unauthorized_loader
    def missing_token(_reason):
        return error_response(401, MSG_MISSING_TOKEN)

    @manager.invalid_token_loader
    def invalid_token(_reason):
        return error_response(401, MSG_INVALID_TOKEN)

    @manager.expired_token_loader
    def expired_token(_jwt_header, _jwt_data):
        return error_response(401, MSG_EXPIRED_TOKEN)

    @manager.user_lookup_error_loader
    def user_unavailable(_jwt_header, _jwt_data):
        return error_response(401, MSG_ACCOUNT_UNAVAILABLE)

    @manager.revoked_token_loader
    def revoked_token(_jwt_header, _jwt_data):
        return error_response(401, MSG_REVOKED_TOKEN)
