"""Khởi tạo các extension ở đây, gắn vào app trong create_app().

Khi có database / JWT, thêm vào đây, ví dụ:
    db = SQLAlchemy()
    migrate = Migrate()
    jwt = JWTManager()
"""

from flask_cors import CORS
from flask_smorest import Api

api = Api()
cors = CORS()
