# Chạy demo NEKO EDU với dữ liệu SQL

## Chạy từ gốc monorepo sau khi tổ chức lại

Mở `D:\capstone1-NekoEDU` bằng VS Code. Source FE sử dụng là `frontend/` trong thư mục gốc; worktree cũ giữ lại để khôi phục.

**Terminal Backend:**

```powershell
Set-Location 'D:\capstone1-NekoEDU'
.\backend\.venv\Scripts\python.exe -m flask --app backend/run.py run --host 127.0.0.1 --port 8000 --no-reload --no-debugger
```

**Terminal Frontend:**

```powershell
Set-Location 'D:\capstone1-NekoEDU'
npm.cmd --prefix .\frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Mở **http://127.0.0.1:5173**. Backend/Swagger: **http://127.0.0.1:8000/docs**. Nếu cổng đã có server cũ, Ctrl+C terminal cũ trước. Cách chạy chung từ gốc: `node .\backend\scripts\start_demo.mjs`; lệnh này có worker hẹn giờ như trước.

Thông tin tổ chức lại và sao lưu: [MONOREPO.md](MONOREPO.md). Không chạy migration/seed để mở demo.

Giữ bố cục, CSS và menu của FE nhóm. Các form hiện có dùng API thật; dữ liệu nghiệp vụ không lưu trong localStorage/IndexedDB.

## Khởi động

Mở Terminal PowerShell trong VS Code:

~~~powershell
cd D:\capstone1-NekoEDU\backend
node .\scripts\start_demo.mjs
~~~

Lệnh chạy BE, FE, bộ xử lý hẹn giờ 30 giây/lần rồi tự mở **http://127.0.0.1:5173**. Giữ terminal mở; Ctrl+C dừng các tiến trình do lần chạy đó tạo. Nếu báo Backend mã cũ, Ctrl+C terminal BE cũ rồi chạy lại.

Có thể dùng **Run and Debug → NekoEDU: Demo BE + FE va mo web → F5**. Khi mở thư mục Backend, **Ctrl+Shift+B → NekoEDU: Chay demo BE + FE (Backend)**. Không bấm Run Code trên DEMO.md/data.js.

Lỗi SDK/devices/compiler path trong ảnh thuộc extension **Garmin Monkey C**. Extensions → Garmin Monkey C → Disable (Workspace), hoặc chạy lệnh Terminal trên. Flask/React không cần Garmin SDK.

SQL Server SQLEXPRESS phải đang chạy; dùng database **NEKO_EDU** hiện có. Không chạy seed/reset khi mở lại demo.

## Đăng nhập

| Vai trò | Username SQL | Mật khẩu mặc định |
|---|---|---|
| Manager | mg01 | Neko@2026 |
| Giảng viên | gv01 | Neko@2026 |

Nếu đã đổi, dùng mật khẩu hiện tại. Các tài khoản FE mẫu manager/giangvien với Neko@123 đã bỏ. Nhập CAPTCHA đang hiện rồi đăng nhập. Nếu chữ nhỏ, Ctrl+0 đưa zoom về 100%.

Swagger: **http://127.0.0.1:8000/docs**. POST /api/v1/auth/login rồi đưa access_token vào Authorize khi demo API.

## Demo Manager theo thứ tự

| Menu | Thao tác |
|---|---|
| Tổng quan | Xem số liệu, lịch, công nợ, đơn từ đọc SQL |
| Giảng viên | Thêm, sửa, F5; phân công khi có lớp; ngừng dạy cần người thay thế cho lớp hoạt động |
| Khóa học & Lớp học | Tạo lớp với khóa/cấp học, giảng viên, phòng, lịch rảnh và ngày hiện tại; lớp mới có 36 buổi theo thiết kế gốc |
| Học viên | Thêm hồ sơ, phụ huynh, khóa/cấp học thật; có thể chưa xếp lớp. Lớp được chọn phải còn chỗ/còn thời hạn. Sửa, nhập XLSX/CSV, xuất danh sách và ngừng học qua nguồn SQL; lịch sử được giữ |
| Lịch | Chọn ngày có buổi thật, mở chi tiết; hủy có lý do và tùy chọn thông báo. Học bù tạo việc chờ xếp lịch, chưa sinh ngày thay thế chưa được chọn |
| Điểm số | Thiết lập kỳ/thời gian cho khóa trước; nhập bốn kỹ năng, lưu nháp, công bố/mở lại, nhập Excel. Điểm 0–9, bước 0,5 |
| Học phí | Chọn học viên/hóa đơn còn nợ, thu tiền, lưu minh chứng, kiểm tra biên lai, F5. Không thu vượt nợ; gửi lặp cùng yêu cầu không tạo thanh toán trùng |
| Thu chi | Thêm khoản thu/chi, minh chứng; chốt lương từ giờ giảng đã hoàn thành. Thiếu mức lương theo giờ thì báo lỗi, không tự đoán. Lương lịch sử theo buổi giữ nguyên |
| Thông báo | Soạn, tự lưu/lưu nháp, chọn người nhận, đính kèm, xem trước, gửi ngay/hẹn giờ. Trạng thái đọc, phản hồi và nhắc lại lưu SQL |
| Tuyển sinh | Xem tổng hợp/cảnh báo SQL; chấp nhận/bỏ qua đề xuất lưu trạng thái. Dự báo trống nếu chưa có kết quả mô hình |
| Phân quyền & Cài đặt | Thêm/sửa tài khoản, khóa có hạn/mở khóa/ngừng đăng nhập; lưu quyền. Backend áp dụng DENY, vẫn giữ kiểm tra vai trò và phạm vi lớp |

Lưu ý: các lớp cũ thuộc 7–10/2026. Demo ghi danh mới nên tạo lớp có thời gian phù hợp. Hồ sơ chưa xếp lớp vẫn lưu được. Số điện thoại định danh hồ sơ phụ huynh dùng chung; sửa phụ huynh chung ảnh hưởng các con liên kết và có audit.

Menu ảnh đại diện: hồ sơ, ảnh và mật khẩu lưu SQL. Đổi mật khẩu thành công phải đăng nhập lại; token cũ bị vô hiệu hóa.

## Demo Giảng viên

Đăng nhập gv01 hoặc giảng viên mới đã được Manager phân công.

| Menu | Thao tác |
|---|---|
| Tổng quan | Xem lớp, buổi và công việc thật |
| Lịch giảng dạy | Chọn khoảng có buổi học, mở buổi, xuất lịch |
| Lớp học của tôi | Mở lớp, tìm/xuất danh sách từ class_enrollments |
| Điểm danh | Chọn buổi đã bắt đầu/chưa hủy; có mặt/vắng/đi trễ, ghi chú, Lưu và F5 |
| Bảng điểm | Chọn lớp/kỳ đã mở; nhập, lưu nháp, xác nhận. Ngoài cửa sổ nhập thì báo lý do |
| Tài liệu | Tải tệp thật, chia sẻ lớp, đổi tên, tải lại, gỡ; binary/lịch sử ở SQL |
| Nhận xét | Chọn học viên thuộc lớp, lưu rồi F5 |
| Trợ giảng | Phân công, cấp cửa sổ, xem yêu cầu/bài nộp, duyệt/trả lại/thu hồi |

Đi trễ lưu PRESENT kèm ký hiệu trong ghi chú theo schema hiện tại. Tài khoản chưa được phân công sẽ không có lớp; không tạo dữ liệu giả để lấp chỗ trống.

## Học phí và các phần cần cấu hình

Chu kỳ vẫn là **8 buổi**; giảm anh chị em ruột **10% học phí gốc** theo quan hệ/thời gian hiệu lực. Không chuyển thành tính theo tháng.

NEKO_EDU chưa có tuition_business_policies. Thêm học viên vẫn lưu hồ sơ/xếp lớp; không giả tạo hóa đơn hoặc báo đã thu. Muốn demo tạo hóa đơn mới, Manager cấu hình qua Swagger /tuition-policies rồi dùng chuỗi /tuition-cycles: tạo từ enrollment, tính và phát hành. FE gốc chưa có màn hình tạo chính sách/hóa đơn mới nên không thêm UI. Thu tiền trên FE dùng hóa đơn thật đã có.

Gửi nội bộ và hẹn giờ được xử lý thật. Email/push ngoài ứng dụng giữ trạng thái PENDING khi chưa có dịch vụ gửi; không được hiểu là đã gửi ra email. Khôi phục mật khẩu cần MAIL_SERVER/MAIL_FROM và SMTP thật trong .env (xem .env.example); chưa cấu hình thì báo lỗi, Manager có thể đặt lại từ quản lý tài khoản.

Dữ liệu mô hình AI hiện trống nên không có dự báo giả. Hai nút gốc “Quản lý mẫu” và “Xem tất cả” đơn từ chưa có màn hình/form tương ứng; giữ nguyên, chưa bổ sung UI.

## Kiểm tra SSMS sau khi Lưu

Kết nối (local)\SQLEXPRESS, chọn NEKO_EDU:

~~~sql
USE NEKO_EDU;
SELECT TOP (10) id,student_code,full_name,guardian_id,current_level_id,created_at FROM dbo.students ORDER BY id DESC;
SELECT TOP (10) id,full_name,phone,relationship FROM dbo.guardians ORDER BY id DESC;
SELECT TOP (10) id,student_id,class_id,status,enrolled_date FROM dbo.class_enrollments ORDER BY id DESC;
SELECT TOP (10) id,class_code,name,lecturer_id,start_date,end_date FROM dbo.classes ORDER BY id DESC;
SELECT TOP (10) id,user_id,staff_code,position,hourly_rate,status FROM dbo.staff_profiles ORDER BY id DESC;
SELECT TOP (10) id,invoice_id,amount,method,paid_at FROM dbo.payments ORDER BY id DESC;
SELECT TOP (10) * FROM dbo.receipts ORDER BY id DESC;
SELECT TOP (10) id,txn_type,amount,txn_date,description FROM dbo.finance_transactions ORDER BY id DESC;
SELECT TOP (10) id,session_id,student_id,status,note FROM dbo.attendances ORDER BY id DESC;
SELECT TOP (10) * FROM dbo.assessment_skill_results ORDER BY assessment_id DESC,student_id DESC;
SELECT TOP (10) id,display_name,file_id,uploaded_by FROM dbo.teaching_documents ORDER BY id DESC;
SELECT TOP (10) id,title,status,scheduled_at,sent_at FROM dbo.announcements ORDER BY id DESC;
SELECT TOP (10) * FROM dbo.role_permissions ORDER BY id DESC;
~~~

Sau Lưu, F5 FE rồi đọc lại. Dừng/mở lại BE+FE bằng lệnh đầu tài liệu và kiểm tra cùng bản ghi. Không trình chiếu password_hash.

## Chạy từng tiến trình riêng

Terminal 1:

~~~powershell
cd D:\capstone1-NekoEDU\backend
.\.venv\Scripts\python.exe -m flask --app run run --host 127.0.0.1 --port 8000 --no-reload --no-debugger
~~~

Terminal 2:

~~~powershell
cd D:\capstone1-NekoEDU\frontend
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort --open
~~~

Terminal 3 (hẹn giờ khi chạy riêng):

~~~powershell
cd D:\capstone1-NekoEDU\backend
.\.venv\Scripts\python.exe -m flask --app run process-pending-work --watch
~~~

Kiểm tra chỉ đọc schema: .\.venv\Scripts\python.exe scripts\check_demo.py.
Báo cáo kết quả, API và giới hạn kiểm thử: INTEGRATION_STATUS.md.
