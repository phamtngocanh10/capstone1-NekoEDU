from flask_smorest import Blueprint

from app.controllers import auth_controller
from app.schemas.auth_schema import LoginResponseSchema, LoginSchema
from app.schemas.common_schema import ErrorSchema

router = Blueprint("auth", __name__, description="Xác thực: đăng nhập")


@router.route("/login", methods=["POST"])
@router.doc(security=[])
@router.arguments(LoginSchema)
@router.response(200, LoginResponseSchema)
@router.alt_response(401, schema=ErrorSchema, description="Sai username/email hoặc mật khẩu")
@router.alt_response(403, schema=ErrorSchema, description="Tài khoản bị khóa hoặc ngừng hoạt động")
def login(payload):
    """Đăng nhập bằng username hoặc email

    Trả về access token (JWT). Gửi token ở header: `Authorization: Bearer <access_token>`.
    """
    return auth_controller.login(payload)

