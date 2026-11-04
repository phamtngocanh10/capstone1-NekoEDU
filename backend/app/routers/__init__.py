"""Router: khai báo URL + HTTP method, gắn auth (middleware), validate input/output (schema), tài liệu Swagger.
Không viết logic ở đây, chỉ gọi sang controller.

Thêm router mới: tạo app/routers/<ten>_router.py rồi đăng ký trong register_routers().
"""

from flask_smorest import Api

from app.routers.auth_router import router as auth_router
from app.routers.class_router import router as class_router
from app.routers.guardian_router import router as guardian_router
from app.routers.health_router import router as health_router
from app.routers.level_router import router as level_router
from app.routers.staff_router import router as staff_router
from app.routers.student_router import router as student_router
from app.routers.user_router import router as user_router

API_PREFIX = "/api/v1"


def register_routers(api: Api) -> None:
    api.register_blueprint(health_router, url_prefix=f"{API_PREFIX}/health")
    api.register_blueprint(auth_router, url_prefix=f"{API_PREFIX}/auth")
    api.register_blueprint(user_router, url_prefix=f"{API_PREFIX}/users")
    api.register_blueprint(staff_router, url_prefix=f"{API_PREFIX}/staff")
    api.register_blueprint(class_router, url_prefix=f"{API_PREFIX}/classes")
    api.register_blueprint(student_router, url_prefix=f"{API_PREFIX}/students")
    api.register_blueprint(guardian_router, url_prefix=f"{API_PREFIX}/guardians")
    api.register_blueprint(level_router, url_prefix=f"{API_PREFIX}/levels")
