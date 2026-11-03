from flask_smorest import Blueprint

from app.controllers import health_controller
from app.schemas.health_schema import HealthSchema

router = Blueprint("health", __name__, description="Kiểm tra trạng thái hệ thống")


@router.route("", methods=["GET"])
@router.doc(security=[])
@router.response(200, HealthSchema)
def get_health():
    """Health check"""
    return health_controller.get_health()
