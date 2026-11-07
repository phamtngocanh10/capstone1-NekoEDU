from datetime import date

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import contains_eager

from app.common.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.extensions import db
from app.models import AuditAction, AuditLog, Role, RoleCode, STAFF_ROLES, StaffProfile, User


def list_staff(
    *,
    actor: User,
    position: str | None = None,
    status: str | None = None,
) -> list[dict]:
    stmt = (
        select(StaffProfile)
        .join(StaffProfile.user)
        .options(contains_eager(StaffProfile.user))
        .order_by(StaffProfile.staff_code)
    )
    if position:
        stmt = stmt.where(StaffProfile.position == position)
    if status:
        stmt = stmt.where(StaffProfile.status == status)
    profiles = db.session.scalars(stmt).unique().all()
    can_view_rate = actor.role.code == RoleCode.MANAGER
    return [_directory_entry(profile, can_view_rate=can_view_rate) for profile in profiles]


def _directory_entry(profile: StaffProfile, *, can_view_rate: bool) -> dict:
    entry = {
        "id": profile.id,
        "staff_code": profile.staff_code,
        "position": profile.position,
        "specialization": profile.specialization,
        "status": profile.status,
        "hire_date": profile.hire_date,
        "user_id": profile.user_id,
        "full_name": profile.user.full_name,
        "email": profile.user.email,
        "phone": profile.user.phone,
        "account_status": profile.user.status,
    }
    if can_view_rate:
        entry["rate_per_session"] = int(profile.rate_per_session)
    return entry


def get_staff_detail(staff_id: int) -> dict:
    profile = _get_staff(staff_id)
    return _directory_entry(profile, can_view_rate=True)


def create_staff(payload: dict, *, actor: User, ip_address: str | None) -> dict:
    user = db.session.get(User, payload["user_id"])
    if user is None:
        raise NotFoundError("Không tìm thấy tài khoản")
    if user.role.code not in STAFF_ROLES:
        raise ConflictError("Chỉ tài khoản nhân sự mới được tạo hồ sơ staff")
    if user.role.code != payload["position"]:
        raise ConflictError("Position phải khớp với role tài khoản")
    if not user.email:
        raise ConflictError("Tài khoản nhân sự phải có email")
    if db.session.scalar(select(StaffProfile.id).where(StaffProfile.user_id == user.id)) is not None:
        raise ConflictError("Tài khoản đã có hồ sơ nhân sự")
    _ensure_staff_code_unique(payload["staff_code"])
    _ensure_hire_date(payload["hire_date"])

    profile = StaffProfile(
        user=user,
        staff_code=payload["staff_code"],
        position=payload["position"],
        specialization=payload.get("specialization"),
        hire_date=payload["hire_date"],
        status=payload["status"],
    )
    db.session.add(profile)
    try:
        db.session.flush()
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.CREATE,
                entity_name="staff_profiles",
                entity_id=profile.id,
                new_data=_audit_snapshot(profile),
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Tài khoản hoặc mã nhân sự đã được sử dụng") from exc
    return _directory_entry(profile, can_view_rate=True)


def update_staff(
    staff_id: int,
    payload: dict,
    *,
    actor: User,
    ip_address: str | None,
) -> dict:
    profile = _get_staff(staff_id)
    old_data = _audit_snapshot(profile)
    if "staff_code" in payload:
        _ensure_staff_code_unique(payload["staff_code"], exclude_staff_id=profile.id)
    if "hire_date" in payload:
        _ensure_hire_date(payload["hire_date"])
    if "position" in payload and payload["position"] != profile.position:
        if profile.user_id == actor.id:
            raise ForbiddenError("Manager không thể tự thay đổi position của chính mình")
        _ensure_position_change_safe(profile.id, payload["position"])
        role = db.session.scalar(select(Role).where(Role.code == payload["position"]))
        if role is None:
            raise ConflictError("Role tương ứng không tồn tại")
        profile.position = payload["position"]
        profile.user.role = role
        profile.user.auth_version += 1

    for field_name in ("staff_code", "specialization", "hire_date", "status"):
        if field_name in payload:
            setattr(profile, field_name, payload[field_name])
    try:
        db.session.flush()
        db.session.add(
            AuditLog(
                actor_user_id=actor.id,
                action=AuditAction.UPDATE,
                entity_name="staff_profiles",
                entity_id=profile.id,
                old_data=old_data,
                new_data=_audit_snapshot(profile),
                ip_address=ip_address,
            )
        )
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError("Mã nhân sự đã được sử dụng") from exc
    return _directory_entry(profile, can_view_rate=True)


def _get_staff(staff_id: int) -> StaffProfile:
    stmt = (
        select(StaffProfile)
        .join(StaffProfile.user)
        .options(contains_eager(StaffProfile.user))
        .where(StaffProfile.id == staff_id)
    )
    profile = db.session.scalar(stmt)
    if profile is None:
        raise NotFoundError("Không tìm thấy hồ sơ nhân sự")
    return profile


def _ensure_staff_code_unique(code: str, *, exclude_staff_id: int | None = None) -> None:
    stmt = select(StaffProfile.id).where(func.lower(StaffProfile.staff_code) == code.lower())
    if exclude_staff_id is not None:
        stmt = stmt.where(StaffProfile.id != exclude_staff_id)
    if db.session.scalar(stmt) is not None:
        raise ConflictError("Mã nhân sự đã tồn tại")


def _ensure_hire_date(value: date) -> None:
    if value > date.today():
        raise AppError("Ngày vào làm không được ở tương lai")


def _ensure_position_change_safe(staff_id: int, new_position: str) -> None:
    assignment = db.session.execute(
        text(
            """
            SELECT TOP 1
                CASE
                    WHEN lecturer_id = :staff_id THEN 'LECTURER'
                    WHEN assistant_id = :staff_id THEN 'TEACHING_ASSISTANT'
                END
            FROM classes
            WHERE lecturer_id = :staff_id OR assistant_id = :staff_id
            """
        ),
        {"staff_id": staff_id},
    ).scalar_one_or_none()
    if assignment is not None and assignment != new_position:
        raise ConflictError(
            "Không thể đổi position khi nhân sự vẫn đang được phân công lớp"
        )


def _audit_snapshot(profile: StaffProfile) -> dict:
    return {
        "user_id": profile.user_id,
        "staff_code": profile.staff_code,
        "position": profile.position,
        "specialization": profile.specialization,
        "hire_date": profile.hire_date.isoformat(),
        "status": profile.status,
    }
