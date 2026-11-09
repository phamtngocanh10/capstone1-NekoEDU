# Báo cáo lỗi và sửa lỗi

Ngày kiểm tra: 08/11/2026

## BUG-001 — Thêm học viên không lưu vào database

- **Mức độ:** Cao.
- **Trạng thái điều tra:** Đã xác định nguyên nhân gốc.
- **Trạng thái sửa:** Đã sửa source FE cho chế độ đăng nhập Backend; build Frontend thành công. Browser E2E chưa chạy.
- **Triệu chứng:** Học viên xuất hiện ngay sau thao tác thêm nhưng biến mất sau F5; truy vấn SQL theo mã `HV20264013` trả 0 bản ghi.
- **Nguyên nhân:** `D:\NekoEDU-FE\frontend\src\components\Manager\components\HocVien\index.jsx`, handler `saveStudent`, chỉ tạo bản ghi UI rồi cập nhật React state. Handler không gọi API, không ghi localStorage/IndexedDB. Danh sách ban đầu lấy từ fixture trong `HocVien\data.js`.
- **API Backend hiện có:** `POST /api/v1/students`; yêu cầu Manager/JWT và schema tạo học viên. Service tạo các liên kết cần thiết rồi gọi commit transaction.
- **Yếu tố làm lỗi dễ nhầm:** wrapper `src/api/students.js` tồn tại nhưng không được trang Học viên sử dụng; có wrapper không có nghĩa là form đã lưu SQL.
- **Bằng chứng database chỉ đọc:** database `NEKO_EDU`; số học viên hiện tại 171; mã `HV20264013` không có bản ghi.
- **Thay đổi đã làm:** giữ đăng nhập demo cũ nhưng Backend account gọi `POST /auth/login` và lưu JWT; mặc định API client trỏ `http://127.0.0.1:8000/api/v1`; wrapper học viên đổi sang `/students` và `PATCH`. Thiết kế gốc được giữ; form thêm có hai trường guardian bắt buộc tên/quan hệ. Backend tạo hoặc tái sử dụng guardian theo số điện thoại trong transaction tạo student; chỉ liên kết số trùng khi tên và quan hệ phù hợp, ngược lại trả conflict. API đã nhận/lưu các trường student gender, address, contact_email vốn có trong DB. Sau POST, FE tải lại danh sách.
- **Xử lý lỗi:** lỗi HTTP/validation hiển thị qua toast; không đổi state thành công nếu POST/PATCH lỗi. Nếu POST trả thành công nhưng GET refresh lỗi, báo rõ đã lưu nhưng không tải lại được danh sách.
- **Thông báo demo:** khi dùng tài khoản FE demo, toast nêu rõ thao tác chỉ thay đổi dữ liệu demo trên trình duyệt, chưa lưu SQL.
- **Ràng buộc DB:** `guardians.phone` unique, guardian full_name/phone/relationship bắt buộc; `students.guardian_id`, `current_level_id`, date_of_birth và enrolled_at NOT NULL; có unique student_code và FK/checks. Không đổi schema.
- **Kiểm thử:** build FE thành công; 64 Backend student API tests pass trên DB test riêng, bao gồm POST→GET, tái sử dụng guardian cùng số phù hợp và rollback khi bước tiếp theo lỗi. Browser E2E chưa chạy.

## Các vấn đề liên quan

1. **Các module UI chưa đồng bộ với Backend:** ngoài trang Học viên đã nối tối thiểu, Manager pages chủ yếu dùng fixture/state; lecturer demo lưu một số dữ liệu trong localStorage/IndexedDB. Đây là khoảng trống tích hợp, không thể khắc phục bằng cách chỉ sửa một lệnh SQL.
2. **Đăng nhập FE demo không phải tài khoản SQL:** tài khoản `manager`/`giangvien` vẫn trả `access_token: null`; cần đăng nhập bằng Backend account để dùng luồng SQL.
3. **API chưa được đăng ký cho một số bảng:** không thấy router Backend cho finance, announcements, file/teaching documents, student comments, AI forecast. Có schema bảng không đồng nghĩa có API CRUD.

Các vấn đề trên được ghi nhận; không tuyên bố đã sửa cho tới khi có thay đổi code và bằng chứng kiểm thử tương ứng.

## Phần chưa thể xác nhận

- Chưa xác nhận flow submit từ browser → API → SQL → F5; API persistence/readback đã được kiểm tra trên DB test. Không ghi dữ liệu kiểm thử vào `NEKO_EDU`.
- Backend student API integration tests đã chạy trên database test riêng; không chạy trên database demo.
- Không reset mật khẩu, quyền tài khoản hay dữ liệu.
