from app.services import health_service


def get_health() -> dict:
    return health_service.get_health_status()
