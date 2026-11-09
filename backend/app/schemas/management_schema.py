"""Inputs for the existing Manager forms (camel-case is the UI contract)."""
from datetime import date, datetime

from marshmallow import Schema, ValidationError, fields, pre_load, validate

from app.common.security import BCRYPT_MAX_BYTES


class FormDate(fields.Date):
    def _deserialize(self, value, attr, data, **kwargs):
        if value in (None, ""):
            if self.allow_none:
                return None
            raise ValidationError("Ngày là bắt buộc")
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        for pattern in ("%Y-%m-%d", "%d/%m/%Y"):
            try:
                return datetime.strptime(str(value), pattern).date()
            except ValueError:
                pass
        raise ValidationError("Ngày phải theo định dạng dd/mm/yyyy")


def password_size(value):
    if value and (len(value) < 8 or len(value.encode("utf-8")) > BCRYPT_MAX_BYTES):
        raise ValidationError("Mật khẩu cần ít nhất 8 ký tự, tối đa 72 byte")


class FormSchema(Schema):
    @pre_load
    def normalize(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        return {key: value.strip() if isinstance(value, str) and key != "password" else value
                for key, value in data.items()}


class ClassFormSchema(FormSchema):
    course = fields.String(required=True, validate=validate.Length(min=1, max=150))
    teacher = fields.String(required=True, validate=validate.Length(min=1, max=100))
    name = fields.String(required=True, validate=validate.Length(min=1, max=50))
    room = fields.String(required=True, validate=validate.Length(min=1, max=100))
    cap = fields.Integer(load_default=20, validate=validate.Range(min=1, max=32767))
    days = fields.List(fields.String(validate=validate.OneOf(["T2", "T3", "T4", "T5", "T6", "T7", "CN"])), required=True, validate=validate.Length(min=1, max=7))
    slot = fields.String(required=True)
    start = FormDate(required=True)


class StudentFormSchema(FormSchema):
    fullName = fields.String(required=True, validate=validate.Length(min=1, max=100))
    birth = FormDate(required=True)
    gender = fields.String(load_default="Nam", validate=validate.OneOf(["Nam", "Nữ", "Khác"]))
    address = fields.String(load_default="", validate=validate.Length(max=255))
    parentPhone = fields.String(required=True)
    parentName = fields.String(load_default="", validate=validate.Length(max=100))
    parentRelationship = fields.String(load_default="GUARDIAN", validate=validate.OneOf(["FATHER", "MOTHER", "GUARDIAN"]))
    email = fields.String(load_default="", validate=validate.Length(max=150))
    course = fields.String(required=True)
    className = fields.String(required=True)
    fee = fields.Integer(allow_none=True, load_default=None, validate=validate.Range(min=0))
    password = fields.String(load_default="", load_only=True, validate=password_size)
    note = fields.String(load_default="", validate=validate.Length(max=500))

    @pre_load
    def empty_fee(self, data, **kwargs):
        if isinstance(data, dict) and data.get("fee") == "":
            data = {**data, "fee": None}
        return data


class StaffFormSchema(FormSchema):
    fullName = fields.String(required=True, validate=validate.Length(min=1, max=100))
    birth = FormDate(allow_none=True, load_default=None)
    gender = fields.String(load_default="Nam", validate=validate.OneOf(["Nam", "Nữ", "Khác"]))
    address = fields.String(load_default="", validate=validate.Length(max=255))
    phone = fields.String(required=True, validate=validate.Regexp(r"^0[0-9]{9}$"))
    email = fields.Email(required=True, validate=validate.Length(max=150))
    role = fields.String(required=True, validate=validate.OneOf(["lecturer", "assistant"]))
    specialty = fields.String(load_default="", validate=validate.Length(max=200))
    password = fields.String(load_default="", load_only=True, validate=password_size)
    contract = fields.String(load_default="Toàn thời gian", validate=validate.OneOf(["Toàn thời gian", "Bán thời gian", "Thời vụ"]))
    rate = fields.Integer(required=True, validate=validate.Range(min=0, max=999999999999))
    joined = FormDate(required=True)


class AssignmentFormSchema(FormSchema):
    cls = fields.String(required=True)
    role = fields.String(required=True, validate=validate.OneOf(["lecturer", "assistant"]))
    start = FormDate(required=True)
    days = fields.List(fields.String(validate=validate.OneOf(["T2", "T3", "T4", "T5", "T6", "T7", "CN"])), required=True, validate=validate.Length(min=1))
    slot = fields.String(required=True)


class StopStaffSchema(Schema):
    picks = fields.Dict(keys=fields.String(), values=fields.String(), load_default=dict)
    notify = fields.Boolean(load_default=True)


class AccountFormSchema(FormSchema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    email = fields.Email(required=True, validate=validate.Length(max=150))
    role = fields.String(required=True, validate=validate.OneOf(["Manager", "Lecturer", "Teaching Assistant", "Student / Parent"]))
    password = fields.String(load_default="", load_only=True, validate=password_size)


class LockFormSchema(FormSchema):
    reason = fields.String(required=True, validate=validate.Length(min=1, max=500))
    period = fields.String(load_default="forever", validate=validate.OneOf(["forever", "7", "30"]))
    logout = fields.Boolean(load_default=True)
    mail = fields.Boolean(load_default=False)


class PermissionRowSchema(Schema):
    perms = fields.List(fields.Integer(validate=validate.OneOf([0, 1, 2])), required=True, validate=validate.Length(equal=4))
    note = fields.String(load_default="", validate=validate.Length(max=500))


class PermissionFormSchema(Schema):
    rows = fields.List(fields.Nested(PermissionRowSchema), required=True, validate=validate.Length(equal=9))


class EnrollmentSchema(Schema):
    student_id = fields.Integer(required=True, validate=validate.Range(min=1))
    enrolled_date = FormDate(required=True)


class CatalogCourseSchema(FormSchema):
    course_code = fields.String(required=True, validate=validate.Length(min=1, max=20))
    name = fields.String(required=True, validate=validate.Length(min=1, max=150))
    level_id = fields.Integer(required=True, validate=validate.Range(min=1))
    group_id = fields.Integer(required=True, validate=validate.Range(min=1))
    curriculum_level = fields.Integer(load_default=1, validate=validate.Range(min=1, max=99))
    description = fields.String(load_default="", validate=validate.Length(max=1000))
    sessions_per_week = fields.Integer(required=True, validate=validate.Range(min=1, max=7))
    session_minutes = fields.Integer(required=True, validate=validate.Range(min=1, max=32767))
    monthly_fee = fields.Integer(required=True, validate=validate.Range(min=0, max=999999999999))


class RoomFormSchema(FormSchema):
    code = fields.String(required=True, validate=validate.Length(min=1, max=10))
    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    capacity = fields.Integer(required=True, validate=validate.Range(min=1, max=32767))
    status = fields.String(load_default="AVAILABLE", validate=validate.OneOf(["AVAILABLE", "MAINTENANCE"]))
