from flask_smorest.error_handler import ErrorSchema

# Dùng lại ErrorSchema của flask-smorest ({code, status, message, errors}) cho tài liệu Swagger,
# cùng format với lỗi do AppError trả về.
__all__ = ["ErrorSchema"]

