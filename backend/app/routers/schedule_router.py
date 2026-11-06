from flask_smorest import Blueprint

from app.controllers import schedule_controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.common_schema import ErrorSchema
from app.schemas.schedule_schema import ClassScheduleSchema, ClassScheduleUpdateSchema

router = Blueprint("schedules", __name__, description="Quản lý lịch học định kỳ")


@router.route("/<int:schedule_id>", methods=["PATCH"])
@auth_required(RoleCode.MANAGER)
@router.arguments(ClassScheduleUpdateSchema)
@router.response(200, ClassScheduleSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy lịch/lớp/phòng")
@router.alt_response(409, schema=ErrorSchema, description="Lịch học không hợp lệ")
def update_class_schedule(payload, schedule_id):
    """Cập nhật lịch học định kỳ"""
    return schedule_controller.update_class_schedule(schedule_id, payload)


@router.route("/<int:schedule_id>", methods=["DELETE"])
@auth_required(RoleCode.MANAGER)
@router.response(204)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy lịch/lớp")
@router.alt_response(409, schema=ErrorSchema, description="Lớp không cho phép sửa lịch")
def delete_class_schedule(schedule_id):
    """Xóa lịch học định kỳ"""
    return schedule_controller.delete_class_schedule(schedule_id)
