from sqlalchemy import text

from app.common.errors import ForbiddenError, NotFoundError
from app.extensions import db
from app.middlewares.auth import MSG_FORBIDDEN
from app.models import RoleCode, User


def require_student_access(actor: User, student_id: int) -> None:
    _require_exists("students", student_id, "Không tìm thấy học viên")
    if actor.role.code == RoleCode.MANAGER:
        return
    if actor.role.code == RoleCode.STUDENT_PARENT:
        allowed = db.session.execute(
            text(
                """
                SELECT TOP 1 1 FROM students s
                WHERE s.id = :id AND (
                    s.user_id = :user_id OR EXISTS (
                        SELECT 1 FROM student_user_links sul
                        WHERE sul.student_id = s.id AND sul.user_id = :user_id
                          AND sul.can_view = 1
                    )
                )
                """
            ),
            {"id": student_id, "user_id": actor.id},
        ).scalar_one_or_none()
    else:
        allowed = db.session.execute(
            text(
                """
                SELECT TOP 1 1
                FROM class_enrollments AS ce
                JOIN classes AS c ON c.id = ce.class_id
                JOIN staff_profiles AS sp ON sp.user_id = :user_id
                WHERE ce.student_id = :student_id
                  AND (c.lecturer_id = sp.id OR c.assistant_id = sp.id)
                """
            ),
            {"student_id": student_id, "user_id": actor.id},
        ).scalar_one_or_none()
    if not allowed:
        raise ForbiddenError(MSG_FORBIDDEN)


def require_class_access(actor: User, class_id: int) -> None:
    _require_exists("classes", class_id, "Không tìm thấy lớp học")
    if actor.role.code == RoleCode.MANAGER:
        return
    if actor.role.code == RoleCode.STUDENT_PARENT:
        allowed = db.session.execute(
            text(
                """
                SELECT TOP 1 1
                FROM class_enrollments AS ce
                JOIN students AS s ON s.id = ce.student_id
                WHERE ce.class_id = :class_id AND (
                    s.user_id = :user_id OR EXISTS (
                        SELECT 1 FROM student_user_links sul
                        WHERE sul.student_id = s.id AND sul.user_id = :user_id
                          AND sul.can_view = 1
                    )
                )
                """
            ),
            {"class_id": class_id, "user_id": actor.id},
        ).scalar_one_or_none()
    else:
        allowed = db.session.execute(
            text(
                """
                SELECT TOP 1 1
                FROM classes AS c
                JOIN staff_profiles AS sp ON sp.user_id = :user_id
                WHERE c.id = :class_id
                  AND (c.lecturer_id = sp.id OR c.assistant_id = sp.id)
                """
            ),
            {"class_id": class_id, "user_id": actor.id},
        ).scalar_one_or_none()
    if not allowed:
        raise ForbiddenError(MSG_FORBIDDEN)


def require_invoice_access(actor: User, invoice_id: int) -> None:
    _require_exists("tuition_invoices", invoice_id, "Không tìm thấy phiếu học phí")
    if actor.role.code == RoleCode.MANAGER:
        return
    if actor.role.code != RoleCode.STUDENT_PARENT:
        raise ForbiddenError(MSG_FORBIDDEN)
    allowed = db.session.execute(
        text(
            """
            SELECT 1
            FROM tuition_invoices AS i
            JOIN students AS s ON s.id = i.student_id
            WHERE i.id = :invoice_id AND (
                s.user_id = :user_id OR EXISTS (
                    SELECT 1 FROM student_user_links sul
                    WHERE sul.student_id = s.id AND sul.user_id = :user_id
                      AND sul.can_view = 1
                )
            )
            """
        ),
        {"invoice_id": invoice_id, "user_id": actor.id},
    ).scalar_one_or_none()
    if not allowed:
        raise ForbiddenError(MSG_FORBIDDEN)


def require_session_access(actor: User, session_id: int) -> None:
    session = db.session.execute(
        text("SELECT class_id FROM class_sessions WHERE id = :session_id"),
        {"session_id": session_id},
    ).mappings().one_or_none()
    if session is None:
        raise NotFoundError("Không tìm thấy buổi học")
    if actor.role.code == RoleCode.MANAGER:
        return
    if actor.role.code == RoleCode.STUDENT_PARENT:
        allowed = db.session.execute(
            text(
                """
                SELECT TOP 1 1
                FROM class_enrollments AS ce
                JOIN students AS s ON s.id = ce.student_id
                WHERE ce.class_id = :class_id AND (
                    s.user_id = :user_id OR EXISTS (
                        SELECT 1 FROM student_user_links sul
                        WHERE sul.student_id = s.id AND sul.user_id = :user_id
                          AND sul.can_view = 1
                    )
                )
                """
            ),
            {"class_id": session["class_id"], "user_id": actor.id},
        ).scalar_one_or_none()
    else:
        allowed = db.session.execute(
            text(
                """
                SELECT TOP 1 1
                FROM class_sessions AS cs
                JOIN classes AS c ON c.id = cs.class_id
                JOIN staff_profiles AS sp ON sp.user_id = :user_id
                WHERE cs.id = :session_id
                  AND (
                    c.lecturer_id = sp.id OR c.assistant_id = sp.id OR
                    cs.lecturer_id = sp.id OR cs.assistant_id = sp.id
                  )
                """
            ),
            {"session_id": session_id, "user_id": actor.id},
        ).scalar_one_or_none()
    if not allowed:
        raise ForbiddenError(MSG_FORBIDDEN)


def _require_exists(table_name: str, resource_id: int, message: str) -> None:
    exists = db.session.execute(
        text(f"SELECT 1 FROM {table_name} WHERE id = :resource_id"),
        {"resource_id": resource_id},
    ).scalar_one_or_none()
    if not exists:
        raise NotFoundError(message)
