"""Khởi tạo các extension ở đây, gắn vào app trong create_app()."""

from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_smorest import Api
from flask_sqlalchemy import SQLAlchemy

DEFAULT_ERROR_MESSAGES = {
    400: "Request không hợp lệ",
    404: "Không tìm thấy tài nguyên",
    405: "Phương thức không được hỗ trợ",
    422: "Dữ liệu gửi lên không hợp lệ",
    500: "Lỗi hệ thống, vui lòng thử lại sau",
}


class NekoApi(Api):
    """Bổ sung 'message' mặc định cho lỗi HTTP (404, 422, 500...), để mọi lỗi
    đều có đủ {code, status, message} giống lỗi nghiệp vụ AppError."""

    def handle_http_exception(self, error):
        payload, code, headers = super().handle_http_exception(error)
        payload.setdefault("message", DEFAULT_ERROR_MESSAGES.get(code, error.name))
        return payload, code, headers


api = NekoApi()
cors = CORS()
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
