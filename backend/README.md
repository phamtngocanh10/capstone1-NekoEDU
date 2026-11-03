# NEKO Edu – Backend API

Flask REST API cho nền tảng quản lý trung tâm Anh ngữ NEKO Edu.

- **Flask 3** + **flask-smorest** (routing, validate dữ liệu bằng marshmallow, tự sinh Swagger)
- **PostgreSQL** + **Flask-SQLAlchemy** + **Flask-Migrate** (Alembic)
- **JWT** (Flask-JWT-Extended), mật khẩu băm **bcrypt**
- **pytest** để test

## Yêu cầu

- Python 3.11+
- PostgreSQL 14+

## Cài đặt & chạy

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # sửa DATABASE_URL, TEST_DATABASE_URL, JWT_SECRET_KEY

# Tạo 2 database (dev + test)
createdb neko_edu
createdb neko_edu_test

flask db upgrade                   # tạo bảng (migration)
flask seed                         # nạp dữ liệu mẫu (XÓA dữ liệu cũ, có hỏi xác nhận)

python run.py                      # http://127.0.0.1:8000, Swagger: http://127.0.0.1:8000/docs
pytest                             # chạy test (dùng TEST_DATABASE_URL)
```

### Tài khoản mẫu (sau khi `flask seed`)

Mật khẩu chung: **`Neko@2026`**

| Role | Username | Email |
|---|---|---|
| Manager | `mg01`, `mg02` | `mg01@neko.edu.vn` |
| Giảng viên (LECTURER) | `gv01` … `gv08` | `gv01@neko.edu.vn` |
| Trợ giảng (TEACHING_ASSISTANT) | `tg01` … `tg05` | `tg01@neko.edu.vn` |
| Học viên/Phụ huynh (STUDENT_PARENT) | `hs001` … `hs170` | (không có) |

## API

| Method | URL | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/v1/health` | Public | Kiểm tra server |
| POST | `/api/v1/auth/login` | Public | Đăng nhập bằng username **hoặc** email |
| GET | `/api/v1/auth/me` | Đã đăng nhập | Thông tin tài khoản hiện tại |
| GET | `/api/v1/users` | Manager | Danh sách tài khoản: `page`, `page_size` (≤100), `role`, `status`, `q` |
| GET | `/api/v1/users/<id>` | Manager | Chi tiết tài khoản |
| GET | `/api/v1/staff` | Staff (Manager, GV, TG) | Danh bạ nhân sự: `position`, `status` |

Chi tiết request/response xem trên Swagger `/docs`. Bấm **Authorize** rồi dán access token để gọi thử API cần đăng nhập.

### Demo: Login → nhận token → gọi API private

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "mg01", "password": "Neko@2026"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

