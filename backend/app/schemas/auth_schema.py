from marshmallow import Schema, ValidationError, fields, pre_load, validate, validates_schema

from app.common.security import BCRYPT_MAX_BYTES
from app.schemas.user_schema import UserSchema


class LoginSchema(Schema):
    username = fields.String(
        required=True,
        validate=validate.Length(min=1, max=150),
        metadata={"description": "Username hoặc email", "example": "mg01"},
    )
    # Không strip mật khẩu: khoảng trắng có thể là một phần của mật khẩu
    password = fields.String(
        required=True,
        load_only=True,
        validate=validate.Length(min=1, max=72),
        metadata={"example": "Neko@2026"},
    )

    @pre_load
    def strip_username(self, data, **kwargs):
        if isinstance(data, dict) and isinstance(data.get("username"), str):
            data = {**data, "username": data["username"].strip()}
        return data


class LoginResponseSchema(Schema):
    access_token = fields.String()
    token_type = fields.String(metadata={"example": "Bearer"})
    expires_in = fields.Integer(metadata={"description": "Số giây còn lại trước khi token hết hạn"})
    user = fields.Nested(UserSchema)


class CurrentUserSchema(UserSchema):
    profile = fields.Raw(
        allow_none=True,
        metadata={"description": "Hồ sơ nhân sự hoặc học viên liên kết với tài khoản"},
    )
    profiles = fields.List(
        fields.Raw(),
        metadata={"description": "Tất cả hồ sơ học viên tài khoản được phép xem"},
    )


def validate_password_bytes(value: str) -> None:
    if len(value.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValidationError(f"Mật khẩu không được dài quá {BCRYPT_MAX_BYTES} byte")


class ChangePasswordSchema(Schema):
    current_password = fields.String(required=True, load_only=True, validate=validate.Length(min=1))
    new_password = fields.String(
        required=True,
        load_only=True,
        validate=[validate.Length(min=8), validate_password_bytes],
    )
    confirm_password = fields.String(required=True, load_only=True)

    @validates_schema
    def passwords_match(self, data, **kwargs):
        if data.get("new_password") != data.get("confirm_password"):
            raise ValidationError("Mật khẩu xác nhận không khớp", field_name="confirm_password")
