# NEKO Edu – Backend API

Flask REST API cho nền tảng quản lý trung tâm Anh ngữ NEKO Edu.

- **Flask 3** + **flask-smorest** (routing, validate dữ liệu bằng marshmallow, tự sinh Swagger)
- **flask-cors** cho frontend React
- **pytest** để test

## Yêu cầu

- Python 3.11+

## Cài đặt & chạy

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # rồi sửa giá trị nếu cần

python run.py                      # chạy tại http://127.0.0.1:8000
pytest                             # chạy test
```

| URL | Mô tả |
|---|---|
| `GET /api/v1/health` | Kiểm tra server |
| `/docs` | Swagger UI |
| `/openapi.json` | OpenAPI spec |

## Cấu trúc thư mục

```
backend/
├── app/
│   ├── __init__.py                  # create_app(): tạo app, gắn extension, đăng ký router
│   ├── config.py                    # Cấu hình theo môi trường (development / testing / production)
│   ├── extensions.py                # Khởi tạo extension (api, cors; sau này: db, jwt, ...)
│   ├── routers/
│   │   ├── __init__.py              # register_routers(): đăng ký tất cả router, prefix /api/v1
│   │   └── health_router.py
│   ├── controllers/
│   │   └── health_controller.py
│   ├── services/
│   │   └── health_service.py
│   ├── schemas/
│   │   └── health_schema.py
│   └── common/
│       └── errors.py                # AppError, NotFoundError, ... + handler trả JSON
├── tests/                           # pytest (conftest.py chứa fixture app, client)
├── run.py                   # Entry point
├── requirements.txt         # Thư viện chạy app
├── requirements-dev.txt     # Thư viện cho dev (pytest)
└── .env.example             # Mẫu biến môi trường
```

## Luồng xử lý: router → controller → service

| Layer | Làm gì | Không làm gì |
|---|---|---|
| **router** | Khai báo URL + method, validate input/output bằng schema, gắn auth (sau này), mô tả Swagger | Không viết logic, chỉ gọi controller |
| **controller** | Nhận input đã validate (body, query, path, user hiện tại), gọi service, trả data | Không truy cập database trực tiếp |
| **service** | Business logic, (sau này) làm việc với model/database | Không đọc `request`, không trả response HTTP |
| **schema** | Định nghĩa dữ liệu vào/ra (marshmallow) | |

Lỗi nghiệp vụ thì `raise` lỗi từ `app/common/errors.py` (ví dụ `raise NotFoundError("Không tìm thấy khóa học")`), handler sẽ tự trả JSON.

## Thêm chức năng mới

Ví dụ chức năng `courses`:

1. `app/schemas/course_schema.py`: schema input/output.
2. `app/services/course_service.py`: logic.
3. `app/controllers/course_controller.py`: gọi service.
4. `app/routers/course_router.py`:
   ```python
   router = Blueprint("courses", __name__, description="Quản lý khóa học")

   @router.route("", methods=["POST"])
   @router.arguments(CourseCreateSchema)        # validate body, sai -> 422
   @router.response(201, CourseSchema)          # định dạng output
   def create_course(payload):
       """Tạo khóa học"""
       return course_controller.create_course(payload)
   ```
5. Đăng ký trong `app/routers/__init__.py`:
   ```python
   from app.routers.course_router import router as course_router
   api.register_blueprint(course_router, url_prefix=f"{API_PREFIX}/courses")
   ```
6. Viết test trong `tests/test_courses.py`.

Endpoint mới tự xuất hiện trên Swagger (`/docs`).

## Format lỗi

Mọi lỗi đều trả JSON cùng một dạng:

```json
{ "code": 404, "status": "Not Found", "message": "Không tìm thấy khóa học" }
```

Lỗi validate input (422) có thêm trường `errors` chỉ ra field nào sai.

## Bước tiếp theo

- **Database (PostgreSQL):** thêm `Flask-SQLAlchemy`, `Flask-Migrate`, `psycopg`; khai báo `db`, `migrate` trong `extensions.py`, đọc `DATABASE_URL` trong `config.py`, tạo thư mục `app/models/` (service gọi model).
- **Sprint 1 – Auth:** `auth_router` / `auth_controller` / `auth_service` (login, `/me`), JWT (`flask-jwt-extended`), decorator kiểm tra role Manager/Admin/Staff gắn ở router.
