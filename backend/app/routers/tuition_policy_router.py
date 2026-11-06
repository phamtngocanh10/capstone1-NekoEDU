from flask_smorest import Blueprint

from app.controllers import tuition_controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.common_schema import ErrorSchema
from app.schemas.tuition_schema import (
    TuitionPolicyInputSchema,
    TuitionPolicyListSchema,
    TuitionPolicySchema,
)

router = Blueprint("tuition-policies", __name__, description="Chính sách học phí có phiên bản")


@router.route("", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(TuitionPolicyInputSchema)
@router.response(201, TuitionPolicySchema)
@router.alt_response(409, schema=ErrorSchema, description="Khoảng hiệu lực bị trùng")
def create_policy(payload):
    """Tạo phiên bản chính sách học phí theo khoảng ngày hiệu lực"""
    return tuition_controller.create_policy(payload)


@router.route("", methods=["GET"])
@auth_required(RoleCode.MANAGER)
@router.response(200, TuitionPolicyListSchema)
def list_policies():
    """Danh sách phiên bản chính sách học phí"""
    return tuition_controller.list_policies()
