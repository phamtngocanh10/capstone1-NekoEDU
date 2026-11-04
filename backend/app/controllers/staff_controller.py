from app.services import staff_service


def list_staff(query: dict) -> list:
    return staff_service.list_staff(**query)
