"""Compatibility API for the original Manager forms and tables."""
import csv
from io import BytesIO, StringIO

from flask import jsonify, request
from flask_jwt_extended import current_user
from flask_smorest import Blueprint
from marshmallow import ValidationError
from openpyxl import load_workbook

from app.common.errors import AppError
from app.middlewares.auth import auth_required
from app.models import RoleCode
from app.schemas.management_schema import (
    AccountFormSchema, AssignmentFormSchema, CatalogCourseSchema, ClassFormSchema,
    EnrollmentSchema, LockFormSchema, PermissionFormSchema, RoomFormSchema,
    StaffFormSchema, StopStaffSchema, StudentFormSchema,
)
from app.services import management_service as service

router = Blueprint("management", __name__, description="Dữ liệu SQL cho giao diện Manager hiện có")


def result(value, status=200):
    return jsonify(service._json(value)), status


@router.route("/catalog", methods=["GET"])
@auth_required(RoleCode.MANAGER)
def catalog():
    return result(service.catalog())


@router.route("/courses", methods=["GET"])
@auth_required(RoleCode.MANAGER)
def courses():
    return result(service.list_courses())


@router.route("/classes", methods=["GET"])
@auth_required(RoleCode.MANAGER)
def classes():
    return result(service.list_classes(request.args.get("courseId")))


