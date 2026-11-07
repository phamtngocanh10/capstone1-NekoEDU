from flask_smorest import Blueprint

from app.controllers import guardian_controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.common_schema import ErrorSchema
from app.schemas.guardian_schema import (
    GuardianCreateSchema,
    GuardianListSchema,
    GuardianQuerySchema,
    GuardianSchema,
    GuardianUpdateSchema,
)

router = Blueprint("guardians", __name__, description="Quản lý phụ huynh/người giám hộ")


@router.route("", methods=["GET"])
@auth_required(RoleCode.MANAGER)
@router.arguments(GuardianQuerySchema, location="query")
@router.response(200, GuardianListSchema)
def list_guardians(query):
    """Danh sách guardian (PII, chỉ Manager)"""
    return guardian_controller.list_guardians(query)


@router.route("", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(GuardianCreateSchema)
@router.response(201, GuardianSchema)
@router.alt_response(409, schema=ErrorSchema, description="Số điện thoại đã tồn tại")
def create_guardian(payload):
    """Tạo guardian mới; không tự gộp chỉ dựa trên số điện thoại"""
    return guardian_controller.create_guardian(payload)


@router.route("/<int:guardian_id>", methods=["GET"])
@auth_required(RoleCode.MANAGER)
@router.response(200, GuardianSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy guardian")
def get_guardian(guardian_id):
    return guardian_controller.get_guardian(guardian_id)


@router.route("/<int:guardian_id>", methods=["PATCH"])
@auth_required(RoleCode.MANAGER)
@router.arguments(GuardianUpdateSchema)
@router.response(200, GuardianSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy guardian")
@router.alt_response(409, schema=ErrorSchema, description="Số điện thoại đã tồn tại")
def update_guardian(payload, guardian_id):
    return guardian_controller.update_guardian(guardian_id, payload)
