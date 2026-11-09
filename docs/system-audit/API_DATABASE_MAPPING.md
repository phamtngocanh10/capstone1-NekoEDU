# Mapping Frontend – API – Database

Ngày kiểm tra: 08/11/2026

Frontend đang chạy nằm trong checkout riêng `D:\NekoEDU-FE\frontend` (nhánh `FE`). Các bảng bên dưới mô tả nguồn dữ liệu/khả năng API đã kiểm tra, không khẳng định mọi route đã được nối.

| Module / trang FE | Nguồn dữ liệu FE | Endpoint Backend tương ứng | Bảng chính | Trạng thái tích hợp |
|---|---|---|---|---|
| Đăng nhập | Tài khoản demo vẫn dùng localStorage; Backend account gọi API và lưu JWT | `POST /api/v1/auth/login`; `GET /api/v1/auth/me` | `users`, `roles`, `staff_profiles`, `student_user_links` | Login Backend đã nối; profile vẫn đọc user đã lưu cục bộ |
| Học viên | Demo account: fixture/state; Backend account: GET/POST/PATCH API | `GET/POST /api/v1/students`, `GET/PATCH /api/v1/students/<id>`, level transfer, learning history | `students`, `guardians`, `student_user_links`, `class_enrollments`, `student_level_transfers` | List/create/update nối; lưu gender/address/contact_email; class/tuition/account chưa nối |
| Guardians/phụ huynh | Form thêm thu thập tên, điện thoại, quan hệ bắt buộc và email liên hệ học viên riêng | Guardian nested trong `POST /api/v1/students`; `GET /api/v1/guardians` không còn dùng để pre-check | `guardians` | Tạo/link theo phone trong cùng transaction; unique phone, trùng chỉ dùng lại khi tên/quan hệ khớp |
| Khóa học/lớp | Fixtures và state | Một phần API `/classes`, `/classes/<id>/staff`, schedules/sessions | `course_groups`, `courses`, `classes`, `rooms`, `class_enrollments` | CRUD danh mục chưa đầy đủ/chưa nối |
| Lịch | Static/generated data, một số override localStorage | `/classes/<id>/schedules`, `/schedules/<id>`, `/sessions` | `class_schedules`, `class_sessions` | FE dùng demo |
| Điểm danh | FE mock/local state | `/sessions/<id>/attendances`, `/attendances/<id>`, report/history | `attendances`, `attendance_histories` | Chưa xác minh FE call |
| Nhân sự | Fixtures/state | `/users`, `/staff`, `/classes/<id>/staff` | `users`, `staff_profiles`, class assignment | API tồn tại; FE demo |
| Học phí/chu kỳ | Fixtures/state; chưa xác minh giao dịch SQL | `/students/<id>/tuition-cycles`, `/tuition-cycles/*`, `/tuition-policies` | `tuition_cycles`, `tuition_invoices`, `tuition_invoice_items`, `payments`, `receipts`, `discount_policies` | API một phần; FE chưa nối |
| Thu chi/lương | State/fixtures | Không có finance router được đăng ký | `finance_transactions`, `finance_categories`, `staff_payrolls` | Chỉ có schema |
| Đánh giá/điểm | Fixtures; Lecturer API wrapper lưu localStorage | `/assessments`, `/results`, `/students/<id>/results` | `assessments`, `assessment_results`, histories, skill results/workflows | Backend một phần; FE demo |
| Thông báo | Store trong bộ nhớ | Không có announcements router được đăng ký | `announcements`, `notifications`, deliveries, recipients | Chỉ có schema |
| Tài liệu/nhận xét | Lecturer API demo localStorage/IndexedDB | Không có file/document/comment router được đăng ký | `stored_files`, `teaching_documents`, `student_comments` | Chỉ có schema |
| Tuyển sinh | Fixtures/dữ liệu minh họa | `/admission-leads` list/create/update/convert | `admission_leads`; AI forecasts | Lead API có; FE chưa xác minh; AI chưa tích hợp |
| Phân quyền/cài đặt | Mẫu/state | Auth middleware và một số users API | `roles`, `permission_resources`, `role_permissions`, `audit_logs` | API hiện hữu một phần; ma trận mới chưa được thực thi đầy đủ |

## Luồng học viên mục tiêu

Luồng đã được nối trong chế độ Backend:

`StudentFormModal` (giao diện gốc + 2 trường guardian cần thiết) → `saveStudent` → API client (JWT) → `POST /api/v1/students` với guardian nested → service khóa/đối chiếu số điện thoại, tạo hoặc tái dùng guardian → insert student → một commit → `GET /api/v1/students` → UI. Tên/quan hệ không khớp với số đã có thì trả conflict, không tự sửa hoặc gộp hồ sơ.

Luồng demo account vẫn dừng ở `saveStudent` → `setStudents` (toast ghi rõ chưa lưu SQL). Luồng Backend account gọi API và GET lại sau khi POST thành công; chưa được xác minh bằng browser E2E.

## Cảnh báo khi kiểm thử

- Không coi HTTP 201 là bằng chứng duy nhất; phải đọc lại bản ghi bằng GET hoặc SELECT.
- Backend tạo student yêu cầu các trường/quan hệ theo `StudentCreateSchema`; form FE có các trường riêng và cần mapping rõ ràng.
- Không sử dụng `flask seed` để kiểm thử trên database demo.
