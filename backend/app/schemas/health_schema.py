from marshmallow import Schema, fields


class HealthSchema(Schema):
    status = fields.String(required=True)
    service = fields.String(required=True)
    version = fields.String(required=True)
    environment = fields.String(required=True)
    timestamp = fields.DateTime(required=True)
