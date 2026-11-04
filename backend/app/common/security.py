from functools import lru_cache

import bcrypt
from flask import current_app

# bcrypt chỉ xử lý tối đa 72 byte; dài hơn thì thư viện báo lỗi
BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    raw = password.encode("utf-8")
    if len(raw) > BCRYPT_MAX_BYTES:
        raise ValueError(f"Mật khẩu không được dài quá {BCRYPT_MAX_BYTES} byte")
    salt = bcrypt.gensalt(rounds=current_app.config["BCRYPT_ROUNDS"])
    return bcrypt.hashpw(raw, salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    raw = password.encode("utf-8")
    if len(raw) > BCRYPT_MAX_BYTES:
        return False
    try:
        return bcrypt.checkpw(raw, password_hash.encode("utf-8"))
    except ValueError:
        # Hash trong DB không đúng định dạng bcrypt
        return False


def burn_password_check(password: str) -> None:
    """Chạy một lần kiểm tra giả khi không tìm thấy tài khoản, để thời gian phản hồi
    giống trường hợp sai mật khẩu (tránh dò xem username/email có tồn tại hay không)."""
    verify_password(password, _dummy_hash(current_app.config["BCRYPT_ROUNDS"]))


@lru_cache
def _dummy_hash(rounds: int) -> str:
    return bcrypt.hashpw(b"dummy-password", bcrypt.gensalt(rounds=rounds)).decode("utf-8")
