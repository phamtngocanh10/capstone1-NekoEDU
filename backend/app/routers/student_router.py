from flask_smorest import Blueprint

from app.controllers import student_controller
from app.middlewares.auth import auth_required
from app.schemas.common_schema import ErrorSchema
from app.models import RoleCode
from app.schemas.student_schema import (
    StudentCreateSchema,
    StudentListSchema,
    StudentLevelTransferInputSchema,
    StudentLevelTransferSchema,
    StudentLearningHistorySchema,
    StudentQuerySchema,
    StudentSchema,
    StudentUpdateSchema,
)
from app.schemas.assessment_schema import StudentAssessmentResultListSchema
from app.controllers import assessment_controller
from app.controllers import tuition_controller
from app.schemas.tuition_schema import (
    SiblingRelationshipInputSchema,
    SiblingRelationshipSchema,
    TuitionCycleListSchema,
)

router = Blueprint("students", __name__, description="Quản lý học viên")


@router.route("", methods=["GET"])
@auth_required()
@router.arguments(StudentQuerySchema, location="query")
@router.response(200, StudentListSchema)
@router.alt_response(401, schema=ErrorSchema, description="Chưa đăng nhập")
def list_students(query):
    """Danh sách học viên trong phạm vi được phép"""
    return student_controller.list_students(query)


@router.route("", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(StudentCreateSchema)
@router.response(201, StudentSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy level/guardian/user")
@router.alt_response(409, schema=ErrorSchema, description="Mã hoặc dữ liệu liên kết bị trùng")
def create_student(payload):
    """Tạo học viên, có thể tạo guardian/tài khoản trong cùng transaction"""
    return student_controller.create_student(payload)


@router.route("/<int:student_id>", methods=["GET"])
@auth_required()
@router.response(200, StudentSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không có quyền xem học viên")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy học viên")
def get_student(student_id):
    """Chi tiết học viên trong phạm vi được phép"""
    return student_controller.get_student(student_id)


@router.route("/<int:student_id>", methods=["PATCH"])
@auth_required(RoleCode.MANAGER)
@router.arguments(StudentUpdateSchema)
@router.response(200, StudentSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy học viên/guardian")
@router.alt_response(409, schema=ErrorSchema, description="Mã học viên bị trùng")
def update_student(payload, student_id):
    """Cập nhật hành chính; chuyển level phải dùng API level-transfer"""
    return student_controller.update_student(student_id, payload)


@router.route("/<int:student_id>/level-transfers", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(StudentLevelTransferInputSchema)
@router.response(201, StudentLevelTransferSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy học viên/cấp độ")
@router.alt_response(409, schema=ErrorSchema, description="Chuyển cấp không hợp lệ")
def transfer_student_level(payload, student_id):
    """Chuyển cấp và lưu lịch sử bất biến trong cùng transaction"""
    return student_controller.transfer_student_level(student_id, payload)


@router.route("/<int:student_id>/learning-history", methods=["GET"])
@auth_required()
@router.response(200, StudentLearningHistorySchema)
@router.alt_response(403, schema=ErrorSchema, description="Không có quyền xem học viên")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy học viên")
def get_learning_history(student_id):
    """Tổng hợp lịch sử cấp độ, ghi danh, lớp và kết quả học tập"""
    return student_controller.get_learning_history(student_id)


@router.route("/<int:student_id>/results", methods=["GET"])
@auth_required()
@router.response(200, StudentAssessmentResultListSchema)
@router.alt_response(403, schema=ErrorSchema, description="Không có quyền xem học viên")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy học viên")
def list_student_results(student_id):
    """Kết quả các đợt đánh giá đã công bố của một học sinh"""
    return assessment_controller.list_student_results(student_id)


@router.route("/<int:student_id>/sibling-relationships", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(SiblingRelationshipInputSchema)
@router.response(201, SiblingRelationshipSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy học sinh")
@router.alt_response(409, schema=ErrorSchema, description="Quan hệ không hợp lệ hoặc trùng")
def create_sibling_relationship(payload, student_id):
    """Manager xác nhận quan hệ anh/chị/em có thời hạn và lý do"""
    return tuition_controller.create_sibling_relationship(student_id, payload)


@router.route("/<int:student_id>/tuition-cycles", methods=["GET"])
@auth_required()
@router.response(200, TuitionCycleListSchema)
@router.alt_response(403, schema=ErrorSchema, description="Ngoài phạm vi học sinh")
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy học sinh")
def list_student_tuition_cycles(student_id):
    """Danh sách toàn bộ chu kỳ học phí của một học sinh"""
    return tuition_controller.list_student_cycles(student_id)
