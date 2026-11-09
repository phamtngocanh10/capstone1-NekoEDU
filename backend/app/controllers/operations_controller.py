from flask import request
from flask_jwt_extended import current_user

from app.services import operations_service as service


def read(name, *args):
    return getattr(service, name)(*args, actor=current_user)


def write(name, *args):
    return getattr(service, name)(*args, actor=current_user, ip_address=request.remote_addr)
