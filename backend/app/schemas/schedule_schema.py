from marshmallow import Schema, ValidationError, fields, validate, validates_schema


class ScheduleRoomSchema(Schema):
    id = fields.Integer()
    code = fields.String()
    name = fields.String()


class ClassScheduleSchema(Schema):
    id = fields.Integer()
    class_id = fields.Integer()
    day_of_week = fields.Integer()
    start_time = fields.Time()
    end_time = fields.Time()
    room = fields.Nested(ScheduleRoomSchema)


class ClassScheduleInputSchema(Schema):
    day_of_week = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=7))
    start_time = fields.Time(required=True)
    end_time = fields.Time(required=True)
    room_id = fields.Integer(required=True, strict=True, validate=validate.Range(min=1))

    @validates_schema
    def validate_time_range(self, data, **kwargs):
        if data.get("start_time") and data.get("end_time"):
            if data["end_time"] <= data["start_time"]:
                raise ValidationError(
                    "Giờ kết thúc phải sau giờ bắt đầu", field_name="end_time"
                )


class ClassScheduleUpdateSchema(Schema):
    day_of_week = fields.Integer(strict=True, validate=validate.Range(min=1, max=7))
    start_time = fields.Time()
    end_time = fields.Time()
    room_id = fields.Integer(strict=True, validate=validate.Range(min=1))

    @validates_schema
    def require_change(self, data, **kwargs):
        if not data:
            raise ValidationError("Cần cung cấp ít nhất một trường để cập nhật")
        if "start_time" in data and "end_time" in data:
            if data["end_time"] <= data["start_time"]:
                raise ValidationError(
                    "Giờ kết thúc phải sau giờ bắt đầu", field_name="end_time"
                )


class ClassScheduleListSchema(Schema):
    items = fields.List(fields.Nested(ClassScheduleSchema))
