from flask_smorest.error_handler import ErrorSchema
from marshmallow import Schema, fields

# Dùng lại ErrorSchema của flask-smorest ({code, status, message, errors}) cho tài liệu Swagger,
# cùng format với lỗi do AppError trả về.
__all__ = ["ErrorSchema", "PaginationSchema"]


class PaginationSchema(Schema):
    page = fields.Integer()
    page_size = fields.Integer()
    total = fields.Integer()
    total_pages = fields.Integer()
