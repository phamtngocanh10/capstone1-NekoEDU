from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

ATTENDANCE_STATUSES = ("PRESENT", "EXCUSED_ABSENCE", "UNEXCUSED_ABSENCE")


class AttendanceStudentSchema(Schema):
    id = fields.Integer()
    student_code = fields.String()
    full_name = fields.String()
    english_name = fields.String(allow_none=True)


class AttendanceRecordSchema(Schema):
    id = fields.Integer()
    status = fields.String()
    note = fields.String(allow_none=True)
    recorded_by = fields.Integer()
    recorded_at = fields.DateTime()


class AttendanceDetailSchema(AttendanceRecordSchema):
    session_id = fields.Integer()
    student_id = fields.Integer()


class AttendanceHistoryActorSchema(Schema):
    id = fields.Integer()
    username = fields.String()
    full_name = fields.String()


class AttendanceHistoryItemSchema(Schema):
    id = fields.Integer()
    old_status = fields.String()
    new_status = fields.String()
    old_note = fields.String(allow_none=True)
    new_note = fields.String(allow_none=True)
    changed_by = fields.Nested(AttendanceHistoryActorSchema)
    changed_at = fields.DateTime()
    reason = fields.String()


class AttendanceHistoryListSchema(Schema):
    attendance_id = fields.Integer()
    session_id = fields.Integer()
    student_id = fields.Integer()
    current_status = fields.String()
    current_note = fields.String(allow_none=True)
    items = fields.List(fields.Nested(AttendanceHistoryItemSchema))


class AttendanceReportQuerySchema(Schema):
    student_id = fields.Integer(validate=validate.Range(min=1))
    class_id = fields.Integer(validate=validate.Range(min=1))
    from_date = fields.Date()
    to_date = fields.Date()

    @validates_schema
    def validate_date_range(self, data, **kwargs):
        if data.get("from_date") and data.get("to_date"):
            if data["from_date"] > data["to_date"]:
                raise ValidationError(
                    "from_date không được sau to_date", field_name="from_date"
                )


class AttendanceReportMetricsSchema(Schema):
    total_records = fields.Integer()
    present = fields.Integer()
    excused_absence = fields.Integer()
    unexcused_absence = fields.Integer()
    absence_total = fields.Integer()
    presence_rate = fields.Float()
    absence_rate = fields.Float()


class AttendanceStudentReportSchema(AttendanceReportMetricsSchema):
    student_id = fields.Integer()
    student_code = fields.String()
    student_name = fields.String()


class AttendanceClassReportSchema(AttendanceReportMetricsSchema):
    class_id = fields.Integer()
    class_code = fields.String()
    class_name = fields.String()


class AttendanceReportFiltersSchema(Schema):
    student_id = fields.Integer(allow_none=True)
    class_id = fields.Integer(allow_none=True)
    from_date = fields.Date(allow_none=True)
    to_date = fields.Date(allow_none=True)


class AttendanceReportSchema(Schema):
    filters = fields.Nested(AttendanceReportFiltersSchema)
    summary = fields.Nested(AttendanceReportMetricsSchema)
    by_students = fields.List(fields.Nested(AttendanceStudentReportSchema))
    by_classes = fields.List(fields.Nested(AttendanceClassReportSchema))


class SessionAttendanceItemSchema(Schema):
    student = fields.Nested(AttendanceStudentSchema)
    attendance = fields.Nested(AttendanceRecordSchema, allow_none=True)


class SessionAttendanceListSchema(Schema):
    session_id = fields.Integer()
    class_id = fields.Integer()
    session_date = fields.Date()
    session_status = fields.String()
    items = fields.List(fields.Nested(SessionAttendanceItemSchema))


class AttendanceBulkItemSchema(Schema):
    student_id = fields.Integer(required=True, strict=True, validate=validate.Range(min=1))
    status = fields.String(required=True, validate=validate.OneOf(ATTENDANCE_STATUSES))
    note = fields.String(allow_none=True, validate=validate.Length(max=255))

    @pre_load
    def normalize_note(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if isinstance(normalized.get("note"), str):
            normalized["note"] = normalized["note"].strip() or None
        return normalized


class AttendanceBulkInputSchema(Schema):
    items = fields.List(
        fields.Nested(AttendanceBulkItemSchema),
        required=True,
        validate=validate.Length(min=1, max=200),
    )

    @validates_schema
    def unique_students(self, data, **kwargs):
        student_ids = [item["student_id"] for item in data.get("items", [])]
        if len(student_ids) != len(set(student_ids)):
            raise ValidationError(
                "student_id không được trùng trong cùng yêu cầu", field_name="items"
            )


class AttendanceUpdateSchema(Schema):
    status = fields.String(validate=validate.OneOf(ATTENDANCE_STATUSES))
    note = fields.String(allow_none=True, validate=validate.Length(max=255))
    reason = fields.String(required=True, validate=validate.Length(min=1, max=500))

    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        for field_name in ("note", "reason"):
            if isinstance(normalized.get(field_name), str):
                normalized[field_name] = normalized[field_name].strip()
                if field_name == "note" and normalized[field_name] == "":
                    normalized[field_name] = None
        return normalized

    @validates_schema
    def require_update_field(self, data, **kwargs):
        if "status" not in data and "note" not in data:
            raise ValidationError(
                "Cần cung cấp status hoặc note để sửa", field_name="status"
            )
