"""Router: khai báo URL + HTTP method, gắn auth (middleware), validate input/output (schema), tài liệu Swagger.
Không viết logic ở đây, chỉ gọi sang controller.

Thêm router mới: tạo app/routers/<ten>_router.py rồi đăng ký trong register_routers().
"""

from flask_smorest import Api

from app.routers.admission_router import router as admission_router
from app.routers.assessment_router import router as assessment_router
from app.routers.attendance_router import router as attendance_router
from app.routers.auth_router import router as auth_router
from app.routers.class_router import router as class_router
from app.routers.guardian_router import router as guardian_router
from app.routers.health_router import router as health_router
from app.routers.level_router import router as level_router
from app.routers.result_router import router as result_router
from app.routers.schedule_router import router as schedule_router
from app.routers.session_router import router as session_router
from app.routers.staff_router import router as staff_router
from app.routers.student_router import router as student_router
from app.routers.tuition_router import router as tuition_router
from app.routers.tuition_policy_router import router as tuition_policy_router
from app.routers.user_router import router as user_router
from app.routers.operations_router import router as operations_router
from app.routers.lecturer_router import lecturer_bp, workflow_bp
from app.routers.management_router import router as management_router

API_PREFIX = "/api/v1"


def register_routers(api: Api) -> None:
    api.register_blueprint(health_router, url_prefix=f"{API_PREFIX}/health")
    api.register_blueprint(auth_router, url_prefix=f"{API_PREFIX}/auth")
    api.register_blueprint(user_router, url_prefix=f"{API_PREFIX}/users")
    api.register_blueprint(staff_router, url_prefix=f"{API_PREFIX}/staff")
    api.register_blueprint(class_router, url_prefix=f"{API_PREFIX}/classes")
    api.register_blueprint(student_router, url_prefix=f"{API_PREFIX}/students")
    api.register_blueprint(guardian_router, url_prefix=f"{API_PREFIX}/guardians")
    api.register_blueprint(level_router, url_prefix=f"{API_PREFIX}/levels")
    api.register_blueprint(result_router, url_prefix=f"{API_PREFIX}/results")
    api.register_blueprint(admission_router, url_prefix=f"{API_PREFIX}/admission-leads")
    api.register_blueprint(assessment_router, url_prefix=f"{API_PREFIX}/assessments")
    api.register_blueprint(schedule_router, url_prefix=f"{API_PREFIX}/schedules")
    api.register_blueprint(session_router, url_prefix=f"{API_PREFIX}/sessions")
    api.register_blueprint(attendance_router, url_prefix=f"{API_PREFIX}/attendances")
    api.register_blueprint(tuition_router, url_prefix=f"{API_PREFIX}/tuition-cycles")
    api.register_blueprint(tuition_policy_router, url_prefix=f"{API_PREFIX}/tuition-policies")
    api.register_blueprint(operations_router, url_prefix=API_PREFIX)
    api.register_blueprint(lecturer_bp, url_prefix=f"{API_PREFIX}/lecturer")
    api.register_blueprint(workflow_bp, url_prefix=f"{API_PREFIX}/manager")
    api.register_blueprint(management_router, url_prefix=f"{API_PREFIX}/manager")
