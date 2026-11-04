from marshmallow import Schema, fields, pre_load, validate

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
