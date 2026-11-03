import os

from dotenv import load_dotenv

load_dotenv()


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Config:
    ENV_NAME = "base"
    DEBUG = False
    TESTING = False

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    CORS_ORIGINS = _split_csv(os.getenv("CORS_ORIGINS", "http://localhost:5173"))

    # OpenAPI / Swagger UI (flask-smorest)
    API_TITLE = "NEKO Edu API"
    API_VERSION = "v1"
    OPENAPI_VERSION = "3.0.3"
    OPENAPI_URL_PREFIX = "/"
    OPENAPI_JSON_PATH = "openapi.json"
    OPENAPI_SWAGGER_UI_PATH = "/docs"
    OPENAPI_SWAGGER_UI_URL = "https://cdn.jsdelivr.net/npm/swagger-ui-dist/"


class DevelopmentConfig(Config):
    ENV_NAME = "development"
    DEBUG = True
    LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG")


class TestingConfig(Config):
    ENV_NAME = "testing"
    TESTING = True
    SECRET_KEY = "test-secret-key"


class ProductionConfig(Config):
    ENV_NAME = "production"
    # Production bắt buộc đặt SECRET_KEY qua biến môi trường, không dùng giá trị mặc định
    SECRET_KEY = os.getenv("SECRET_KEY")


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
