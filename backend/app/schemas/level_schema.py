from marshmallow import Schema, ValidationError, fields, validate, validates_schema


class LevelSchema(Schema):
    id = fields.Integer()
    code = fields.String()
    name = fields.String()
    min_age = fields.Integer()
    max_age = fields.Integer()
    sort_order = fields.Integer()


class LevelUpdateSchema(Schema):
    name = fields.String(validate=validate.Length(min=1, max=100))
    min_age = fields.Integer(strict=True, validate=validate.Range(min=0, max=100))
    max_age = fields.Integer(strict=True, validate=validate.Range(min=0, max=100))

    @validates_schema
    def validate_payload(self, data, **kwargs):
        if not data:
            raise ValidationError("Cần cung cấp ít nhất một trường để cập nhật")
        if "min_age" in data and "max_age" in data and data["max_age"] < data["min_age"]:
            raise ValidationError("max_age phải lớn hơn hoặc bằng min_age", field_name="max_age")
