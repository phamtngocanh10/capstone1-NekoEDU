from flask_smorest import Blueprint

from app.controllers import staff_controller
from app.middlewares.auth import auth_required
from app.models import STAFF_ROLES
from app.schemas.common_schema import ErrorSchema
from app.schemas.staff_schema import StaffQuerySchema, StaffSchema

router = Blueprint("staff", __name__, description="Danh bạ nhân sự (Manager, Giảng viên, Trợ giảng)")


@router.route("", methods=["GET"])
@auth_required(*STAFF_ROLES)
@router.arguments(StaffQuerySchema, location="query")
@router.response(200, StaffSchema(many=True))
@router.alt_response(401, schema=ErrorSchema, description="Chưa đăng nhập")
@router.alt_response(403, schema=ErrorSchema, description="Không phải nhân sự (Học viên/Phụ huynh)")
def list_staff(query):
    """Danh bạ nhân sự"""
    return staff_controller.list_staff(query)
