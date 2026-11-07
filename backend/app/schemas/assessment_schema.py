from decimal import Decimal

from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

ASSESSMENT_TYPES = ("MONTHLY", "END_OF_LEVEL")


class AssessmentInputSchema(Schema):
    class_id = fields.Integer(required=True, strict=True, validate=validate.Range(min=1))
    level_id = fields.Integer(required=True, strict=True, validate=validate.Range(min=1))
    assessment_type = fields.String(required=True, validate=validate.OneOf(ASSESSMENT_TYPES))
    title = fields.String(required=True, validate=validate.Length(min=1, max=150))
    test_date = fields.Date(required=True)
    score_min = fields.Decimal(required=True, places=2, as_string=False)
    score_max = fields.Decimal(required=True, places=2, as_string=False)

    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if isinstance(normalized.get("title"), str):
            normalized["title"] = normalized["title"].strip()
        return normalized

    @validates_schema
    def validate_range(self, data, **kwargs):
        score_min = data.get("score_min")
        score_max = data.get("score_max")
        if score_min is not None and score_max is not None:
            if score_min < Decimal("0") or score_max <= score_min:
                raise ValidationError(
                    "score_min phải >= 0 và score_max phải lớn hơn score_min",
                    field_name="score_max",
                )


class AssessmentUpdateSchema(Schema):
    assessment_type = fields.String(validate=validate.OneOf(ASSESSMENT_TYPES))
    title = fields.String(validate=validate.Length(min=1, max=150))
    test_date = fields.Date()
    score_min = fields.Decimal(places=2, as_string=False)
    score_max = fields.Decimal(places=2, as_string=False)

    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if isinstance(normalized.get("title"), str):
            normalized["title"] = normalized["title"].strip()
        return normalized

    @validates_schema
    def require_field(self, data, **kwargs):
        if not data:
            raise ValidationError("Cần cung cấp ít nhất một trường để sửa")


class AssessmentQuerySchema(Schema):
    class_id = fields.Integer(validate=validate.Range(min=1))
    level_id = fields.Integer(validate=validate.Range(min=1))
    assessment_type = fields.String(validate=validate.OneOf(ASSESSMENT_TYPES))
    status = fields.String(validate=validate.OneOf(("DRAFT", "PUBLISHED")))
    from_date = fields.Date()
    to_date = fields.Date()

    @validates_schema
    def validate_dates(self, data, **kwargs):
        if data.get("from_date") and data.get("to_date"):
            if data["from_date"] > data["to_date"]:
                raise ValidationError("from_date không được sau to_date", field_name="from_date")


class AssessmentClassSchema(Schema):
    id = fields.Integer()
    class_code = fields.String()
    name = fields.String()


class AssessmentLevelSchema(Schema):
    id = fields.Integer()
    code = fields.String()
    name = fields.String()


class AssessmentSchema(Schema):
    id = fields.Integer()
    class_info = fields.Nested(AssessmentClassSchema, data_key="class")
    level = fields.Nested(AssessmentLevelSchema)
    assessment_type = fields.String()
    title = fields.String()
    test_date = fields.Date()
    score_min = fields.Float()
    score_max = fields.Float()
    status = fields.String()
    created_by = fields.Integer()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
    published_by = fields.Integer(allow_none=True)
    published_at = fields.DateTime(allow_none=True)


class AssessmentListSchema(Schema):
    items = fields.List(fields.Nested(AssessmentSchema))
    total = fields.Integer()


class StrictScoreField(fields.Decimal):
    def _deserialize(self, value, attr, data, **kwargs):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValidationError("Điểm phải là số, không nhận chuỗi hoặc boolean")
        return super()._deserialize(value, attr, data, **kwargs)


class AssessmentResultInputSchema(Schema):
    student_id = fields.Integer(required=True, strict=True, validate=validate.Range(min=1))
    score = StrictScoreField(required=True, places=2, as_string=False)
    comment = fields.String(allow_none=True, validate=validate.Length(max=500))

    @pre_load
    def normalize_comment(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if isinstance(normalized.get("comment"), str):
            normalized["comment"] = normalized["comment"].strip() or None
        return normalized


class AssessmentResultBulkSchema(Schema):
    items = fields.List(
        fields.Nested(AssessmentResultInputSchema),
        required=True,
        validate=validate.Length(min=1, max=500),
    )

    @validates_schema
    def unique_students(self, data, **kwargs):
        student_ids = [item["student_id"] for item in data.get("items", [])]
        if len(student_ids) != len(set(student_ids)):
            raise ValidationError("student_id không được trùng", field_name="items")


class AssessmentResultRecordSchema(Schema):
    id = fields.Integer()
    score = fields.Float()
    comment = fields.String(allow_none=True)
    recorded_by = fields.Integer()
    recorded_at = fields.DateTime()
    updated_at = fields.DateTime()


class AssessmentResultDetailSchema(AssessmentResultRecordSchema):
    assessment_id = fields.Integer()
    student_id = fields.Integer()


class AssessmentResultUpdateSchema(Schema):
    score = StrictScoreField(places=2, as_string=False)
    comment = fields.String(allow_none=True, validate=validate.Length(max=500))
    reason = fields.String(required=True, validate=validate.Length(min=1, max=500))

    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        for field_name in ("comment", "reason"):
            if isinstance(normalized.get(field_name), str):
                normalized[field_name] = normalized[field_name].strip()
                if field_name == "comment" and not normalized[field_name]:
                    normalized[field_name] = None
        return normalized

    @validates_schema
    def require_change(self, data, **kwargs):
        if "score" not in data and "comment" not in data:
            raise ValidationError("Cần cung cấp score hoặc comment", field_name="score")


class AssessmentResultStudentSchema(Schema):
    id = fields.Integer()
    student_code = fields.String()
    full_name = fields.String()


class AssessmentResultItemSchema(Schema):
    student = fields.Nested(AssessmentResultStudentSchema)
    result = fields.Nested(AssessmentResultRecordSchema, allow_none=True)


class AssessmentResultListSchema(Schema):
    assessment_id = fields.Integer()
    status = fields.String()
    score_min = fields.Float()
    score_max = fields.Float()
    items = fields.List(fields.Nested(AssessmentResultItemSchema))


class AssessmentImportConfirmSchema(Schema):
    preview_id = fields.UUID(required=True)


class AssessmentImportErrorSchema(Schema):
    row = fields.Integer(allow_none=True)
    student_code = fields.String(allow_none=True)
    field = fields.String()
    message = fields.String()


class AssessmentImportPreviewSchema(Schema):
    preview_id = fields.UUID(allow_none=True)
    assessment_id = fields.Integer()
    mode = fields.String()
    valid = fields.Boolean()
    total_rows = fields.Integer()
    create_count = fields.Integer()
    update_count = fields.Integer()
    errors = fields.List(fields.Nested(AssessmentImportErrorSchema))
    expires_at = fields.DateTime(allow_none=True)


class AssessmentImportConfirmResultSchema(Schema):
    preview_id = fields.UUID()
    assessment_id = fields.Integer()
    created = fields.Integer()
    updated = fields.Integer()
    total = fields.Integer()


class StudentAssessmentResultItemSchema(Schema):
    assessment = fields.Nested(AssessmentSchema)
    result = fields.Nested(AssessmentResultRecordSchema, allow_none=True)


class StudentAssessmentResultListSchema(Schema):
    student_id = fields.Integer()
    items = fields.List(fields.Nested(StudentAssessmentResultItemSchema))
    total = fields.Integer()