curl http://127.0.0.1:8000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"     # 200
curl http://127.0.0.1:8000/api/v1/users   -H "Authorization: Bearer $TOKEN"     # 200 (Manager)
curl http://127.0.0.1:8000/api/v1/users                                          # 401 (chưa đăng nhập)
```

### Quy tắc xác thực & phân quyền

- **Đăng nhập:**
  - Có `@` thì tìm theo email (không phân biệt hoa thường), ngược lại tìm theo username (phân biệt hoa thường). Username được bỏ khoảng trắng hai đầu, mật khẩu thì giữ nguyên.
  - Sai username/email hay sai mật khẩu đều trả **cùng một lỗi 401**, nên không dò được tài khoản nào tồn tại.
  - Tài khoản `LOCKED`/`INACTIVE` chỉ nhận **403** khi đã nhập đúng mật khẩu.
  - Đăng nhập thành công thì cập nhật `last_login_at` và ghi `audit_logs` (action `LOGIN`, kèm IP).
- **Token:**
  - JWT HS256, hạn mặc định 480 phút (`JWT_ACCESS_TOKEN_EXPIRES_MINUTES`). Gửi ở header `Authorization: Bearer <token>`.
  - Token thiếu, sai, bị sửa hay hết hạn đều trả **401**.
  - Tài khoản bị xóa hoặc khóa **sau khi** đăng nhập thì token cũ không dùng được nữa (401).
- **Phân quyền:**
  - Role luôn lấy từ **DB** ở mỗi request, không tin claim `role` trong token, nên đổi role là có hiệu lực ngay.
  - Không đủ quyền thì trả **403**.
  - Quyền được kiểm tra **trước** khi validate input: chưa đăng nhập hoặc không đủ quyền sẽ nhận 401/403 chứ không nhận 422.

## Database & migration

- Schema gốc do team Database quản lý. Migration đầu tiên (`migrations/versions/0001_initial_schema.py`) chạy file `migrations/sql/0001_initial_schema.sql`, tức `01_schema.sql` gồm 27 bảng.
- **Không sửa** file SQL đó. Khi schema thay đổi, tạo migration mới:
  ```bash
  flask db migrate -m "mo ta thay doi"   # autogenerate từ model
  flask db revision -m "mo ta"          # hoặc migration viết tay (op.execute SQL)
  flask db upgrade
  ```
- Model (`app/models/`) mới chỉ khai báo các bảng đang dùng (`roles`, `users`, `staff_profiles`, `audit_logs`). Kiểu dữ liệu và tên constraint phải khớp schema. Kiểm tra bằng `flask db check`; test `test_models_match_database_schema` cũng kiểm tra việc này.
- Autogenerate **bỏ qua** các bảng chưa có model và bỏ qua comment cột (xem `migrations/env.py`), nên không sinh nhầm lệnh `DROP TABLE`.
- Dữ liệu mẫu: `seeds/03_seed.sql`, nạp bằng `flask seed` (`--yes` để bỏ qua bước xác nhận). Lệnh này không chạy trên production.

## Cấu trúc thư mục

```
backend/
├── app/
│   ├── __init__.py                  # create_app(): tạo app, gắn extension, đăng ký router
│   ├── config.py                    # Cấu hình theo môi trường (development / testing / production)
│   ├── extensions.py                # api, db, migrate, jwt, cors
│   ├── commands.py                  # Lệnh CLI: flask seed
│   ├── routers/                     # URL + middleware + schema + Swagger
│   │   ├── __init__.py              # register_routers(), prefix /api/v1
│   │   ├── auth_router.py
│   │   ├── user_router.py
│   │   ├── staff_router.py
│   │   └── health_router.py
│   ├── middlewares/
│   │   └── auth.py                  # auth_required(*roles) + xử lý lỗi JWT
│   ├── controllers/                 # auth_, user_, staff_, health_controller.py
│   ├── services/                    # auth_, user_, staff_, health_service.py
│   ├── models/                      # Role, User, StaffProfile, AuditLog
│   ├── schemas/                     # marshmallow: auth_, user_, staff_, common_schema.py
│   └── common/
│       ├── errors.py                # AppError, NotFoundError, ... + handler trả JSON
│       └── security.py              # hash/verify mật khẩu (bcrypt)
├── migrations/                      # Alembic (Flask-Migrate)
│   ├── sql/0001_initial_schema.sql  # Schema gốc từ team Database
│   └── versions/
├── seeds/03_seed.sql                # Dữ liệu mẫu
├── tests/                           # pytest
├── run.py                           # Entry point
├── requirements.txt / requirements-dev.txt
├── .env.example                     # Mẫu biến môi trường
└── .flaskenv                        # FLASK_APP=run.py cho lệnh flask
```

## Luồng xử lý: router → middleware → controller → service → model

| Layer | Làm gì | Không làm gì |
|---|---|---|
| **router** | Khai báo URL + method, gắn `auth_required`, validate input/output bằng schema, mô tả Swagger | Không viết logic, chỉ gọi controller |
| **middleware** | Xác thực token, kiểm tra role | |
| **controller** | Nhận input đã validate (body, query, path, user hiện tại), gọi service, trả data | Không truy cập database trực tiếp |
| **service** | Business logic, làm việc với model/database | Không đọc `request`, không trả response HTTP |
| **model** | Ánh xạ bảng database | |
| **schema** | Định nghĩa dữ liệu vào/ra (marshmallow) | |

Lỗi nghiệp vụ thì `raise` lỗi từ `app/common/errors.py` (ví dụ `raise NotFoundError("Không tìm thấy khóa học")`), handler sẽ tự trả JSON.

## Thêm chức năng mới

Ví dụ chức năng `courses`:

1. `app/models/course.py`: model, khớp với bảng `courses` (chạy `flask db check`).
2. `app/schemas/course_schema.py`: schema input/output.
3. `app/services/course_service.py`: logic.
4. `app/controllers/course_controller.py`: gọi service.
5. `app/routers/course_router.py`:
   ```python
   router = Blueprint("courses", __name__, description="Quản lý khóa học")

   @router.route("", methods=["POST"])
   @auth_required(RoleCode.MANAGER)             # đặt ngay dưới route: kiểm tra quyền trước
   @router.arguments(CourseCreateSchema)        # validate body, sai -> 422
   @router.response(201, CourseSchema)          # định dạng output
   def create_course(payload):
       """Tạo khóa học"""
       return course_controller.create_course(payload)
   ```
   API public (không cần token) thêm `@router.doc(security=[])` để Swagger không đòi token.
6. Đăng ký trong `app/routers/__init__.py`:
   ```python
   from app.routers.course_router import router as course_router
   api.register_blueprint(course_router, url_prefix=f"{API_PREFIX}/courses")
   ```
7. Viết test trong `tests/test_courses.py` (dùng fixture `users`, `auth_header` trong `conftest.py`).

## Format lỗi

Mọi lỗi đều trả JSON cùng một dạng:

```json
{ "code": 403, "status": "Forbidden", "message": "Bạn không có quyền thực hiện chức năng này" }
```

Lỗi validate input (422) có thêm trường `errors` chỉ ra field nào sai:

```json
{ "code": 422, "status": "Unprocessable Entity", "message": "Dữ liệu gửi lên không hợp lệ",
  "errors": { "json": { "password": ["Missing data for required field."] } } }
```

## Test

```bash
pytest          # 87 test: login, token, phân quyền, users, staff, migration, seed
```

Test chạy trên `TEST_DATABASE_URL`. Mỗi lần chạy, DB test bị **xóa sạch** rồi migrate lại, nên tên DB bắt buộc kết thúc bằng `_test` (test sẽ dừng nếu không đúng).