@router.route("/classes", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(ClassFormSchema)
def create_class(payload):
    return result(service.create_class(payload,current_user),201)


@router.route("/classes/<int:class_id>", methods=["GET"])
@auth_required(RoleCode.MANAGER)
def class_detail(class_id):
    return result(service.class_detail(class_id))


@router.route("/classes/<int:class_id>", methods=["PUT"])
@auth_required(RoleCode.MANAGER)
@router.arguments(ClassFormSchema)
def update_class(payload,class_id):
    return result(service.update_class(class_id,payload,current_user))


@router.route("/classes/<int:class_id>", methods=["DELETE"])
@auth_required(RoleCode.MANAGER)
def deactivate_class(class_id):
    return result(service.deactivate_class(class_id,current_user))


@router.route("/classes/<int:class_id>/enrollments", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(EnrollmentSchema)
def enroll(payload,class_id):
    return result(service.enroll(class_id,payload,current_user),201)


@router.route("/catalog/courses", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(CatalogCourseSchema)
def create_course(payload):
    return result(service.save_catalog("courses",payload,current_user),201)


@router.route("/catalog/courses/<int:item_id>", methods=["PUT"])
@auth_required(RoleCode.MANAGER)
@router.arguments(CatalogCourseSchema)
def update_course(payload,item_id):
    return result(service.save_catalog("courses",payload,current_user,item_id))


@router.route("/catalog/courses/<int:item_id>", methods=["DELETE"])
@auth_required(RoleCode.MANAGER)
def delete_course(item_id):
    return result(service.deactivate_catalog("courses",item_id,current_user))


@router.route("/rooms", methods=["GET"])
@auth_required(RoleCode.MANAGER)
def rooms():
    return result([dict(row) for row in service.rows("SELECT * FROM rooms ORDER BY code")])


@router.route("/rooms", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(RoomFormSchema)
def create_room(payload):
    return result(service.save_catalog("rooms",payload,current_user),201)


@router.route("/rooms/<int:item_id>", methods=["PUT"])
@auth_required(RoleCode.MANAGER)
@router.arguments(RoomFormSchema)
def update_room(payload,item_id):
    return result(service.save_catalog("rooms",payload,current_user,item_id))


@router.route("/rooms/<int:item_id>", methods=["DELETE"])
@auth_required(RoleCode.MANAGER)
def delete_room(item_id):
    return result(service.deactivate_catalog("rooms",item_id,current_user))


@router.route("/students", methods=["GET"])
@auth_required(RoleCode.MANAGER)
def students():
    return result(service.list_students(request.args.get("class_id",type=int)))


@router.route("/students", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(StudentFormSchema)
def create_student(payload):
    return result(service.save_student(payload,current_user),201)


@router.route("/students/<string:identifier>", methods=["GET"])
@auth_required(RoleCode.MANAGER)
def student_detail(identifier):
    return result(service.get_student(identifier))


@router.route("/students/<int:student_id>", methods=["PATCH"])
@auth_required(RoleCode.MANAGER)
@router.arguments(StudentFormSchema)
def update_student(payload,student_id):
    return result(service.save_student(payload,current_user,student_id))


@router.route("/students/<int:student_id>", methods=["DELETE"])
@auth_required(RoleCode.MANAGER)
def delete_student(student_id):
    return result(service.deactivate_student(student_id,current_user))


@service.atomic
def import_rows(records):
    imported=[]
    for index,record in enumerate(records,start=2):
        if not any(value not in ("",None) for value in record.values()):
            continue
        try:
            payload=StudentFormSchema().load(record)
            imported.append(service.save_student.__wrapped__(payload,current_user))
        except (ValidationError,AppError) as exc:
            raise AppError(f"Dòng {index}: {exc}. Chưa lưu bất kỳ dòng nào.") from exc
    return {"count":len(imported),"items":imported}


@router.route("/students/import", methods=["POST"])
@auth_required(RoleCode.MANAGER)
def import_students():
    upload=request.files.get("file")
    if upload is None:
        raise AppError("Cần chọn file CSV hoặc XLSX")
    raw=upload.read(5*1024*1024+1)
    if len(raw)>5*1024*1024:
        raise AppError("File nhập tối đa 5 MB")
    try:
        if upload.filename.lower().endswith(".xlsx"):
            workbook=load_workbook(BytesIO(raw),read_only=True,data_only=True)
            values=list(workbook.active.iter_rows(values_only=True))
            workbook.close()
            headers=[str(value or "").strip() for value in values[0]] if values else []
            records=[{key:value if value is not None else "" for key,value in zip(headers,row)} for row in values[1:]]
        elif upload.filename.lower().endswith(".csv"):
            records=list(csv.DictReader(StringIO(raw.decode("utf-8-sig"))))
        else:
            raise AppError("Chỉ chấp nhận CSV hoặc XLSX")
    except (UnicodeError,ValueError,IndexError,KeyError) as exc:
        raise AppError("Không đọc được file nhập") from exc
    if len(records)>500:
        raise AppError("Mỗi lần nhập tối đa 500 học viên")
    return result(import_rows(records),201)


@router.route("/lecturers", methods=["GET"])
@auth_required(RoleCode.MANAGER)
def lecturers():
    return result(service.list_lecturers())


@router.route("/lecturers", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(StaffFormSchema)
def create_lecturer(payload):
    return result(service.save_lecturer(payload,current_user),201)


@router.route("/lecturers/<int:staff_id>", methods=["GET"])
@auth_required(RoleCode.MANAGER)
def lecturer_detail(staff_id):
    return result(service.get_lecturer(staff_id))


@router.route("/lecturers/<int:staff_id>", methods=["PUT"])
@auth_required(RoleCode.MANAGER)
@router.arguments(StaffFormSchema)
def update_lecturer(payload,staff_id):
    return result(service.save_lecturer(payload,current_user,staff_id))


@router.route("/lecturers/<int:staff_id>/assignments", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(AssignmentFormSchema)
def assign_lecturer(payload,staff_id):
    return result(service.assign_lecturer(staff_id,payload,current_user))


@router.route("/lecturers/<int:staff_id>/stop", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(StopStaffSchema)
def stop_lecturer(payload,staff_id):
    return result(service.stop_lecturer(staff_id,payload,current_user))


@router.route("/accounts", methods=["GET"])
@auth_required(RoleCode.MANAGER)
def accounts():
    return result(service.list_accounts(current_user))


@router.route("/accounts", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(AccountFormSchema)
def create_account(payload):
    return result(service.save_account(payload,current_user),201)


@router.route("/accounts/<int:user_id>", methods=["PUT"])
@auth_required(RoleCode.MANAGER)
@router.arguments(AccountFormSchema)
def update_account(payload,user_id):
    return result(service.save_account(payload,current_user,user_id))


@router.route("/accounts/<int:user_id>/lock", methods=["POST"])
@auth_required(RoleCode.MANAGER)
@router.arguments(LockFormSchema)
def lock_account(payload,user_id):
    return result(service.account_state(user_id,"LOCKED",current_user,payload))


@router.route("/accounts/<int:user_id>/unlock", methods=["POST"])
@auth_required(RoleCode.MANAGER)
def unlock_account(user_id):
    return result(service.account_state(user_id,"ACTIVE",current_user))


@router.route("/accounts/<int:user_id>", methods=["DELETE"])
@auth_required(RoleCode.MANAGER)
def delete_account(user_id):
    return result(service.account_state(user_id,"INACTIVE",current_user))


@router.route("/roles/<string:role>/permissions", methods=["GET"])
@auth_required(RoleCode.MANAGER)
def permissions(role):
    return result(service.role_permissions(role,request.args.get("defaults")=="true"))


@router.route("/roles/<string:role>/permissions", methods=["PUT"])
@auth_required(RoleCode.MANAGER)
@router.arguments(PermissionFormSchema)
def save_permissions(payload,role):
    return result(service.save_permissions(role,payload,current_user))
