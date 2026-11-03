from flask import request

from app.services import auth_service


def login(payload: dict) -> dict:
    return auth_service.authenticate(
        identifier=payload["username"],
        password=payload["password"],
        ip_address=request.remote_addr,
    )

