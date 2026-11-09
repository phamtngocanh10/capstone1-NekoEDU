# Database NEKO Edu

Thư mục đầu mối tài liệu database trong monorepo. Database thực tế vẫn là SQL Server `NEKO_EDU`; không nằm trong thư mục source và không được sao chép/reset khi tổ chức lại project.

Giữ nguyên cấu trúc Backend và một nguồn schema duy nhất:

| Thành phần | Nguồn chính |
|---|---|
| SQL schema ban đầu | [0001_initial_schema.sql](../backend/migrations/sql/0001_initial_schema.sql) |
| Các phiên bản migration | [backend/migrations/versions](../backend/migrations/versions/) |
| Seed có thao tác xóa/nạp lại | [03_seed.sql](../backend/seeds/03_seed.sql) |
| Mapping/schema và backup trước đây | [DATABASE.md](../backend/DATABASE.md) |
| Hướng dẫn demo/SSMS | [RUN_DEMO.md](../RUN_DEMO.md) |

[sources.json](sources.json) ghi đường dẫn và SHA-256 của 17 file nguồn hiện có để đối chiếu. Chỉ mục này không chạy SQL và không tạo bản sao schema có thể lệch nhau. Migration/seed giữ trong `backend/` vì Alembic đang tham chiếu các đường dẫn đó; không cần chạy chúng để mở lại demo.

Kiểm tra SQL chỉ đọc từ thư mục gốc:

```powershell
.\backend\.venv\Scripts\python.exe .\backend\scripts\check_demo.py
```
