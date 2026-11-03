from marshmallow import Schema, fields


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

