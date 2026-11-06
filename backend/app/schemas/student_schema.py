from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

from app.common.security import BCRYPT_MAX_BYTES
from app.schemas.common_schema import PaginationSchema

STUDENT_STATUSES = ("ACTIVE", "ON_HOLD", "DROPPED", "GRADUATED")
STUDENT_LINK_RELATIONSHIPS = ("SELF", "FATHER", "MOTHER", "GUARDIAN")


class StudentLevelSchema(Schema):
    id = fields.Integer()
    code = fields.String()
    name = fields.String()


class StudentGuardianSchema(Schema):
    id = fields.Integer()
    full_name = fields.String()
    phone = fields.String()
    email = fields.String(allow_none=True)
    relationship = fields.String()


class StudentSchema(Schema):
    id = fields.Integer()
    student_code = fields.String()
    full_name = fields.String()
    english_name = fields.String(allow_none=True)
    date_of_birth = fields.Date()
    enrolled_at = fields.Date()
    status = fields.String()
    note = fields.String(allow_none=True)
    user_id = fields.Integer(allow_none=True)
    level = fields.Nested(StudentLevelSchema)
    guardian = fields.Nested(StudentGuardianSchema)


class StudentQuerySchema(Schema):
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    page_size = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
    q = fields.String(validate=validate.Length(max=100))
    level_id = fields.Integer(validate=validate.Range(min=1))
    status = fields.String(validate=validate.OneOf(STUDENT_STATUSES))
    class_id = fields.Integer(validate=validate.Range(min=1))


class StudentListSchema(Schema):
    items = fields.List(fields.Nested(StudentSchema))
    pagination = fields.Nested(PaginationSchema)


class GuardianInputSchema(Schema):
    full_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    phone = fields.String(required=True, validate=validate.Regexp(r"^0[0-9]{9}$"))
    email = fields.Email(allow_none=True, validate=validate.Length(max=150))
    relationship = fields.String(
        required=True, validate=validate.OneOf(("FATHER", "MOTHER", "GUARDIAN"))
    )
    address = fields.String(allow_none=True, validate=validate.Length(max=255))

    @pre_load
    def normalize(self, data, **kwargs):
        return _normalize_strings(data, ("full_name", "phone", "email", "address"))


class StudentAccountInputSchema(Schema):
    username = fields.String(
        required=True,
        validate=[
            validate.Length(min=3, max=50),
            validate.Regexp(r"^[A-Za-z0-9][A-Za-z0-9._-]*$"),
        ],
    )
    email = fields.Email(allow_none=True, validate=validate.Length(max=150))
    password = fields.String(required=True, load_only=True, validate=validate.Length(min=8))
    full_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    phone = fields.String(allow_none=True, validate=validate.Regexp(r"^0[0-9]{9}$"))

    @pre_load
    def normalize(self, data, **kwargs):
        return _normalize_strings(data, ("username", "email", "full_name", "phone"))

    @validates_schema
    def password_size(self, data, **kwargs):
        password = data.get("password")
        if password and len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
            raise ValidationError(
                f"Mật khẩu không được dài quá {BCRYPT_MAX_BYTES} byte",
                field_name="password",
            )


class StudentCreateSchema(Schema):
    student_code = fields.String(
        required=True,
        validate=[
            validate.Length(min=2, max=10),
            validate.Regexp(r"^[A-Za-z0-9][A-Za-z0-9_-]*$"),
        ],
    )
    full_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    english_name = fields.String(allow_none=True, validate=validate.Length(max=50))
    date_of_birth = fields.Date(required=True)
    current_level_id = fields.Integer(required=True, strict=True, validate=validate.Range(min=1))
    enrolled_at = fields.Date(required=True)
    guardian_id = fields.Integer(strict=True, validate=validate.Range(min=1))
    guardian = fields.Nested(GuardianInputSchema)
    user_id = fields.Integer(allow_none=True, strict=True, validate=validate.Range(min=1))
    account = fields.Nested(StudentAccountInputSchema)
    account_relationship = fields.String(
        load_default="GUARDIAN", validate=validate.OneOf(STUDENT_LINK_RELATIONSHIPS)
    )
    account_can_view = fields.Boolean(load_default=True, truthy={True}, falsy={False})
    status = fields.String(load_default="ACTIVE", validate=validate.OneOf(STUDENT_STATUSES))
    note = fields.String(allow_none=True, validate=validate.Length(max=500))

    @pre_load
    def normalize(self, data, **kwargs):
        return _normalize_strings(
            data, ("student_code", "full_name", "english_name", "note")
        )

    @validates_schema
    def validate_choices(self, data, **kwargs):
        if ("guardian_id" in data) == ("guardian" in data):
            raise ValidationError(
                "Cung cấp đúng một trong guardian_id hoặc guardian",
                field_name="guardian_id",
            )
        if data.get("user_id") is not None and "account" in data:
            raise ValidationError(
                "Chỉ được cung cấp user_id hoặc account",
                field_name="user_id",
            )
        if data.get("user_id") is None and "account" not in data:
            if "account_relationship" in data or "account_can_view" in data:
                # load_default luôn hiện diện sau deserialize; chỉ bỏ qua khi không có link.
                data.pop("account_relationship", None)
                data.pop("account_can_view", None)


