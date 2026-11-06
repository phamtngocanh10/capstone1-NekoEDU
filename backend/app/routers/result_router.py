from flask_smorest import Blueprint

from app.controllers import result_controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.assessment_schema import (
    AssessmentResultDetailSchema,
    AssessmentResultUpdateSchema,
)
from app.schemas.common_schema import ErrorSchema

router = Blueprint("results", __name__, description="Sửa kết quả học tập")


@router.route("/<int:result_id>", methods=["PATCH"])
@auth_required(RoleCode.MANAGER, RoleCode.LECTURER)
@router.arguments(AssessmentResultUpdateSchema)
@router.response(200, AssessmentResultDetailSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không phụ trách lớp")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy kết quả")
@router.alt_response(409, schema=ErrorSchema, description="Kết quả không có thay đổi")
def update_result(payload, result_id):
    """Sửa điểm/nhận xét, bắt buộc reason và lưu lịch sử bất biến"""
    return result_controller.update_result(result_id, payload)
