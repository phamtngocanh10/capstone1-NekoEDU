from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema


class TuitionCycleGenerateSchema(Schema):
    enrollment_id = fields.Integer(required=True, strict=True, validate=validate.Range(min=1))


class TuitionCycleSessionSchema(Schema):
    sequence_no = fields.Integer()
    id = fields.Integer()
    session_date = fields.Date()
    start_time = fields.Time()
    end_time = fields.Time()
    status = fields.String()


class TuitionCycleStudentSchema(Schema):
    id = fields.Integer()
    student_code = fields.String()
    full_name = fields.String()


class TuitionCycleClassSchema(Schema):
    id = fields.Integer()
    class_code = fields.String()
    name = fields.String()


class TuitionCycleSchema(Schema):
    id = fields.Integer()
    enrollment_id = fields.Integer()
    cycle_number = fields.Integer()
    student = fields.Nested(TuitionCycleStudentSchema)
    class_info = fields.Nested(TuitionCycleClassSchema, data_key="class")
    start_session_id = fields.Integer()
    end_session_id = fields.Integer()
    start_date = fields.Date()
    end_date = fields.Date()
    status = fields.String()
    policy_id = fields.Integer(allow_none=True)
    created_by = fields.Integer()
    created_at = fields.DateTime()
    calculated_at = fields.DateTime(allow_none=True)
    issued_at = fields.DateTime(allow_none=True)
    base_amount = fields.Integer(allow_none=True)
    policy_discount_amount = fields.Integer(allow_none=True)
    absence_credit_amount = fields.Integer(allow_none=True)
    cancellation_credit_amount = fields.Integer(allow_none=True)
    manual_adjustment_amount = fields.Integer(allow_none=True)
    final_amount = fields.Integer(allow_none=True)
    sessions = fields.List(fields.Nested(TuitionCycleSessionSchema))


class TuitionInvoiceSchema(Schema):
    id = fields.Integer()
    invoice_code = fields.String()
    tuition_cycle_id = fields.Integer()
    student_id = fields.Integer()
    class_id = fields.Integer()
    billing_month = fields.Date()
    base_amount = fields.Integer()
    discount_amount = fields.Integer()
    policy_discount_snapshot = fields.Integer()
    absence_credit_snapshot = fields.Integer()
    cancellation_credit_snapshot = fields.Integer()
    manual_adjustment_snapshot = fields.Integer()
    final_amount = fields.Integer()
    paid_amount = fields.Integer()
    due_date = fields.Date()
    status = fields.String()
    generated_by = fields.String()
    discount_policy_id = fields.Integer(allow_none=True)
    created_at = fields.DateTime()


class TuitionCycleIssueSchema(Schema):
    cycle = fields.Nested(TuitionCycleSchema)
    invoice = fields.Nested(TuitionInvoiceSchema)
    notifications_created = fields.Integer()


class SiblingRelationshipInputSchema(Schema):
    sibling_student_id = fields.Integer(required=True, strict=True, validate=validate.Range(min=0))
    valid_from = fields.Date(required=True)
    valid_to = fields.Date(allow_none=True)
    reason = fields.String(required=True, validate=validate.Length(min=1, max=500))

    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if isinstance(normalized.get("reason"), str):
            normalized["reason"] = normalized["reason"].strip()
        return normalized

    @validates_schema
    def validate_dates(self, data, **kwargs):
        if data.get("valid_to") and data.get("valid_from"):
            if data["valid_to"] < data["valid_from"]:
                raise ValidationError("valid_to không được trước valid_from", field_name="valid_to")


class SiblingRelationshipSchema(Schema):
    id = fields.Integer()
    student_id = fields.Integer()
    sibling_student_id = fields.Integer()
    valid_from = fields.Date()
    valid_to = fields.Date(allow_none=True)
    status = fields.String()
    reason = fields.String()
    approved_by = fields.Integer()
    created_at = fields.DateTime()


class ManualTuitionAdjustmentInputSchema(Schema):
    amount = fields.Integer(
        required=True,
        strict=True,
        validate=validate.Range(min=-999999999999, max=999999999999),
    )
    reason = fields.String(required=True, validate=validate.Length(min=1, max=500))

    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if isinstance(normalized.get("reason"), str):
            normalized["reason"] = normalized["reason"].strip()
        return normalized

    @validates_schema
    def validate_amount(self, data, **kwargs):
        if data.get("amount") == 0:
            raise ValidationError("amount phải khác 0", field_name="amount")


class TuitionAdjustmentSchema(Schema):
    id = fields.Integer()
    cycle_id = fields.Integer()
    source_cycle_id = fields.Integer(allow_none=True)
    session_id = fields.Integer(allow_none=True)
    adjustment_type = fields.String()
    amount = fields.Integer()
    status = fields.String()
    reason = fields.String()
    approved_by = fields.Integer(allow_none=True)
    created_by = fields.Integer()
    created_at = fields.DateTime()
    reversed_adjustment_id = fields.Integer(allow_none=True)


class ManualTuitionAdjustmentResultSchema(Schema):
    adjustment = fields.Nested(TuitionAdjustmentSchema)
    cycle = fields.Nested(TuitionCycleSchema)


class TuitionCycleListSchema(Schema):
    items = fields.List(fields.Nested(TuitionCycleSchema))
    total = fields.Integer()


class TuitionAdjustmentListSchema(Schema):
    items = fields.List(fields.Nested(TuitionAdjustmentSchema))
    total = fields.Integer()


class TuitionPolicyInputSchema(Schema):
    eligible_absence_statuses = fields.List(
        fields.String(
            validate=validate.OneOf(["EXCUSED_ABSENCE", "UNEXCUSED_ABSENCE"])
        ),
        required=True,
        validate=validate.Length(min=1, max=2),
    )
    cancellation_after_issue_mode = fields.String(
        allow_none=True,
        validate=validate.OneOf(["RECALCULATE_UNPAID", "CREDIT_NEXT_CYCLE"]),
    )
    effective_from = fields.Date(required=True)
    effective_to = fields.Date(allow_none=True)

    @validates_schema
    def validate_policy(self, data, **kwargs):
        statuses = data.get("eligible_absence_statuses", [])
        if len(statuses) != len(set(statuses)):
            raise ValidationError(
                "eligible_absence_statuses không được trùng",
                field_name="eligible_absence_statuses",
            )
        if data.get("effective_to") and data.get("effective_from"):
            if data["effective_to"] < data["effective_from"]:
                raise ValidationError(
                    "effective_to không được trước effective_from",
                    field_name="effective_to",
                )


class TuitionPolicySchema(Schema):
    id = fields.Integer()
    version = fields.Integer()
    base_amount = fields.Integer()
    sessions_per_cycle = fields.Integer()
    unit_amount = fields.Integer()
    absence_threshold = fields.Integer()
    eligible_absence_statuses = fields.List(fields.String())
    cancellation_after_issue_mode = fields.String(allow_none=True)
    effective_from = fields.Date()
    effective_to = fields.Date(allow_none=True)
    created_by = fields.Integer()
    created_at = fields.DateTime()


class TuitionPolicyListSchema(Schema):
    items = fields.List(fields.Nested(TuitionPolicySchema))
    total = fields.Integer()
