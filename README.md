# capstone1-NekoEDU

Monorepo chạy demo NEKO Edu. Backend và frontend nằm dưới cùng thư mục gốc; giữ nguyên source giao diện và nghiệp vụ hiện có.

```text
capstone1-NekoEDU/
  backend/    Flask, .venv cục bộ, migrations và seeds gốc
  frontend/   React/Vite, source FE hiện tại
  database/   Tài liệu và chỉ mục nguồn schema/migration/seed
  ai/         Placeholder hiện có; chưa có service AI để chạy
  docs/
```

[Chạy demo và tài khoản](RUN_DEMO.md) · [Database](database/README.md) · [Báo cáo tổ chức lại và khôi phục](MONOREPO.md)

## Cài lần đầu trên máy thành viên (PowerShell)

Mở terminal tại thư mục gốc `capstone1-NekoEDU` vừa clone. Cần Python 3.11 trở lên, Node.js đáp ứng `^20.19.0 || >=22.12.0` theo Vite trong `frontend/package-lock.json`, Microsoft SQL Server và Microsoft ODBC Driver 18 for SQL Server. SQL Server phải có database và quyền kết nối phù hợp với máy của bạn.

```powershell
# Chạy tại thư mục gốc của bản clone; giữ môi trường cục bộ nếu đã có.
if (-not (Test-Path -LiteralPath '.\backend\.venv')) {
    py -3 -m venv .\backend\.venv
}
.\backend\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
npm.cmd --prefix .\frontend ci

# Chỉ tạo cấu hình khi chưa có, không ghi đè .env hiện tại.
if (-not (Test-Path -LiteralPath '.\backend\.env')) {
    Copy-Item -LiteralPath '.\backend\.env.example' -Destination '.\backend\.env'
}
if (-not (Test-Path -LiteralPath '.\frontend\.env')) {
    Copy-Item -LiteralPath '.\frontend\.env.example' -Destination '.\frontend\.env'
}
notepad .\backend\.env
```

Trong `backend/.env`, thay placeholder trong `DATABASE_URL` bằng SQL Server, tên database, tài khoản và mật khẩu được cấp trên máy của bạn; ký tự đặc biệt trong tên/mật khẩu cần URL-encode. Mẫu dùng SQL authentication qua TCP; nếu dùng Windows authentication hoặc named instance, cấu hình kết nối phải tương ứng với SQL Server của bạn. Đặt `SECRET_KEY` và `JWT_SECRET_KEY` riêng; JWT cần ít nhất 32 ký tự ngẫu nhiên. Lệnh tạo một giá trị để tự điền vào mỗi khóa:

```powershell
.\backend\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

Giữ `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1` trong `frontend/.env` khi chạy BE trên cùng máy. Ví dụ CORS cho phép cả `localhost:5173` và `127.0.0.1:5173`. Không đưa `.env` thật hoặc thông tin kết nối cá nhân lên Git.

**Git chỉ chia sẻ source, không tự mang dữ liệu SQL Server hiện tại sang máy thành viên.** Nếu dùng database đã có của nhóm, xin thông tin kết nối được cấp và **không chạy migration/seed/reset chỉ để mở demo**. Nếu chủ động tạo database mẫu mới, trống và riêng trên máy thành viên, đọc [cài Backend và database](backend/README.md#cài-đặt--chạy), [tài liệu database](database/README.md) và [quy trình kiểm tra/nâng cấp](backend/DATABASE.md#nâng-cấp-và-kiểm-tra) trước khi thực hiện. Seed xóa dữ liệu trong database đích; các lệnh kiểm thử phải dùng database riêng kết thúc `_test`. Không áp dụng hướng dẫn tạo database mới lên database nhóm đang dùng.

## Chạy sau khi đã cài và cấu hình

Mở hai Terminal PowerShell tại thư mục gốc. Các ví dụ dưới dùng `D:\capstone1-NekoEDU`; thay `Set-Location` bằng đường dẫn bản clone của bạn nếu khác.

Terminal Backend:

```powershell
Set-Location 'D:\capstone1-NekoEDU'
.\backend\.venv\Scripts\python.exe -m flask --app backend/run.py run --host 127.0.0.1 --port 8000 --no-reload --no-debugger
```

Terminal Frontend:

```powershell
Set-Location 'D:\capstone1-NekoEDU'
npm.cmd --prefix .\frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Mở http://127.0.0.1:5173; API/Swagger tại http://127.0.0.1:8000/docs. Giữ terminal mở. Nếu cổng đang có server từ lần chạy trước, Ctrl+C terminal đó trước khi chạy lại.

Lệnh demo chung có mở trình duyệt và worker hẹn giờ: `node .\backend\scripts\start_demo.mjs`. Worker là hành vi đã có; khi chỉ kiểm tra cấu trúc/kết nối không cần chạy worker.

BE giữ nguyên `.env` và `.venv` tại `backend/`. API base URL, CORS và Vite port không đổi vì chỉ thay vị trí source. Dependencies FE đã được chép cục bộ từ bản đang chạy, được Git bỏ qua. Nếu cần cài lại: `npm.cmd --prefix .\frontend ci`.

Giữ `.env` thật, mật khẩu, `node_modules`, `.venv`, caches và các bản backup ngoài commit. Không cần migration hay seed để mở lại demo.
