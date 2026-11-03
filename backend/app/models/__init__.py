"""Model (SQLAlchemy): ánh xạ bảng trong database. Chỉ service được dùng model.

Schema gốc do team Database quản lý (migrations/sql/). Khi khai báo model mới,
kiểu dữ liệu và tên constraint phải khớp schema; kiểm tra bằng: flask db check
"""

from app.models.audit_log import AuditAction, AuditLog
from app.models.role import STAFF_ROLES, Role, RoleCode
from app.models.staff_profile import StaffPosition, StaffProfile, StaffStatus
from app.models.user import User, UserStatus

__all__ = [
    "STAFF_ROLES",
    "AuditAction",
    "AuditLog",
    "Role",
    "RoleCode",
    "StaffPosition",
    "StaffProfile",
    "StaffStatus",
    "User",
    "UserStatus",
]
