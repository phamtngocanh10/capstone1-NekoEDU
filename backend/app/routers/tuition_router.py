from flask_smorest import Blueprint

from app.controllers import tuition_controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.common_schema import ErrorSchema
from app.schemas.tuition_schema import (
    ManualTuitionAdjustmentInputSchema,
    ManualTuitionAdjustmentResultSchema,
    TuitionAdjustmentListSchema,
    TuitionCycleGenerateSchema,
    TuitionCycleIssueSchema,
    TuitionCycleSchema,
)

router = Blueprint("tuition-cycles", __name__, description="Chu kỳ học phí 8 buổi")


@router.route("/generate", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(TuitionCycleGenerateSchema)
@router.response(201, TuitionCycleSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy ghi danh")
@router.alt_response(409, schema=ErrorSchema, description="Chưa đủ buổi hoặc buổi đã được dùng")
def generate_cycle(payload):
    """Tạo chu kỳ từ đúng 8 buổi chưa được dùng của một ghi danh"""
    return tuition_controller.generate_cycle(payload)


@router.route("/<int:cycle_id>", methods=["GET"])
@auth_required()
@router.response(200, TuitionCycleSchema)
@router.alt_response(403, schema=ErrorSchema, description="Ngoài phạm vi học sinh")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy chu kỳ")
def get_cycle(cycle_id):
    """Chi tiết chu kỳ và tám buổi theo đúng thứ tự"""
    return tuition_controller.get_cycle(cycle_id)


@router.route("/<int:cycle_id>/issue", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.response(200, TuitionCycleIssueSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy chu kỳ")
@router.alt_response(409, schema=ErrorSchema, description="Chu kỳ chưa thể phát hành")
def issue_cycle(cycle_id):
    """Phát hành invoice và notification theo cơ chế idempotent"""
    return tuition_controller.issue_cycle(cycle_id)


@router.route("/<int:cycle_id>/calculate", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.response(200, TuitionCycleSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy chu kỳ")
@router.alt_response(409, schema=ErrorSchema, description="Thiếu cấu hình hoặc không thể tính")
def calculate_cycle(cycle_id):
    """Tính và lưu snapshot học phí của chu kỳ"""
    return tuition_controller.calculate_cycle(cycle_id)


@router.route("/<int:cycle_id>/adjustments", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(ManualTuitionAdjustmentInputSchema)
@router.response(201, ManualTuitionAdjustmentResultSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy chu kỳ")
@router.alt_response(409, schema=ErrorSchema, description="Chu kỳ đã phát hành")
def create_manual_adjustment(payload, cycle_id):
    """Manager thêm phụ thu (dương) hoặc giảm trừ (âm) có lý do"""
    return tuition_controller.create_manual_adjustment(cycle_id, payload)


@router.route("/<int:cycle_id>/adjustments", methods=["GET"])
@auth_required()
@router.response(200, TuitionAdjustmentListSchema)
@router.alt_response(403, schema=ErrorSchema, description="Ngoài phạm vi học sinh")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy chu kỳ")
def list_adjustments(cycle_id):
    """Lịch sử adjustment đang hoạt động và đã đảo của chu kỳ"""
    return tuition_controller.list_adjustments(cycle_id)
