"""Short-lived, one-use reset links; delivery requires explicitly configured SMTP."""
from datetime import datetime, timezone
from email.message import EmailMessage
import smtplib

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import func, select, text

from app.common.errors import AppError
from app.common.security import hash_password, verify_password
from app.extensions import db
from app.models import AuditAction, AuditLog, User, UserStatus


def _signer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='neko-password-reset-v1')


def _send_recovery(recipient, link):
    config = current_app.config
    message = EmailMessage()
    message['Subject'] = 'NEKO EDU - Đặt lại mật khẩu'
    message['From'] = config['MAIL_FROM']
    message['To'] = recipient
    message.set_content(f'Mở liên kết để đặt lại mật khẩu (hiệu lực 15 phút):\n{link}\n'
                        'Nếu không yêu cầu, bạn có thể bỏ qua email này.')
    try:
        with smtplib.SMTP(config['MAIL_SERVER'], config['MAIL_PORT'], timeout=15) as smtp:
            if config['MAIL_USE_TLS']:
                smtp.starttls()
            if config['MAIL_USERNAME']:
                smtp.login(config['MAIL_USERNAME'], config['MAIL_PASSWORD'] or '')
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise AppError('Chưa gửi được email khôi phục. Vui lòng liên hệ Manager.', 503) from exc


def request_reset(email):
    if not current_app.config.get('MAIL_SERVER') or not current_app.config.get('MAIL_FROM'):
        raise AppError('Chưa cấu hình email khôi phục. Vui lòng liên hệ Manager để đặt lại mật khẩu.', 503)
    user = db.session.scalar(select(User).where(func.lower(User.email) == email.strip().lower(),
                                                User.status == UserStatus.ACTIVE))
    if user:
        token = _signer().dumps({'user_id': user.id, 'version': user.auth_version})
        _send_recovery(user.email, current_app.config['FRONTEND_URL'] + '/datlaimatkhau?token=' + token)
    return {'message': 'Nếu email đã đăng ký và tài khoản đang hoạt động, liên kết khôi phục đã được gửi.'}


def reset_password(payload, *, ip_address=None):
    try:
        claims = _signer().loads(payload['token'], max_age=15 * 60)
        user_id = int(claims['user_id'])
        version = int(claims['version'])
    except (BadSignature, SignatureExpired, KeyError, ValueError, TypeError) as exc:
        raise AppError('Liên kết khôi phục không hợp lệ hoặc đã hết hạn') from exc
    # Lock and reread before comparing auth_version, so two requests cannot reuse the same link.
    db.session.execute(text('SELECT id FROM users WITH (UPDLOCK,HOLDLOCK) WHERE id=:id'), {'id': user_id})
    user = db.session.get(User, user_id, populate_existing=True)
    if user is None or user.status != UserStatus.ACTIVE or user.auth_version != version:
        raise AppError('Liên kết khôi phục đã dùng hoặc tài khoản không hoạt động')
    if verify_password(payload['new_password'], user.password_hash):
        raise AppError('Mật khẩu mới phải khác mật khẩu hiện tại')
    user.password_hash = hash_password(payload['new_password'])
    user.auth_version += 1
    user.updated_at = datetime.now(timezone.utc)
    db.session.add(AuditLog(actor_user_id=user.id, action=AuditAction.UPDATE,
                           entity_name='users', entity_id=user.id,
                           new_data={'password_changed': True, 'mode': 'RECOVERY'}, ip_address=ip_address))
    db.session.commit()
