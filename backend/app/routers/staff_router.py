from flask_smorest import Blueprint

from app.controllers import staff_controller
from app.middlewares.auth import auth_required
from app.models import STAFF_ROLES, RoleCode
from app.schemas.common_schema import ErrorSchema
from app.schemas.staff_schema import (
    StaffCreateSchema,
    StaffQuerySchema,
    StaffSchema,
    StaffUpdateSchema,
)

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


@router.route("", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(StaffCreateSchema)
@router.response(201, StaffSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy tài khoản")
@router.alt_response(409, schema=ErrorSchema, description="Hồ sơ hoặc mã nhân sự bị trùng/xung đột")
def create_staff(payload):
    """Tạo hồ sơ nhân sự cho một tài khoản staff"""
    return staff_controller.create_staff(payload)


@router.route("/<int:staff_id>", methods=["GET"])
@auth_required(RoleCode.MANAGER)
@router.response(200, StaffSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy hồ sơ nhân sự")
def get_staff(staff_id):
    """Chi tiết hồ sơ nhân sự"""
    return staff_controller.get_staff(staff_id)


@router.route("/<int:staff_id>", methods=["PATCH"])
@auth_required(RoleCode.MANAGER)
@router.arguments(StaffUpdateSchema)
@router.response(200, StaffSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không được tự đổi position")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy hồ sơ nhân sự")
@router.alt_response(409, schema=ErrorSchema, description="Mã nhân sự bị trùng")
def update_staff(payload, staff_id):
    """Cập nhật hồ sơ; đổi position sẽ đồng bộ role tài khoản"""
    return staff_controller.update_staff(staff_id, payload)
