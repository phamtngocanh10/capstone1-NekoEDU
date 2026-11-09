# Kết quả tích hợp dữ liệu NEKO EDU

Ngày 08/11/2026. Giữ CSS/bố cục/menu FE, sửa logic dữ liệu và API. Không reset NEKO_EDU; dùng schema0012 hiện có, không có migration mới trong đợt tích hợp API này.

Đã kiểm tra **23 nhóm chức năng**: **22 nhóm nối/sửa**, **1 nhóm quy tắc học phí cũ giữ nguyên**. Các nhóm dưới đây có bằng chứng API/SQL; không đồng nghĩa đã bấm thủ công mọi nút trên trình duyệt.

Kết quả cuối theo từng case (gộp các lượt, ca chạy lại thay kết quả cũ): **952 PASS, 0 FAIL, 0 SKIP**. Riêng luồng tích hợp mới: **83 case / 61 hàm kiểm thử**.

Các lượt chạy được ghi bên dưới. Một bài test đứng đúng ranh giới hai ngày được chuyển sang mốc ba ngày; một bài test quyền sửa kỳ vọng thành403 đúng quy tắc chưa được phân công. Không sửa quy tắc production để làm các kỳ vọng sai này qua.

| Module | Chức năng | Lỗi phát hiện | Cách sửa | Kết quả |
|---|---|---|---|---|
| Xác thực | Đăng nhập/đăng xuất/đổi mật khẩu | FE từng có nhánh demo và hash local | JWT, thu hồi token và hash BE | PASS API/SQL |
| Hồ sơ | Sửa thông tin/ảnh | Chỉ đổi state | Lưu users + binary stored_files, đọc lại phiên mới | PASS API/SQL |
| Khôi phục | Đặt lại bằng liên kết | Chỉ báo mật khẩu hợp lệ | Link có hạn/dùng một lần, SQL auth_version; SMTP thiếu báo 503 | PASS API/SQL |
| Học viên | Thêm/sửa/ngừng học | Liên kết lớp và tài khoản còn mock | Giữ API tạo cũ; adapter transaction, xóa mềm, refetch | PASS API/SQL |
| Phụ huynh | Liên kết gia đình/tài khoản | Thiếu giao dịch liên kết | Đối chiếu điện thoại; rollback toàn bộ, audit phụ huynh chung | PASS API/SQL |
| Ghi danh | Xếp lớp/chưa xếp lớp | Lớp mẫu không khớp SQL | Khóa/cấp thật, giới hạn chỗ/ngày; hồ sơ chưa có lớp vẫn lưu | PASS API/SQL |
| Khóa/lớp | Đọc/tạo/sửa/ngừng lớp trống | Store mẫu | Catalog SQL, lịch36buổi, kiểm tra trùng/capacity, bảo vệ lớp có lịch sử | PASS API/SQL |
| Giảng viên | Hồ sơ/phân công/thay thế/ngừng | Chỉ state hoặc toast | Users/staff/classes/sessions cùng transaction | PASS API/SQL |
| Tài khoản | Tạo/sửa/khóa/mở/ngừng | Mock, hạn khóa chưa áp dụng | SQL, hash, metadata khóa; hết hạn giữ token cũ vô hiệu | PASS API/SQL |
| Phân quyền | Lưu/khôi phục ma trận | Toast, chưa thực thi | 36 ô SQL; DENY ở middleware, không vượt vai trò/phạm vi | PASS API/SQL |
| Lịch | Đọc/hủy/thông báo/học bù chờ xếp | Lịch trình duyệt | SQL session; hủy và thông báo atomic, bảo toàn tính học phí | PASS API/SQL |
| Điểm danh | Đọc/lưu/sửa | localStorage | SQL attendance/history, phạm vi lớp, yêu cầu tính lại học phí | PASS API/SQL |
| Điểm | Nháp/xác nhận/công bố/mở lại | Mock hoặc localStorage | 4 kỹ năng + điểm tổng hợp, version và transaction | PASS API/SQL |
| Kỳ điểm | Thiết lập/nhắc/hẹn công bố | Thiết lập mẫu | Grading periods, deadline, worker, giữ offset +07 | PASS API/SQL |
| Nhập dữ liệu | Nhập học viên/điểm từ file | Chưa ghi SQL đầy đủ | XLSX/CSV preview/validation và rollback cả lô | PASS API/SQL |
| Tài liệu | Upload/đổi tên/chia sẻ/tải/gỡ | IndexedDB và metadata giả | Binary SQL + scope + lịch sử + xóa mềm | PASS API/SQL |
| Nhận xét | Lưu/đọc lại | Local state | Student comments, học viên đúng lớp | PASS API/SQL |
| Trợ giảng | Phân công/cấp/thu hồi/nộp/duyệt/trả | Workflow trình duyệt | Assignment/request/grant/submission SQL và trigger bảo vệ | PASS API/SQL |
| Học phí | 8 buổi/giảm10%/vắng/hủy/điều chỉnh | BE đã có nghiệp vụ | Giữ quy tắc; không tạo chính sách hay thu giả khi chưa cấu hình | PASS API/SQL |
| Thanh toán | Thu/biên lai/lịch sử/minh chứng | State mẫu | SQL transaction, khóa hóa đơn, chống vượt nợ và retry trùng | PASS API/SQL |
| Thu chi/lương | Thu/chi/chứng từ/chốt lương | State trang | Ledger idempotent, giờ hoàn thành; bảo toàn lương SESSION cũ | PASS API/SQL |
| Thông báo | Tự lưu/nháp/hẹn/gửi/tệp/đọc/phản hồi/nhắc | Store mẫu, autosave chỉ là chữ | SQL, PATCH draft, worker nội bộ; external delivery PENDING | PASS API/SQL |
| Tổng quan/tuyển sinh | Đọc chỉ số/cảnh báo/duyệt đề xuất | Số liệu/AI mẫu | Aggregate SQL và lưu review; dự báo rỗng khi chưa có mô hình | PASS API/SQL |