class StudentLinkSchema(Schema):
    relationship = fields.String(
        required=True, validate=validate.OneOf(STUDENT_LINK_RELATIONSHIPS)
    )
    can_view = fields.Boolean(load_default=True, truthy={True}, falsy={False})


class StudentLinkResponseSchema(Schema):
    id = fields.Integer()
    user_id = fields.Integer()
    student_id = fields.Integer()
    relationship = fields.String()
    can_view = fields.Boolean()
    created_at = fields.DateTime()


class StudentUpdateSchema(Schema):
    student_code = fields.String(
        validate=[
            validate.Length(min=2, max=10),
            validate.Regexp(r"^[A-Za-z0-9][A-Za-z0-9_-]*$"),
        ]
    )
    full_name = fields.String(validate=validate.Length(min=1, max=100))
    english_name = fields.String(allow_none=True, validate=validate.Length(max=50))
    date_of_birth = fields.Date()
    enrolled_at = fields.Date()
    guardian_id = fields.Integer(strict=True, validate=validate.Range(min=1))
    status = fields.String(validate=validate.OneOf(STUDENT_STATUSES))
    note = fields.String(allow_none=True, validate=validate.Length(max=500))

    @pre_load
    def normalize(self, data, **kwargs):
        return _normalize_strings(
            data, ("student_code", "full_name", "english_name", "note")
        )

    @validates_schema
    def require_change(self, data, **kwargs):
        if not data:
            raise ValidationError("Cần cung cấp ít nhất một trường để cập nhật")


class StudentLevelTransferInputSchema(Schema):
    new_level_id = fields.Integer(required=True, strict=True, validate=validate.Range(min=1))
    effective_date = fields.Date(required=True)
    reason = fields.String(required=True, validate=validate.Length(min=1, max=500))

    @pre_load
    def normalize(self, data, **kwargs):
        return _normalize_strings(data, ("reason",))


class StudentLevelTransferSchema(Schema):
    id = fields.Integer()
    student_id = fields.Integer()
    old_level = fields.Nested(StudentLevelSchema)
    new_level = fields.Nested(StudentLevelSchema)
    effective_date = fields.Date()
    reason = fields.String()
    transferred_by = fields.Integer()
    created_at = fields.DateTime()


class LearningHistoryClassSchema(Schema):
    id = fields.Integer()
    code = fields.String()
    name = fields.String()


class LearningHistoryCourseSchema(Schema):
    id = fields.Integer()
    code = fields.String()
    name = fields.String()


class LearningHistoryEnrollmentSchema(Schema):
    id = fields.Integer()
    class_info = fields.Nested(
        LearningHistoryClassSchema, attribute="class", data_key="class"
    )
    course = fields.Nested(LearningHistoryCourseSchema)
    level = fields.Nested(StudentLevelSchema)
    enrolled_date = fields.Date()
    left_date = fields.Date(allow_none=True)
    status = fields.String()


class PlacementAssessmentSchema(Schema):
    lead_id = fields.Integer()
    lead_code = fields.String()
    score = fields.Float(allow_none=True)
    status = fields.String()
    assessed_level = fields.Nested(StudentLevelSchema, allow_none=True)


class LearningHistoryAssessmentSchema(Schema):
    id = fields.Integer()
    title = fields.String()
    assessment_type = fields.String()
    test_date = fields.Date()
    status = fields.String()


class LearningHistoryAssessmentResultSchema(Schema):
    id = fields.Integer()
    assessment = fields.Nested(LearningHistoryAssessmentSchema)
    class_info = fields.Nested(
        LearningHistoryClassSchema, attribute="class", data_key="class"
    )
    level = fields.Nested(StudentLevelSchema)
    score = fields.Float()
    comment = fields.String(allow_none=True)
    recorded_at = fields.DateTime()
    updated_at = fields.DateTime()


class StudentLearningHistorySchema(Schema):
    student_id = fields.Integer()
    current_level = fields.Nested(StudentLevelSchema)
    level_transfers = fields.List(fields.Nested(StudentLevelTransferSchema))
    enrollments = fields.List(fields.Nested(LearningHistoryEnrollmentSchema))
    placement_assessment = fields.Nested(PlacementAssessmentSchema, allow_none=True)
    assessment_results = fields.List(fields.Nested(LearningHistoryAssessmentResultSchema))


def _normalize_strings(data, field_names):
    if not isinstance(data, dict):
        return data
    normalized = dict(data)
    for field_name in field_names:
        if isinstance(normalized.get(field_name), str):
            normalized[field_name] = normalized[field_name].strip()
            if field_name in {"email"}:
                normalized[field_name] = normalized[field_name].lower()
            if normalized[field_name] == "" and field_name not in {"full_name", "student_code", "username"}:
                normalized[field_name] = None
    return normalized
