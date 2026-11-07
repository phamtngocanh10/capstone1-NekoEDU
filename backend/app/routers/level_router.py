from flask_smorest import Blueprint

from app.controllers import level_controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.common_schema import ErrorSchema
from app.schemas.level_schema import LevelSchema, LevelUpdateSchema

router = Blueprint("levels", __name__, description="Danh mục 8 cấp độ đào tạo")


@router.route("", methods=["GET"])
@auth_required()
@router.response(200, LevelSchema(many=True))
def list_levels():
    """Danh mục cấp độ cố định"""
    return level_controller.list_levels()


@router.route("/<int:level_id>", methods=["PATCH"])
@auth_required(RoleCode.MANAGER)
@router.arguments(LevelUpdateSchema)
@router.response(200, LevelSchema)
@router.alt_response(404, schema=ErrorSchema, description="Không tìm thấy cấp độ")
def update_level(payload, level_id):
    """Sửa tên và khoảng tuổi; code/sort_order là bất biến"""
    return level_controller.update_level(level_id, payload)