## Bằng chứng chạy

| Artifact JUnit | Số case | PASS | FAIL |
|---|---:|---:|---:|
| .local-backups/full-integration-results.xml | 948 | 947 | 1 |
| .local-backups/profile-recovery-results.xml | 26 | 26 | 0 |
| .local-backups/operations-final-results.xml | 42 | 42 | 0 |
| .local-backups/lecturer-final-results.xml | 12 | 12 | 0 |
| .local-backups/permission-final-results.xml | 21 | 20 | 1 |
| .local-backups/permission-recheck-results.xml | 2 | 2 | 0 |

Build cuối: `npm.cmd run build` thành công; Python compile, Node syntax và 10 test offline bảo vệ ODBC thành công. Các file CSS, menu, router path và Vite config của FE giữ nguyên (router chỉ bổ sung yêu cầu token).

Kiểm tra dữ liệu thật chỉ đọc: 36 request, 35 trả200; 1 trả404 đúng trạng thái Manager chưa tạo kỳ nhập điểm. Script chặn câu SQL ghi: `.local-backups/integration-read-results.json`.

Mốc NEKO_EDU: 173 học viên,15 lớp,185 tài khoản,488 hóa đơn,427 thanh toán. Sáu tổng tiền giữ nguyên: gốc488.000.000; phải thu478.000.000; đã thu417.800.000; payments417.800.000; ledger727.286.000; payroll152.380.000. Kiểm thử chỉ dọn ba database *_test được tạo trước đó, không tạo database mới trong đợt này.

Các bài test xác minh bằng truy vấn SQL trực tiếp và phiên/client mới; một số case dispose connection pool trước khi đọc lại. Chưa có kiểm thử thao tác thủ công đủ mọi màn hoặc khởi động lại cả FE+BE bằng trình duyệt: browser automation host không khả dụng. Không đánh dấu phần đó PASS.

## Giới hạn còn lại

