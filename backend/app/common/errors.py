from http import HTTPStatus

from flask import Flask, jsonify


class AppError(Exception):
    """Lỗi nghiệp vụ: service raise, handler trả về JSON cùng format với lỗi của flask-smorest.

    {"code": 403, "status": "Forbidden", "message": "...", "errors": {...}}
    """

    status_code = HTTPStatus.BAD_REQUEST

    def __init__(self, message: str, status_code: int | None = None, errors: dict | None = None):
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        self.errors = errors


class NotFoundError(AppError):
    status_code = HTTPStatus.NOT_FOUND


class UnauthorizedError(AppError):
    status_code = HTTPStatus.UNAUTHORIZED


class ForbiddenError(AppError):
    status_code = HTTPStatus.FORBIDDEN


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(AppError)
    def handle_app_error(error: AppError):
        status = HTTPStatus(error.status_code)
        body = {"code": status.value, "status": status.phrase, "message": error.message}
        if error.errors:
            body["errors"] = error.errors
        return jsonify(body), status.value
