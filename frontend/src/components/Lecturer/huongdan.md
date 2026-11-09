# Giảng viên — nguồn dữ liệu SQL

Giao diện, menu, cấu trúc màn hình và CSS hiện có được giữ nguyên. `src/api/giangvien.js` gọi Backend `/api/v1/lecturer`; không còn bản ghi mẫu, localStorage hoặc IndexedDB làm nguồn nghiệp vụ. localStorage chỉ giữ phiên đăng nhập trong API client dùng chung.

## Các luồng đã nối API

| Màn hình | Nguồn SQL / hành vi |
|---|---|
| Tổng quan, lịch giảng dạy | Lớp và buổi học thật từ `classes`, `class_schedules`, `class_sessions`, `staff_profiles`; lịch bắt đầu tại ngày hiện tại, có thể chuyển về tháng/tuần dữ liệu cũ |
| Lớp học, danh sách học viên | `class_enrollments`, `students`, `guardians`; phạm vi theo tài khoản phụ trách; sĩ số/chuyên cần tính từ dữ liệu đã lưu |
| Điểm danh | Cùng `attendances` với Manager; đọc lại sau lưu; sửa ghi `attendance_histories` và yêu cầu tính lại học phí khi đổi trạng thái |
| Điểm số | Bốn kỹ năng 0–9, bước 0.5, lưu nháp/nhập Excel/xác nhận; `assessment_skill_results` và `assessment_workflows`; trung bình đồng bộ `assessment_results` cho API kết quả cũ |
| Tài liệu | Tệp nhị phân lưu `stored_files`, siêu dữ liệu/lớp chia sẻ/sự kiện lưu các bảng `teaching_document_*`; tải xuống đúng byte gốc; xóa mềm giữ lịch sử |
| Nhận xét | `student_comments`, kiểm tra học viên thuộc lớp và tác giả có quyền |
| Trợ giảng | Phân công/quyền, thời gian mở quyền, yêu cầu, bài nộp và duyệt dùng `class_assistant_assignments`, `assistant_grading_*`, `assistant_grade_submission_*` |
| Hồ sơ/mật khẩu | API xác thực và hồ sơ dùng chung với Manager |

Manager dùng `/api/v1/manager/grades/*` và `/api/v1/manager/schedule*` trên cùng dữ liệu SQL. ID lớp/học viên/buổi học do SQL cấp, trả dưới dạng chuỗi để khớp lựa chọn của giao diện; không còn ID ghép `date|slot|classId`.

## Quy tắc thời gian và tính nhất quán

- Thời gian nhập điểm do Manager đặt theo nhóm khóa, lưu cho từng khóa SQL. Trước giờ mở, giảng viên chưa được ghi điểm. Sau giờ đóng, giảng viên bị khóa khi tùy chọn tự khóa được bật; Manager có thể nhập hộ hoặc mở lại.
- Quyền trợ giảng luôn nằm trong kỳ Manager đã đặt. Chỉ tài khoản trợ giảng được phân công mới gửi yêu cầu/bài nộp; giảng viên duyệt dùng điểm đã lưu trong bài nộp, không tin điểm gửi lại từ client.
- Khi xác nhận, bảng điểm chuyển sang chỉ đọc. Chế độ công bố ngay cập nhật kết quả; chế độ hẹn giờ giữ xác nhận và công bố khi tới giờ. `process_deadlines()` xử lý các bảng đã tới hạn và nhắc trước hạn một ngày, chống gửi nhắc trùng. API điểm số gọi xử lý khi có truy cập; để chạy khi không có truy cập cần chạy lệnh Backend `flask process-pending-work` định kỳ bằng Windows Task Scheduler.
- Tệp `.xlsx` tối đa 5 MB/1000 dòng; Backend kiểm tra đủ cột, mã học viên và điểm. Manager xem trước rồi xác nhận nhập trong một transaction; một lớp lỗi làm toàn bộ lần nhập được rollback. Tài liệu PDF/DOCX/PPTX/MP3 tối đa 20 MB.
- Đi trễ được lưu bằng trạng thái `PRESENT` và tiền tố ghi chú `[Đi trễ] ` để giữ schema và quy tắc học phí hiện có. Vắng có phép đã lưu được giữ nguyên khi giao diện ba trạng thái chỉ sửa ghi chú. Không sửa quy tắc chu kỳ tám buổi hoặc giảm anh chị em 10%.
- Hủy buổi dùng điều kiện của `session_service`: không hủy buổi đã hoàn thành hoặc đã điểm danh. Tùy chọn thông báo ghi thông báo trong ứng dụng cho các tài khoản liên quan. Tùy chọn học bù ghi một công việc `Chờ xếp lịch học bù` và audit cho Manager; cần chọn ngày/phòng/giảng viên trước khi tạo buổi thay thế. Hệ thống không tự đặt một lịch bù tùy ý.

## Kiểm tra

Các test SQL nằm tại Backend `tests/test_integration_lecturer.py`. Chỉ chạy với `TEST_DATABASE_URL` trỏ tới database test riêng đã được xác minh; fixture test có thao tác dọn dữ liệu trong database đó. Không chạy fixture trên database demo đang sử dụng.

Với SSMS, lọc ID vừa thao tác trong `attendances`, `attendance_histories`, `tuition_recalculation_requests`, `assessments`, `assessment_skill_results`, `assessment_results`, `student_comments`, `teaching_documents`, `stored_files` và các bảng trợ giảng. Sau đó tải lại trang để kiểm tra API đọc dữ liệu đã commit. Không cần reset hoặc seed lại database nghiệp vụ.
