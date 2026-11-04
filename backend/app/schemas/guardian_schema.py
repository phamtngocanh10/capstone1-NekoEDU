from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

from app.schemas.common_schema import PaginationSchema

GUARDIAN_RELATIONSHIPS = ("FATHER", "MOTHER", "GUARDIAN")


class GuardianSchema(Schema):
    id = fields.Integer()
    full_name = fields.String()
    phone = fields.String()
    email = fields.String(allow_none=True)
    relationship = fields.String()
    address = fields.String(allow_none=True)
    created_at = fields.DateTime()


class GuardianQuerySchema(Schema):
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    page_size = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
    q = fields.String(validate=validate.Length(max=100))
    relationship = fields.String(validate=validate.OneOf(GUARDIAN_RELATIONSHIPS))


class GuardianListSchema(Schema):
    items = fields.List(fields.Nested(GuardianSchema))
    pagination = fields.Nested(PaginationSchema)


class GuardianCreateSchema(Schema):
    full_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    phone = fields.String(required=True, validate=validate.Regexp(r"^0[0-9]{9}$"))
    email = fields.Email(allow_none=True, validate=validate.Length(max=150))
    relationship = fields.String(
        required=True, validate=validate.OneOf(GUARDIAN_RELATIONSHIPS)
    )
    address = fields.String(allow_none=True, validate=validate.Length(max=255))

    @pre_load
    def normalize(self, data, **kwargs):
        return _normalize(data)


class GuardianUpdateSchema(Schema):
    full_name = fields.String(validate=validate.Length(min=1, max=100))
    phone = fields.String(validate=validate.Regexp(r"^0[0-9]{9}$"))
    email = fields.Email(allow_none=True, validate=validate.Length(max=150))
    relationship = fields.String(validate=validate.OneOf(GUARDIAN_RELATIONSHIPS))
    address = fields.String(allow_none=True, validate=validate.Length(max=255))

    @pre_load
    def normalize(self, data, **kwargs):
        return _normalize(data)

    @validates_schema
    def require_change(self, data, **kwargs):
        if not data:
            raise ValidationError("Cần cung cấp ít nhất một trường để cập nhật")


def _normalize(data):
    if not isinstance(data, dict):
        return data
    normalized = dict(data)
    for field_name in ("full_name", "phone", "email", "address"):
        if isinstance(normalized.get(field_name), str):
            normalized[field_name] = normalized[field_name].strip()
            if field_name == "email":
                normalized[field_name] = normalized[field_name].lower()
            if normalized[field_name] == "" and field_name in {"email", "address"}:
                normalized[field_name] = None
    return normalized
