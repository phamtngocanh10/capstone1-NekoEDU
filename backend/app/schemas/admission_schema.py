from decimal import Decimal

from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

from app.schemas.common_schema import PaginationSchema
from app.schemas.student_schema import StudentSchema

ADMISSION_SOURCES = (
    "FACEBOOK",
    "ZALO",
    "WEBSITE",
    "REFERRAL",
    "WALK_IN",
    "SCHOOL_EVENT",
)
ADMISSION_STATUSES = ("NEW", "CONTACTED", "TESTED", "ENROLLED", "LOST")


class AdmissionLevelSchema(Schema):
    id = fields.Integer()
    code = fields.String()
    name = fields.String()


class AdmissionConsultantSchema(Schema):
    id = fields.Integer()
    username = fields.String()
    full_name = fields.String()


class AdmissionLeadSchema(Schema):
    id = fields.Integer()
    lead_code = fields.String()
    child_full_name = fields.String()
    child_dob = fields.Date(allow_none=True)
    guardian_name = fields.String()
    guardian_phone = fields.String()
    source = fields.String()
    interested_level = fields.Nested(AdmissionLevelSchema, allow_none=True)
    placement_score = fields.Float(allow_none=True)
    status = fields.String()
    student_id = fields.Integer(allow_none=True)
    consultant = fields.Nested(AdmissionConsultantSchema, allow_none=True)
    converted_at = fields.Date(allow_none=True)
    note = fields.String(allow_none=True)
    created_at = fields.DateTime()


class AdmissionLeadQuerySchema(Schema):
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    page_size = fields.Integer(load_default=20, validate=validate.Range(min=1, max=100))
    q = fields.String(validate=validate.Length(max=100))
    source = fields.String(validate=validate.OneOf(ADMISSION_SOURCES))
    status = fields.String(validate=validate.OneOf(ADMISSION_STATUSES))
    interested_level_id = fields.Integer(validate=validate.Range(min=1))
    consultant_user_id = fields.Integer(validate=validate.Range(min=1))

    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if isinstance(normalized.get("q"), str):
            normalized["q"] = normalized["q"].strip()
        return normalized


class AdmissionLeadListSchema(Schema):
    items = fields.List(fields.Nested(AdmissionLeadSchema))
    pagination = fields.Nested(PaginationSchema)


class AdmissionLeadCreateSchema(Schema):
    lead_code = fields.String(
        required=True,
        validate=[
            validate.Length(min=2, max=20),
            validate.Regexp(r"^[A-Za-z0-9][A-Za-z0-9_-]*$"),
        ],
    )
    child_full_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    child_dob = fields.Date(allow_none=True)
    guardian_name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    guardian_phone = fields.String(required=True, validate=validate.Regexp(r"^0[0-9]{9}$"))
    source = fields.String(required=True, validate=validate.OneOf(ADMISSION_SOURCES))
    interested_level_id = fields.Integer(
        allow_none=True, strict=True, validate=validate.Range(min=1)
    )
    consultant_user_id = fields.Integer(
        allow_none=True, strict=True, validate=validate.Range(min=1)
    )
    note = fields.String(allow_none=True, validate=validate.Length(max=500))

    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        for field_name in (
            "lead_code",
            "child_full_name",
            "guardian_name",
            "guardian_phone",
            "note",
        ):
            if isinstance(normalized.get(field_name), str):
                normalized[field_name] = normalized[field_name].strip()
                if normalized[field_name] == "" and field_name == "note":
                    normalized[field_name] = None
        return normalized


def _validate_placement_score(value):
    if value < 0 or value > 10:
        raise ValidationError("Điểm đầu vào phải từ 0 đến 10")
    decimal_value = Decimal(str(value))
    if decimal_value.as_tuple().exponent < -1:
        raise ValidationError("Điểm đầu vào chỉ được có tối đa một chữ số thập phân")


