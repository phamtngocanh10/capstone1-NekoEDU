from flask_smorest import Blueprint

from app.controllers import student_controller
from app.middlewares.auth import auth_required
from app.schemas.common_schema import ErrorSchema
from app.models import RoleCode
from app.schemas.student_schema import (
    StudentCreateSchema,
    StudentListSchema,
    StudentQuerySchema,
    StudentSchema,
    StudentUpdateSchema,
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
