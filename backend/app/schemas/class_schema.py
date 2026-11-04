from marshmallow import Schema, ValidationError, fields, validate, validates_schema


class ClassStaffAssignmentSchema(Schema):
    lecturer_id = fields.Integer(required=True, strict=True, validate=validate.Range(min=1))
    assistant_id = fields.Integer(allow_none=True, strict=True, validate=validate.Range(min=1))

    @validates_schema
    def different_people(self, data, **kwargs):
        if data.get("assistant_id") == data.get("lecturer_id"):
            raise ValidationError(
                "Giảng viên và trợ giảng phải là hai nhân sự khác nhau",
                field_name="assistant_id",
            )


class AssignedStaffSchema(Schema):
    id = fields.Integer()
    staff_code = fields.String()
    full_name = fields.String()


class ClassStaffResponseSchema(Schema):
    id = fields.Integer()
    class_code = fields.String()
    name = fields.String()
    lecturer = fields.Nested(AssignedStaffSchema)
    assistant = fields.Nested(AssignedStaffSchema, allow_none=True)
