from flask_smorest import Blueprint

from app.controllers import operations_controller as controller
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.operations_schema import (
    AlertReviewSchema, AnnouncementCreateSchema, LedgerCreateSchema,
    PaymentCreateSchema, ReplySchema,
)

router = Blueprint("operations", __name__, description="Quản lý tài chính, thông báo và số liệu SQL")


def read_route(path, name):
    def endpoint(**kwargs):
        return controller.read(name, *kwargs.values())
    endpoint.__name__ = name
    router.route(path, methods=["GET"])(auth_required(RoleCode.MANAGER)(endpoint))


for path, name in [
    ("/manager/tuition", "tuition"),
    ("/manager/tuition/risks", "tuition_risks"),
    ("/manager/students/<string:student_id>/payments", "payment_history"),
    ("/manager/ledger", "ledger"),
    ("/manager/announcements", "announcements"),
    ("/manager/announcements/options", "announcement_options"),
    ("/manager/announcements/<int:announcement_id>", "announcement_detail"),
    ("/manager/dashboard", "dashboard"),
    ("/manager/admissions/forecast/<string:scope>", "forecast"),
    ("/manager/admissions/retention", "retention"),
    ("/manager/admissions/dropout", "dropout"),
    ("/manager/admissions/proposals", "proposals"),
]:
    read_route(path, name)


@router.route("/manager/ledger", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(LedgerCreateSchema)
@router.response(201)
def add_ledger(payload):
    return controller.write("add_ledger", payload)


@router.route("/manager/payments", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(PaymentCreateSchema)
@router.response(201)
def collect_payment(payload):
    return controller.write("collect_payment", payload)


@router.route("/manager/payroll/<string:month>/close", methods=["POST"])
@auth_required(RoleCode.MANAGER)
def close_payroll(month):
    return controller.write("close_payroll", month)


@router.route("/manager/announcements", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(AnnouncementCreateSchema)
@router.response(201)
def create_announcement(payload):
    return controller.write("create_announcement", payload)


@router.route("/manager/announcements/<int:announcement_id>", methods=["PATCH"])
@auth_required(RoleCode.MANAGER)
@router.arguments(AnnouncementCreateSchema)
def update_announcement(payload, announcement_id):
    return controller.write("update_announcement", announcement_id, payload)


@router.route("/manager/announcements/<int:announcement_id>/send", methods=["POST"])
@auth_required(RoleCode.MANAGER)
def send_announcement(announcement_id):
    return controller.write("send_announcement", announcement_id)


@router.route("/manager/announcements/<int:announcement_id>/remind", methods=["POST"])
@auth_required(RoleCode.MANAGER)
def remind_announcement(announcement_id):
    return controller.write("remind_announcement", announcement_id)


@router.route("/manager/announcements/<int:announcement_id>/replies", methods=["POST"])
@auth_required()
@router.arguments(ReplySchema)
@router.response(201)
def reply_announcement(payload, announcement_id):
    return controller.write("reply_announcement", announcement_id, payload)


@router.route("/manager/operations/files/<int:file_id>", methods=["GET"])
@auth_required(RoleCode.MANAGER)
def download_file(file_id):
    return controller.read("download_file", file_id)


@router.route("/manager/ai-alerts/<int:alert_id>/review", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(AlertReviewSchema)
def review_alert(payload, alert_id):
    return controller.write("review_alert", alert_id, payload)


@router.route("/manager/tuition/risks/<int:alert_id>/remind", methods=["POST"])
@auth_required(RoleCode.MANAGER)
def remind_tuition(alert_id):
    return controller.write("remind_tuition", alert_id)


@router.route("/manager/announcements/<int:announcement_id>/preview", methods=["POST"])
@auth_required(RoleCode.MANAGER)
def preview_announcement(announcement_id):
    return controller.write("preview_announcement", announcement_id)


@router.route("/notifications", methods=["GET"])
@auth_required()
def notifications():
    return controller.read("notifications")


@router.route("/notifications/read-all", methods=["POST"])
@auth_required()
def read_notifications():
    return controller.write("read_notifications")