- Email/push ra ngoài chưa có transport: lưu PENDING. In-app và worker hẹn giờ đã kiểm thử SQL.
- Email khôi phục chưa có SMTP thật: báo503; đường reset token đã kiểm thử SQL với transport giả lập, không gửi email ra ngoài.
- Chưa có mô hình/kết quả AI thật trong database: trả danh sách rỗng, không làm giả dự báo.
- Database chưa có chính sách học phí mới; có thể cấu hình qua API cũ. FE gốc chưa có form tạo chính sách/hóa đơn: không thêm UI; hồ sơ vẫn lưu, thu trên hóa đơn thật có sẵn.
- Hai nút điều hướng gốc Quản lý mẫu/Xem tất cả đơn từ chưa có editor/màn hình nguồn. Không tự thêm UI thay cho thiết kế nhóm.

## API và bảng

Các router auth/management/lecturer/workflows/operations đăng ký **104 hợp đồng method/path** (gồm auth cũ được giữ). Danh sách cụ thể:

- `DELETE /api/v1/lecturer/documents/<int:did>`
- `DELETE /api/v1/manager/accounts/<int:user_id>`
- `DELETE /api/v1/manager/catalog/courses/<int:item_id>`
- `DELETE /api/v1/manager/classes/<int:class_id>`
- `DELETE /api/v1/manager/rooms/<int:item_id>`
- `DELETE /api/v1/manager/students/<int:student_id>`
- `GET /api/v1/auth/avatar`
- `GET /api/v1/auth/me`
- `GET /api/v1/lecturer/assistant-candidates`
- `GET /api/v1/lecturer/assistants`
- `GET /api/v1/lecturer/assistants/<int:sid>/submission`
- `GET /api/v1/lecturer/classes`
- `GET /api/v1/lecturer/classes/<int:cid>/comments`
- `GET /api/v1/lecturer/classes/<int:cid>/grades`
- `GET /api/v1/lecturer/classes/<int:cid>/grading-window`
- `GET /api/v1/lecturer/classes/<int:cid>/students`
- `GET /api/v1/lecturer/documents`
- `GET /api/v1/lecturer/documents/<int:did>/download`
- `GET /api/v1/lecturer/sessions`
- `GET /api/v1/lecturer/sessions/<int:sid>`
- `GET /api/v1/lecturer/sessions/<int:sid>/attendance`
- `GET /api/v1/manager/accounts`
- `GET /api/v1/manager/admissions/dropout`
- `GET /api/v1/manager/admissions/forecast/<string:scope>`
- `GET /api/v1/manager/admissions/proposals`
- `GET /api/v1/manager/admissions/retention`
- `GET /api/v1/manager/announcements`
- `GET /api/v1/manager/announcements/<int:announcement_id>`
- `GET /api/v1/manager/announcements/options`
- `GET /api/v1/manager/catalog`
- `GET /api/v1/manager/classes`
- `GET /api/v1/manager/classes/<int:class_id>`
- `GET /api/v1/manager/courses`
- `GET /api/v1/manager/dashboard`
- `GET /api/v1/manager/grades/classes/<int:cid>`
- `GET /api/v1/manager/grades/windows`
- `GET /api/v1/manager/lecturers`
- `GET /api/v1/manager/lecturers/<int:staff_id>`
- `GET /api/v1/manager/ledger`
- `GET /api/v1/manager/operations/files/<int:file_id>`
- `GET /api/v1/manager/roles/<string:role>/permissions`
- `GET /api/v1/manager/rooms`
- `GET /api/v1/manager/schedule`
- `GET /api/v1/manager/schedule/slot`
- `GET /api/v1/manager/students`
- `GET /api/v1/manager/students/<string:identifier>`
- `GET /api/v1/manager/students/<string:student_id>/payments`
- `GET /api/v1/manager/tuition`
- `GET /api/v1/manager/tuition/risks`
- `GET /api/v1/notifications`
- `PATCH /api/v1/auth/password`
- `PATCH /api/v1/manager/announcements/<int:announcement_id>`
- `PATCH /api/v1/manager/students/<int:student_id>`
- `POST /api/v1/auth/avatar`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/recovery`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/lecturer/assistants/<int:sid>/review`
- `POST /api/v1/lecturer/classes/<int:cid>/assistants/<int:sid>/requests`
- `POST /api/v1/lecturer/classes/<int:cid>/assistants/<int:sid>/submissions`
- `POST /api/v1/lecturer/comments`
- `POST /api/v1/lecturer/documents`
- `POST /api/v1/manager/accounts`
- `POST /api/v1/manager/accounts/<int:user_id>/lock`
- `POST /api/v1/manager/accounts/<int:user_id>/unlock`
- `POST /api/v1/manager/ai-alerts/<int:alert_id>/review`
- `POST /api/v1/manager/announcements`
- `POST /api/v1/manager/announcements/<int:announcement_id>/preview`
- `POST /api/v1/manager/announcements/<int:announcement_id>/remind`
- `POST /api/v1/manager/announcements/<int:announcement_id>/replies`
- `POST /api/v1/manager/announcements/<int:announcement_id>/send`
- `POST /api/v1/manager/catalog/courses`
- `POST /api/v1/manager/classes`
- `POST /api/v1/manager/classes/<int:class_id>/enrollments`
- `POST /api/v1/manager/grades/classes/<int:cid>/reopen`
- `POST /api/v1/manager/grades/import`
- `POST /api/v1/manager/grades/import/confirm`
- `POST /api/v1/manager/grades/remind`
- `POST /api/v1/manager/lecturers`
- `POST /api/v1/manager/lecturers/<int:staff_id>/assignments`
- `POST /api/v1/manager/lecturers/<int:staff_id>/stop`
- `POST /api/v1/manager/ledger`
- `POST /api/v1/manager/lessons/<int:sid>/cancel`
- `POST /api/v1/manager/payments`
- `POST /api/v1/manager/payroll/<string:month>/close`
- `POST /api/v1/manager/rooms`
- `POST /api/v1/manager/students`
- `POST /api/v1/manager/students/import`
- `POST /api/v1/manager/tuition/risks/<int:alert_id>/remind`
- `POST /api/v1/notifications/read-all`
- `PUT /api/v1/auth/profile`
- `PUT /api/v1/lecturer/assistants`
- `PUT /api/v1/lecturer/classes/<int:cid>/grades`
- `PUT /api/v1/lecturer/documents/<int:did>`
- `PUT /api/v1/lecturer/sessions/<int:sid>/attendance`
- `PUT /api/v1/manager/accounts/<int:user_id>`
- `PUT /api/v1/manager/catalog/courses/<int:item_id>`
- `PUT /api/v1/manager/classes/<int:class_id>`
- `PUT /api/v1/manager/grades/classes/<int:cid>`
- `PUT /api/v1/manager/grades/windows/<group>`
- `PUT /api/v1/manager/lecturers/<int:staff_id>`
- `PUT /api/v1/manager/roles/<string:role>/permissions`
- `PUT /api/v1/manager/rooms/<int:item_id>`

Không thêm bảng/cột trong đợt nối API. Dùng users/staff_profiles/guardians/students, courses/classes/enrollments/schedules/sessions, attendance/history, tuition/payout/ledger/payroll, các bảng workflow điểm/trợ giảng, stored_files/documents/comments, announcements/notifications/delivery, role_permissions và AI outputs đã có ở0012.

## Chạy và đối chiếu SSMS

Xem [DEMO.md](DEMO.md) hoặc RUN_DEMO.md ở thư mục dự án: có lệnh BE/FE/worker, tài khoản SQL, thứ tự đủ menu Manager/Giảng viên và câu SELECT SSMS cho từng nhóm. Lệnh chung: `node .\scripts\start_demo.mjs`.

Chạy lại test chỉ trên database test đã xác minh: ` .\.venv\Scripts\python.exe scripts\prepare_database.py test --reuse-database NEKO_EDU_20261108_062203_dcd41c54fb16_test -- -q`. Fixture xóa dữ liệu thử trong database đó; không dùng NEKO_EDU.
