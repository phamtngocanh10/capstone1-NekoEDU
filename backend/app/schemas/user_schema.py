from marshmallow import Schema, fields, validate

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
