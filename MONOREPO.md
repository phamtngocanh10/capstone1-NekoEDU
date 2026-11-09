# Tổ chức monorepo NEKO Edu

Ngày kiểm tra theo múi giờ Asia/Saigon: **09/11/2026**. Phạm vi đợt này là tổ chức thư mục, đường dẫn cấu hình và kiểm tra chỉ đọc. Không sửa nghiệp vụ, UI/component/CSS, schema hoặc dữ liệu SQL Server.

## Cấu trúc và Git trước khi tổ chức

| Phần | Worktree đang dùng | Branch / HEAD ban đầu | Thay đổi chưa commit ban đầu |
|---|---|---|---|
| BE | D:\capstone1-NekoEDU | feature/backend-api / fe0cf8e | 22 file sửa, 42 file mới |
| FE | D:\NekoEDU-FE | FE / 2e05275 | 82 file sửa, 3 file mới |
| AI | D:\NekoEDU-MAIN | main / df8e8e3 | Sạch |

Cả ba là linked worktree của **cùng một repository**, chung `D:\capstone1-NekoEDU\.git`, không phải các repository độc lập. Vì vậy không cần merge lịch sử, checkout hay chuyển `.git`. Trước khi thực hiện, cấu trúc và kế hoạch sao lưu/sao chép đã được trình bày trong cuộc trao đổi.

## Cấu trúc hiện tại

```text
D:\capstone1-NekoEDU\
  .git\
  .gitignore
  .vscode\
  backend\
    app\
    migrations\
    seeds\
    scripts\
    tests\
    .env       (cục bộ, Git bỏ qua)
    .venv\     (cục bộ, Git bỏ qua)
  frontend\
    src\
    scripts\   (giữ cả thư mục rỗng gốc)
    package.json
    package-lock.json
    vite.config.js
    node_modules\ (cục bộ, Git bỏ qua)
  database\
    README.md
    sources.json
  ai\
    README.md  (placeholder gốc)
  docs\
  NekoEDU.code-workspace
  RUN_DEMO.md
```

FE được **sao chép**, giữ nguyên cả thay đổi chưa commit và file source mới; worktree nguồn không bị di chuyển/xóa. Đây là một bản nhập source vào working tree hiện tại, chưa stage hoặc commit. Các branch và HEAD giữ nguyên.

AI ở worktree được chỉ định chỉ có README trống, giống hệt placeholder ở đích; không có service/model/requirements AI để chuyển hoặc chạy. Không tự lấy một thư mục khác ngoài workspace làm AI.

Database giữ một nguồn schema duy nhất trong Backend. `database/` là đầu mối tài liệu và chỉ mục SHA-256 cho 17 nguồn SQL/migration. Không di chuyển migration/seed để bảo toàn cấu trúc BE và đường dẫn Alembic; không sao chép dữ liệu SQL Server vào repository.

## File thay đổi trong đợt này

- Sao chép 147 file và 44 thư mục FE vào `frontend/`, giữ nguyên nội dung.
- `backend/scripts/start_demo.mjs`: chỉ đổi nguồn FE từ worktree ngoài sang `../frontend`.
- `NekoEDU.code-workspace`: đường dẫn FE/AI thành `frontend`/`ai`; thêm đầu mối Database.
- Thêm `.vscode/tasks.json` và `.vscode/launch.json` ở gốc để chạy từ thư mục monorepo.
- Thêm `.gitignore` gốc cho secrets, dependencies, cache và backup; giữ `.env.example` được phép quản lý bằng Git.
- Cập nhật README/hướng dẫn bằng đường dẫn mới; thêm tài liệu/database index và hai utility sao lưu/kiểm tra dùng riêng cho đợt chuyển thư mục. Các utility đã được lưu riêng sau khi hoàn tất, xem phần dọn source bên dưới.
- Giữ nguyên `.env` thật và `.venv` Backend. Không cần dựng lại virtual environment.
- Giữ API base URL `http://127.0.0.1:8000/api/v1`, origin FE `http://127.0.0.1:5173`, cấu hình CORS/Vite và import FE hiện có.

Không thực hiện commit, stage, checkout, merge, reset, xóa branch hoặc chuyển `.git`.

## Sao lưu và khôi phục

Bản sao riêng, nằm trong thư mục được Git bỏ qua:

```text
D:\capstone1-NekoEDU\backend\.local-backups\monorepo-before-20261108_173436_517135\
```

Tên backup dùng thời gian UTC. Bên trong có:

- `repository.bundle`: lịch sử/refs Git, đã chạy bundle verify.
- `manifest.json`: branch/HEAD, đường dẫn và checksum file trước khi chép.
- `files/root/`: 176 file dự án trước thay đổi, gồm cấu hình cục bộ cần bảo vệ; dependencies/cache/backups cũ không nhân bản.
- `files/frontend/`: 147 file FE; `files/ai/`: README AI.
- `*-working.patch`, `*-staged.patch`, `*-status.txt`: trạng thái chưa commit của từng worktree.
- `conflicts/frontend/README.md`: README trống ở đích được lưu riêng trước khi chép; không ghi đè.
- `copy-verified.json`, `frontend-directories.json`, `verification.json`: bằng chứng đối chiếu.

