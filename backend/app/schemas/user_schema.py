from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

from app.common.security import BCRYPT_MAX_BYTES

from app.models import RoleCode, UserStatus
from app.schemas.common_schema import PaginationSchema


class RoleSchema(Schema):
    code = fields.String(metadata={"example": "MANAGER"})
    name = fields.String(metadata={"example": "Quản lý trung tâm"})


class UserSchema(Schema):
    """Thông tin tài khoản trả ra API (không bao giờ có password_hash)."""

    id = fields.Integer()
    username = fields.String()
    email = fields.String(allow_none=True)
    full_name = fields.String()
    phone = fields.String(allow_none=True)
    status = fields.String()
    role = fields.Nested(RoleSchema)
    last_login_at = fields.DateTime(allow_none=True)
    created_at = fields.DateTime()


class UserQuerySchema(Schema):
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    page_size = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
    role = fields.String(validate=validate.OneOf(list(RoleCode)))
    status = fields.String(validate=validate.OneOf(list(UserStatus)))
    q = fields.String(
        validate=validate.Length(max=100),
        metadata={"description": "Tìm theo username, email hoặc họ tên"},
    )


class UserListSchema(Schema):
    items = fields.List(fields.Nested(UserSchema))
    pagination = fields.Nested(PaginationSchema)


USERNAME_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]*$"
PHONE_PATTERN = r"^0[0-9]{9}$"


class UserWriteSchema(Schema):
    username = fields.String(
        required=True,
        validate=[validate.Length(min=3, max=50), validate.Regexp(USERNAME_PATTERN)],
    )
    email = fields.Email(
        allow_none=True,
        validate=validate.Length(max=150),
    )
    password = fields.String(required=True, load_only=True, validate=validate.Length(min=8))
    full_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    phone = fields.String(allow_none=True, validate=validate.Regexp(PHONE_PATTERN))
    role = fields.String(required=True, validate=validate.OneOf(list(RoleCode)))

    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        for field_name in ("username", "email", "full_name", "phone"):
            if isinstance(normalized.get(field_name), str):
                normalized[field_name] = normalized[field_name].strip()
        if isinstance(normalized.get("email"), str):
            normalized["email"] = normalized["email"].lower() or None
        if normalized.get("phone") == "":
            normalized["phone"] = None
        return normalized

    @validates_schema
    def validate_business_rules(self, data, **kwargs):
        password = data.get("password")
        if password is not None and len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
            raise ValidationError(
                f"Mật khẩu không được dài quá {BCRYPT_MAX_BYTES} byte",
                field_name="password",
            )
        if data.get("role") != RoleCode.STUDENT_PARENT and not data.get("email"):
            raise ValidationError("Email là bắt buộc với tài khoản nhân sự", field_name="email")


class UserUpdateSchema(Schema):
    username = fields.String(
        validate=[validate.Length(min=3, max=50), validate.Regexp(USERNAME_PATTERN)]
    )
    email = fields.Email(allow_none=True, validate=validate.Length(max=150))
    full_name = fields.String(validate=validate.Length(min=1, max=100))
    phone = fields.String(allow_none=True, validate=validate.Regexp(PHONE_PATTERN))
    role = fields.String(validate=validate.OneOf(list(RoleCode)))

    @pre_load
    def normalize(self, data, **kwargs):
        return UserWriteSchema().normalize(data)

    @validates_schema
    def require_change(self, data, **kwargs):
        if not data:
            raise ValidationError("Cần cung cấp ít nhất một trường để cập nhật")


class UserStatusSchema(Schema):
    status = fields.String(required=True, validate=validate.OneOf(list(UserStatus)))


def validate_password_bytes(value: str) -> None:
    if len(value.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValidationError(f"Mật khẩu không được dài quá {BCRYPT_MAX_BYTES} byte")


class ResetPasswordSchema(Schema):
    new_password = fields.String(
        required=True,
        load_only=True,
        validate=[validate.Length(min=8), validate_password_bytes],
    )
    confirm_password = fields.String(required=True, load_only=True)

    @validates_schema
    def passwords_match(self, data, **kwargs):
        if data.get("new_password") != data.get("confirm_password"):
            raise ValidationError("Mật khẩu xác nhận không khớp", field_name="confirm_password")
