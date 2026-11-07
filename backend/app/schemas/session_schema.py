from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

from app.schemas.common_schema import PaginationSchema
from app.schemas.schedule_schema import ScheduleRoomSchema


SESSION_DB_STATUSES = ("SCHEDULED", "COMPLETED", "CANCELLED")


class SessionStaffSchema(Schema):
    id = fields.Integer()
    staff_code = fields.String()
    full_name = fields.String()


class ClassSessionSchema(Schema):
    id = fields.Integer()
    class_id = fields.Integer()
    session_date = fields.Date()
    start_time = fields.Time()
    end_time = fields.Time()
    room = fields.Nested(ScheduleRoomSchema)
    lecturer = fields.Nested(SessionStaffSchema)
    assistant = fields.Nested(SessionStaffSchema, allow_none=True)
    status = fields.String()
    display_status = fields.String()
    note = fields.String(allow_none=True)


class SessionGenerationInputSchema(Schema):
    date_from = fields.Date()
    date_to = fields.Date()

    @validates_schema
    def validate_range(self, data, **kwargs):
        if data.get("date_from") and data.get("date_to"):
            if data["date_to"] < data["date_from"]:
                raise ValidationError(
                    "Ngày kết thúc phải từ ngày bắt đầu trở đi", field_name="date_to"
                )


class SessionGenerationResultSchema(Schema):
    class_id = fields.Integer()
    date_from = fields.Date()
    date_to = fields.Date()
    created_count = fields.Integer()
    skipped_count = fields.Integer()
    sessions = fields.List(fields.Nested(ClassSessionSchema))


class SessionQuerySchema(Schema):
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    page_size = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
    class_id = fields.Integer(validate=validate.Range(min=1))
    student_id = fields.Integer(validate=validate.Range(min=1))
    staff_id = fields.Integer(validate=validate.Range(min=1))
    room_id = fields.Integer(validate=validate.Range(min=1))
    date_from = fields.Date()
    date_to = fields.Date()
    status = fields.String(validate=validate.OneOf(SESSION_DB_STATUSES))

    @validates_schema
    def validate_range(self, data, **kwargs):
        if data.get("date_from") and data.get("date_to"):
            if data["date_to"] < data["date_from"]:
                raise ValidationError(
                    "Ngày kết thúc phải từ ngày bắt đầu trở đi", field_name="date_to"
                )


class SessionListSchema(Schema):
    items = fields.List(fields.Nested(ClassSessionSchema))
    pagination = fields.Nested(PaginationSchema)


class SessionCreateSchema(Schema):
    session_date = fields.Date(required=True)
    start_time = fields.Time(required=True)
    end_time = fields.Time(required=True)
    room_id = fields.Integer(strict=True, validate=validate.Range(min=1))
    lecturer_id = fields.Integer(strict=True, validate=validate.Range(min=1))
    assistant_id = fields.Integer(allow_none=True, strict=True, validate=validate.Range(min=1))
    note = fields.String(allow_none=True, validate=validate.Length(max=255))

    @validates_schema
    def validate_values(self, data, **kwargs):
        if data.get("start_time") and data.get("end_time"):
            if data["end_time"] <= data["start_time"]:
                raise ValidationError(
                    "Giờ kết thúc phải sau giờ bắt đầu", field_name="end_time"
                )
        if data.get("assistant_id") is not None:
            if data.get("assistant_id") == data.get("lecturer_id"):
                raise ValidationError(
                    "Giảng viên và trợ giảng phải khác nhau", field_name="assistant_id"
                )


class SessionUpdateSchema(Schema):
    session_date = fields.Date()
    start_time = fields.Time()
    end_time = fields.Time()
    room_id = fields.Integer(strict=True, validate=validate.Range(min=1))
    lecturer_id = fields.Integer(strict=True, validate=validate.Range(min=1))
    assistant_id = fields.Integer(allow_none=True, strict=True, validate=validate.Range(min=1))
    note = fields.String(allow_none=True, validate=validate.Length(max=255))

    @validates_schema
    def validate_values(self, data, **kwargs):
        if not data:
            raise ValidationError("Cần cung cấp ít nhất một trường để cập nhật")
        if "start_time" in data and "end_time" in data:
            if data["end_time"] <= data["start_time"]:
                raise ValidationError(
                    "Giờ kết thúc phải sau giờ bắt đầu", field_name="end_time"
                )
        if data.get("assistant_id") is not None:
            if data.get("assistant_id") == data.get("lecturer_id"):
                raise ValidationError(
                    "Giảng viên và trợ giảng phải khác nhau", field_name="assistant_id"
                )


class SessionCancelSchema(Schema):
    reason = fields.String(required=True, validate=validate.Length(min=1, max=255))

    @pre_load
    def normalize_reason(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if isinstance(normalized.get("reason"), str):
            normalized["reason"] = normalized["reason"].strip()
        return normalized
