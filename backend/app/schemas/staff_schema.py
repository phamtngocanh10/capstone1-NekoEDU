from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

from app.models import StaffPosition, StaffStatus


class StaffSchema(Schema):
    """Danh bạ nhân sự; rate_per_session chỉ xuất hiện với Manager."""

    id = fields.Integer()
    staff_code = fields.String()
    position = fields.String()
    specialization = fields.String(allow_none=True)
    status = fields.String()
    hire_date = fields.Date()
    rate_per_session = fields.Integer()
    user_id = fields.Integer()
    full_name = fields.String()
    email = fields.String(allow_none=True)
    phone = fields.String(allow_none=True)
    account_status = fields.String()


class StaffQuerySchema(Schema):
    position = fields.String(validate=validate.OneOf(list(StaffPosition)))
    status = fields.String(validate=validate.OneOf(list(StaffStatus)))


STAFF_CODE_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_-]*$"


class StaffCreateSchema(Schema):
    user_id = fields.Integer(required=True, strict=True, validate=validate.Range(min=1))
    staff_code = fields.String(
        required=True,
        validate=[validate.Length(min=2, max=20), validate.Regexp(STAFF_CODE_PATTERN)],
    )
    position = fields.String(required=True, validate=validate.OneOf(list(StaffPosition)))
    specialization = fields.String(allow_none=True, validate=validate.Length(max=200))
    hire_date = fields.Date(required=True)
    status = fields.String(load_default=StaffStatus.ACTIVE, validate=validate.OneOf(list(StaffStatus)))

    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        for field_name in ("staff_code", "specialization"):
            if isinstance(normalized.get(field_name), str):
                normalized[field_name] = normalized[field_name].strip()
        if normalized.get("specialization") == "":
            normalized["specialization"] = None
        return normalized


class StaffUpdateSchema(Schema):
    staff_code = fields.String(
        validate=[validate.Length(min=2, max=20), validate.Regexp(STAFF_CODE_PATTERN)]
    )
    position = fields.String(validate=validate.OneOf(list(StaffPosition)))
    specialization = fields.String(allow_none=True, validate=validate.Length(max=200))
    hire_date = fields.Date()
    status = fields.String(validate=validate.OneOf(list(StaffStatus)))

    @pre_load
    def normalize(self, data, **kwargs):
        return StaffCreateSchema().normalize(data)

    @validates_schema
    def require_change(self, data, **kwargs):
        if not data:
            raise ValidationError("Cần cung cấp ít nhất một trường để cập nhật")
