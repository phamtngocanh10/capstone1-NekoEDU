from flask_smorest import Blueprint

from app.controllers import assessment_controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.assessment_schema import (
    AssessmentInputSchema,
    AssessmentImportConfirmResultSchema,
    AssessmentImportConfirmSchema,
    AssessmentImportPreviewSchema,
    AssessmentListSchema,
    AssessmentQuerySchema,
    AssessmentResultBulkSchema,
    AssessmentResultListSchema,
    AssessmentSchema,
    AssessmentUpdateSchema,
)
from app.schemas.common_schema import ErrorSchema

router = Blueprint("assessments", __name__, description="Quản lý kết quả học tập")


@router.route("", methods=["GET"])
@auth_required()
@router.arguments(AssessmentQuerySchema, location="query")
@router.response(200, AssessmentListSchema)
def list_assessments(query):
    """Danh sách đợt đánh giá theo phạm vi người dùng"""
    return assessment_controller.list_assessments(query)


@router.route("", methods=["POST"])
@auth_required(RoleCode.MANAGER, RoleCode.LECTURER)
@router.arguments(AssessmentInputSchema)
@router.response(201, AssessmentSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không phụ trách lớp")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy lớp/cấp độ")
@router.alt_response(409, schema=ErrorSchema, description="Lớp/cấp độ không hợp lệ")
def create_assessment(payload):
    """Tạo đợt đánh giá ở trạng thái DRAFT"""
    return assessment_controller.create_assessment(payload)


@router.route("/<int:assessment_id>", methods=["GET"])
@auth_required()
@router.response(200, AssessmentSchema)
def get_assessment(assessment_id):
    """Chi tiết đợt đánh giá theo phạm vi"""
    return assessment_controller.get_assessment(assessment_id)


@router.route("/<int:assessment_id>", methods=["PATCH"])
@auth_required(RoleCode.MANAGER, RoleCode.LECTURER)
@router.arguments(AssessmentUpdateSchema)
@router.response(200, AssessmentSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không phụ trách lớp")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy đợt đánh giá")
@router.alt_response(409, schema=ErrorSchema, description="Đợt đánh giá không thể sửa")
def update_assessment(payload, assessment_id):
    """Sửa thông tin đợt đánh giá DRAFT"""
    return assessment_controller.update_assessment(assessment_id, payload)


@router.route("/<int:assessment_id>/results", methods=["GET"])
@auth_required()
@router.response(200, AssessmentResultListSchema)
def list_assessment_results(assessment_id):
    """Roster kết quả; học sinh chưa có điểm trả result=null"""
    return assessment_controller.list_assessment_results(assessment_id)


@router.route("/<int:assessment_id>/results", methods=["PUT"])
@auth_required(RoleCode.MANAGER, RoleCode.LECTURER)
@router.arguments(AssessmentResultBulkSchema)
@router.response(200, AssessmentResultListSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không phụ trách lớp")
@router.alt_response(409, schema=ErrorSchema, description="Kết quả không hợp lệ hoặc đã tồn tại")
def record_assessment_results(payload, assessment_id):
    """Nhập điểm trực tiếp theo lô, toàn bộ hoặc không dòng nào"""
    return assessment_controller.record_assessment_results(assessment_id, payload)


@router.route("/<int:assessment_id>/imports/preview", methods=["POST"])
@auth_required(RoleCode.MANAGER, RoleCode.LECTURER)
@router.response(200, AssessmentImportPreviewSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không phụ trách lớp")
@router.alt_response(422, schema=ErrorSchema, description="File hoặc header không hợp lệ")
def preview_result_import(assessment_id):
    """Kiểm tra file Excel và lưu snapshot preview hợp lệ trong 30 phút"""
    return assessment_controller.preview_result_import(assessment_id)


@router.route("/<int:assessment_id>/imports/confirm", methods=["POST"])
@auth_required(RoleCode.MANAGER, RoleCode.LECTURER)
@router.arguments(AssessmentImportConfirmSchema)
@router.response(200, AssessmentImportConfirmResultSchema)
@router.alt_response(409, schema=ErrorSchema, description="Preview hết hạn/đã dùng/dữ liệu đổi")
def confirm_result_import(payload, assessment_id):
    """Xác nhận snapshot import theo cơ chế atomic"""
    return assessment_controller.confirm_result_import(assessment_id, payload)


@router.route("/<int:assessment_id>/publish", methods=["POST"])
@auth_required(RoleCode.MANAGER, RoleCode.LECTURER)
@router.response(200, AssessmentSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không phụ trách lớp")
@router.alt_response(409, schema=ErrorSchema, description="Đợt đánh giá đã công bố")
def publish_assessment(assessment_id):
    """Công bố kết quả cho học sinh/phụ huynh liên quan"""
    return assessment_controller.publish_assessment(assessment_id)


@router.route("/<int:assessment_id>/unpublish", methods=["POST"])
@auth_required(RoleCode.MANAGER, RoleCode.LECTURER)
@router.response(200, AssessmentSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không phụ trách lớp")
@router.alt_response(409, schema=ErrorSchema, description="Đợt đánh giá đang là DRAFT")
def unpublish_assessment(assessment_id):
    """Thu hồi công bố và ẩn kết quả khỏi học sinh/phụ huynh"""
    return assessment_controller.unpublish_assessment(assessment_id)


@router.route("/<int:assessment_id>/export", methods=["GET"])
@auth_required(RoleCode.MANAGER, RoleCode.LECTURER)
def export_assessment_results(assessment_id):
    """Xuất Excel kết quả của một đợt đánh giá"""
    return assessment_controller.export_assessment_results(assessment_id)
