from app.services import user_service


def list_users(query: dict) -> dict:
    return user_service.list_users(**query)


def get_user(user_id: int):
    return user_service.get_user(user_id)
