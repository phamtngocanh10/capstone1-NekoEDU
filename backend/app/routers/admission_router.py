from flask_smorest import Blueprint

from app.controllers import admission_controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.admission_schema import (
    AdmissionLeadCreateSchema,
    AdmissionConversionSchema,
    AdmissionLeadConvertSchema,
    AdmissionLeadListSchema,
    AdmissionLeadQuerySchema,
    AdmissionLeadSchema,
    AdmissionLeadUpdateSchema,
)
from app.schemas.common_schema import ErrorSchema

router = Blueprint("admission-leads", __name__, description="Quản lý tuyển sinh")


@router.route("", methods=["GET"])
@auth_required(RoleCode.MANAGER)
@router.arguments(AdmissionLeadQuerySchema, location="query")
@router.response(200, AdmissionLeadListSchema)
@router.alt_response(401, schema=ErrorSchema, description="Chưa đăng nhập")
@router.alt_response(403, schema=ErrorSchema, description="Không có quyền")
def list_admission_leads(query):
    """Danh sách lead tuyển sinh, có tìm kiếm, bộ lọc và phân trang"""
    return admission_controller.list_admission_leads(query)


@router.route("", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(AdmissionLeadCreateSchema)
@router.response(201, AdmissionLeadSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy cấp độ/người tư vấn")
@router.alt_response(409, schema=ErrorSchema, description="Mã lead trùng hoặc người tư vấn không hợp lệ")
def create_admission_lead(payload):
    """Tạo lead mới ở trạng thái NEW"""
    return admission_controller.create_admission_lead(payload)


@router.route("/<int:lead_id>", methods=["PATCH"])
@auth_required(RoleCode.MANAGER)
@router.arguments(AdmissionLeadUpdateSchema)
@router.response(200, AdmissionLeadSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy lead/cấp độ/người tư vấn")
@router.alt_response(409, schema=ErrorSchema, description="Mã trùng hoặc chuyển trạng thái không hợp lệ")
def update_admission_lead(payload, lead_id):
    """Cập nhật lead, điểm đầu vào và trạng thái trước ghi danh"""
    return admission_controller.update_admission_lead(lead_id, payload)


@router.route("/<int:lead_id>/convert", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(AdmissionLeadConvertSchema)
@router.response(201, AdmissionConversionSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy lead/học viên/guardian")
@router.alt_response(409, schema=ErrorSchema, description="Lead hoặc dữ liệu liên kết không hợp lệ")
def convert_admission_lead(payload, lead_id):
    """Tạo hoặc liên kết học viên rồi chuyển lead sang ENROLLED trong một transaction"""
    return admission_controller.convert_admission_lead(lead_id, payload)
