"""Router: khai báo URL + HTTP method, gắn validate input/output (schema), auth, tài liệu Swagger.
Không viết logic ở đây, chỉ gọi sang controller.

Thêm router mới: tạo app/routers/<ten>_router.py rồi đăng ký trong register_routers().
"""

from flask_smorest import Api

from app.routers.health_router import router as health_router

API_PREFIX = "/api/v1"


def register_routers(api: Api) -> None:
    api.register_blueprint(health_router, url_prefix=f"{API_PREFIX}/health")