Cách quay về nguồn cũ ít tác động nhất: mở lại `D:\NekoEDU-FE` và `D:\NekoEDU-MAIN`; các thư mục nguồn còn nguyên. Các file cấu hình trước thay đổi nằm tại `files/root/` trong backup. Nếu cần khôi phục cấu trúc gốc, giữ riêng thư mục `frontend/` mới trước rồi lấy README placeholder và các file cấu hình gốc từ backup; không chạy reset/clean hoặc ghi đè code mới chưa được lưu. Backup chứa cấu hình cục bộ, không đưa lên Git.

## Kiểm tra đã thực hiện

| Kiểm tra | Kết quả |
|---|---|
| 147 file FE mới so với snapshot và source cũ | SHA-256 khớp |
| 143 file app/migration/seed/test BE so với snapshot | Không đổi nội dung |
| Branch và HEAD cả ba worktree | Không đổi |
| Backend .env và AI placeholder | Không đổi checksum |
| FE build tại frontend mới | PASS, 2241 modules |
| Flask chạy từ gốc với --app backend/run.py | Nạp đủ router; HTTP health200 trên cổng thử18000 |
| HTTP FE mới tại5173 | PASS, Vite hoạt động |
| API danh mục có xác thực đọc SQL | PASS, 8 khóa/5 phòng/15 nhân sự |
| API theo base URL thực tế8000 và CORS origin5173 | PASS |
| Schema NEKO_EDU trên SQLEXPRESS | 0012,69 bảng,161 FK hợp lệ |
| Số bản ghi và6 tổng tiền trước/sau kiểm tra | Không đổi |
| .env/dependencies/caches/backups bị Git bỏ qua | PASS |

Mốc SQL trong đợt này: 173 học viên,16 lớp,185 tài khoản,488 hóa đơn,427 thanh toán. Không dùng mốc16 lớp này để ghi đè trạng thái cũ; đó là dữ liệu hiện có khi bắt đầu đợt tổ chức lại.

Kiểm tra HTTP dùng token tạo trong bộ nhớ cho một Manager đang hoạt động; không gọi đăng nhập, không đổi last_login/audit. Probe SQL chỉ cho SELECT ở connection kiểm tra; không chạy pytest fixture, migration, seed hay worker. Server FE cũ được chuyển sang source monorepo mới; server BE thử cổng18000 được dừng sau kiểm tra.

## Lệnh chạy từ thư mục gốc

Terminal1 — Backend:

```powershell
Set-Location 'D:\capstone1-NekoEDU'
.\backend\.venv\Scripts\python.exe -m flask --app backend/run.py run --host 127.0.0.1 --port 8000 --no-reload --no-debugger
```

Terminal2 — Frontend:

```powershell
Set-Location 'D:\capstone1-NekoEDU'
npm.cmd --prefix .\frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Mở http://127.0.0.1:5173. Nếu đã có server tại cổng tương ứng, Ctrl+C terminal cũ trước. Lệnh chung: `node .\backend\scripts\start_demo.mjs`; hành vi worker hẹn giờ cũ được giữ nguyên. F5/Ctrl+Shift+B khi mở thư mục gốc dùng cấu hình mới.

Nếu cần cài lại FE: `npm.cmd --prefix .\frontend ci`. Nếu `.venv` hỏng/mất, tạo lại tại `backend/.venv` bằng Python hiện có và cài `backend/requirements.txt`; giữ `.env` riêng. Đợt này không cần cài lại Python.

## Phần chưa kiểm chứng trong đợt tổ chức thư mục

- Chưa bấm thủ công toàn bộ màn hình/CRUD; không thử ghi dữ liệu thật vì phạm vi chỉ tổ chức project.
- Không kiểm thử gửi email/push hoặc chạy mô hình AI; AI trong workspace chỉ là placeholder.
- Chưa thử cài dependencies từ mạng trên máy khác: đã dùng node_modules hiện có và build thành công trên máy này.
- Không kích hoạt worker, migration/seed hoặc nâng schema để kiểm tra.
- `.env.example` FE gốc vẫn ghi URL8080/api, khác mặc định client8000/api/v1. Không thay file gốc vì không phát sinh từ di chuyển; đợt này không tạo .env FE từ example đó, base URL thực tế đã kiểm tra đúng.

## Dọn source để chia sẻ cho nhóm — 09/11/2026

Sau khi demo hoàn tất, ba script chạy một lần (`organize_monorepo.py`, `verify_monorepo.py`, `report_integration.py`) và bản component `.bak` cũ được kiểm chứng checksum, lưu riêng rồi xóa khỏi source. Thư mục `frontend/scripts/` rỗng cùng build/cache sinh tự động đã được dọn. Giữ nguyên runtime, tests, migration, seed, package-lock, giao diện và cấu hình `.env` thật.

Bản lưu trước khi dọn nằm tại `backend/.local-backups/cleanup-before-20261109_group-share/`; thư mục này được Git bỏ qua. Những file đã bỏ nằm trong `files/`, kèm `cleanup-plan.json`, `source-before.json` và `cleanup-result.json`. Không cần các script lịch sử này để cài hoặc chạy dự án. `README.md` ở gốc có hướng dẫn cài lần đầu cho máy thành viên; dùng `.env.example` để tạo cấu hình riêng.