class AdmissionLeadUpdateSchema(Schema):
    lead_code = fields.String(
        validate=[
            validate.Length(min=2, max=20),
            validate.Regexp(r"^[A-Za-z0-9][A-Za-z0-9_-]*$"),
        ]
    )
    child_full_name = fields.String(validate=validate.Length(min=1, max=100))
    child_dob = fields.Date(allow_none=True)
    guardian_name = fields.String(validate=validate.Length(min=1, max=100))
    guardian_phone = fields.String(validate=validate.Regexp(r"^0[0-9]{9}$"))
    source = fields.String(validate=validate.OneOf(ADMISSION_SOURCES))
    interested_level_id = fields.Integer(
        allow_none=True, strict=True, validate=validate.Range(min=1)
    )
    placement_score = fields.Float(allow_none=True, validate=_validate_placement_score)
    status = fields.String(validate=validate.OneOf(("NEW", "CONTACTED", "TESTED", "LOST")))
    consultant_user_id = fields.Integer(
        allow_none=True, strict=True, validate=validate.Range(min=1)
    )
    note = fields.String(allow_none=True, validate=validate.Length(max=500))

    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        if "placement_score" in data and not (
            isinstance(data["placement_score"], (int, float))
            and not isinstance(data["placement_score"], bool)
        ) and data["placement_score"] is not None:
            raise ValidationError(
                {"placement_score": ["Điểm đầu vào phải là số, không phải chuỗi"]}
            )
        normalized = dict(data)
        for field_name in (
            "lead_code",
            "child_full_name",
            "guardian_name",
            "guardian_phone",
            "note",
        ):
            if isinstance(normalized.get(field_name), str):
                normalized[field_name] = normalized[field_name].strip()
                if normalized[field_name] == "" and field_name == "note":
                    normalized[field_name] = None
        return normalized

    @validates_schema
    def require_change(self, data, **kwargs):
        if not data:
            raise ValidationError("Cần cung cấp ít nhất một trường để cập nhật")


class AdmissionLeadConvertSchema(Schema):
    existing_student_id = fields.Integer(strict=True, validate=validate.Range(min=1))
    student_code = fields.String(
        validate=[
            validate.Length(min=2, max=10),
            validate.Regexp(r"^[A-Za-z0-9][A-Za-z0-9_-]*$"),
        ]
    )
    english_name = fields.String(allow_none=True, validate=validate.Length(max=50))
    enrolled_at = fields.Date()
    guardian_id = fields.Integer(strict=True, validate=validate.Range(min=1))
    guardian_relationship = fields.String(
        validate=validate.OneOf(("FATHER", "MOTHER", "GUARDIAN"))
    )
    guardian_email = fields.Email(allow_none=True, validate=validate.Length(max=150))
    guardian_address = fields.String(allow_none=True, validate=validate.Length(max=255))
    note = fields.String(allow_none=True, validate=validate.Length(max=500))

    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        for field_name in (
            "student_code",
            "english_name",
            "guardian_email",
            "guardian_address",
            "note",
        ):
            if isinstance(normalized.get(field_name), str):
                normalized[field_name] = normalized[field_name].strip()
                if field_name == "guardian_email":
                    normalized[field_name] = normalized[field_name].lower()
                if normalized[field_name] == "" and field_name != "student_code":
                    normalized[field_name] = None
        return normalized

    @validates_schema
    def validate_conversion_mode(self, data, **kwargs):
        creation_fields = {
            "student_code",
            "english_name",
            "enrolled_at",
            "guardian_id",
            "guardian_relationship",
            "guardian_email",
            "guardian_address",
            "note",
        }
        if "existing_student_id" in data:
            unexpected = sorted(creation_fields.intersection(data))
            if unexpected:
                raise ValidationError(
                    "Không gửi dữ liệu tạo mới khi liên kết học viên có sẵn",
                    field_name=unexpected[0],
                )
            return
        for field_name in ("student_code", "enrolled_at"):
            if field_name not in data:
                raise ValidationError("Missing data for required field.", field_name=field_name)
        if ("guardian_id" in data) == ("guardian_relationship" in data):
            raise ValidationError(
                "Cung cấp đúng một trong guardian_id hoặc guardian_relationship",
                field_name="guardian_id",
            )
        if "guardian_id" in data and any(
            field in data for field in ("guardian_email", "guardian_address")
        ):
            raise ValidationError(
                "Email/địa chỉ chỉ dùng khi tạo guardian mới",
                field_name="guardian_id",
            )


class AdmissionConversionSchema(Schema):
    lead = fields.Nested(AdmissionLeadSchema)
    student = fields.Nested(StudentSchema)

