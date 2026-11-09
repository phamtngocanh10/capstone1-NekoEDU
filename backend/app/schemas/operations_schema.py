from marshmallow import Schema, fields, validate


class OperationFileSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1, max=255))
    mime = fields.String(load_default="application/octet-stream", validate=validate.Length(min=1, max=100))
    content = fields.String(required=True)


class LedgerCreateSchema(Schema):
    request_id = fields.String(allow_none=True, load_default=None, validate=validate.Regexp(r"^[A-Za-z0-9_-]{16,80}$"))
    type = fields.String(required=True, validate=validate.OneOf(["income", "expense"]))
    date = fields.Date(required=True)
    amount = fields.Integer(required=True, validate=validate.Range(min=1, max=99999999999999))
    category = fields.String(required=True, validate=validate.Length(min=1, max=100))
    note = fields.String(load_default="", validate=validate.Length(max=255))
    files = fields.List(fields.Nested(OperationFileSchema), load_default=list, validate=validate.Length(max=5))


class PaymentCreateSchema(Schema):
    request_id = fields.String(allow_none=True, load_default=None, validate=validate.Regexp(r"^[A-Za-z0-9_-]{16,80}$"))
    invoice = fields.String(required=True)
    amount = fields.Integer(required=True, validate=validate.Range(min=1, max=999999999999))
    date = fields.Date(required=True)
    method = fields.String(required=True, validate=validate.OneOf(["CASH", "BANK_TRANSFER", "MOMO", "VNPAY"]))
    note = fields.String(load_default="", validate=validate.Length(max=255))
    receipt = fields.Boolean(load_default=True)
    files = fields.List(fields.Nested(OperationFileSchema), load_default=list, validate=validate.Length(max=5))


class AnnouncementCreateSchema(Schema):
    title = fields.String(required=True, validate=validate.Length(min=1, max=200))
    content = fields.String(load_default="", validate=validate.Length(max=2000))
    message_type = fields.String(load_default="SYSTEM", validate=validate.OneOf(["SCHEDULE", "TUITION", "ASSESSMENT", "EVENT", "SYSTEM"]))
    priority = fields.String(load_default="NORMAL", validate=validate.OneOf(["NORMAL", "IMPORTANT"]))
    audience_type = fields.String(load_default="ALL_STUDENTS", validate=validate.OneOf(["ALL_STUDENTS", "ALL_USERS", "CLASSES", "STUDENTS"]))
    status = fields.String(load_default="DRAFT", validate=validate.OneOf(["DRAFT", "SCHEDULED", "SENT"]))
    scheduled_at = fields.DateTime(allow_none=True, load_default=None)
    class_ids = fields.List(fields.Integer(validate=validate.Range(min=1)), load_default=list)
    students = fields.List(fields.String(), load_default=list)
    is_pinned = fields.Boolean(load_default=False)
    send_email = fields.Boolean(load_default=False)
    send_push = fields.Boolean(load_default=False)
    template_id = fields.Integer(allow_none=True, load_default=None)
    files = fields.List(fields.Nested(OperationFileSchema), load_default=list, validate=validate.Length(max=5))


class AlertReviewSchema(Schema):
    decision = fields.String(required=True, validate=validate.OneOf(["accepted", "skip", "resolved"]))
    note = fields.String(load_default="", validate=validate.Length(max=500))


class ReplySchema(Schema):
    content = fields.String(required=True, validate=validate.Length(min=1, max=2000))
