"""Cấu hình JWT."""

from flask_jwt_extended import JWTManager

from app.models import User


def register_jwt_callbacks(manager: JWTManager) -> None:
    @manager.user_identity_loader
    def user_identity(user: User) -> str:
        # Claim "sub" của JWT phải là chuỗi
        return str(user.id)
