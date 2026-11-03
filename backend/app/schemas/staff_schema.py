from marshmallow import Schema, fields, validate

from app.models import StaffPosition, StaffStatus


class StaffSchema(Schema):
    """Danh bạ nhân sự. Không trả đơn giá lương (chỉ Manager được xem thông tin lương)."""

    id = fields.Integer()
    staff_code = fields.String()
    position = fields.String()
    specialization = fields.String(allow_none=True)
    status = fields.String()
    user_id = fields.Integer()
    full_name = fields.String(attribute="user.full_name")
    email = fields.String(attribute="user.email", allow_none=True)
    phone = fields.String(attribute="user.phone", allow_none=True)


class StaffQuerySchema(Schema):
    position = fields.String(validate=validate.OneOf(list(StaffPosition)))
    status = fields.String(validate=validate.OneOf(list(StaffStatus)))
