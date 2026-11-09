npm install
npm run dev

Mở `http://localhost:5173`. Dùng `npm run build` để kiểm tra và tạo bản chạy chính thức.

## Đọc code từ đâu?

| Thư mục / file             | Vai trò                                             |
| -------------------------- | --------------------------------------------------- |
| `src/main.jsx`             | Khởi động React và tải CSS                          |
| `src/router/index.jsx`     | Gắn đường dẫn với trang, kiểm tra vai trò đăng nhập |
| `src/pages/`               | Đăng nhập và khôi phục mật khẩu                     |
| `src/components/Manager/`  | Các trang và bố cục của Manager                     |
| `src/components/Lecturer/` | Các trang và bố cục của giảng viên                  |
| `src/common/ui/`           | Nút, bảng, form, hộp thoại dùng chung               |
| `src/api/`                 | Hàm gọi Backend SQL qua API dùng chung              |
| `src/styles/`              | CSS của giao diện                                   |

Trong mỗi chức năng, bắt đầu từ `index.jsx`. Các file `data.js` hoặc `dulieu.js` giữ danh mục hiển thị, bộ nhớ đệm từ API và hàm xử lý dữ liệu.

## Cách đọc một component

1. Xem `import` để biết component sử dụng gì.
2. Xem `useState` để biết dữ liệu nào thay đổi khi người dùng thao tác.
3. Xem các hàm xử lý lưu, tìm kiếm, đổi bộ lọc hoặc mở hộp thoại.
4. Xem phần `return` để hiểu giao diện và các sự kiện `onClick`, `onChange`, `onSubmit`.

`useEffect` chạy tác vụ như tải dữ liệu hoặc đăng ký sự kiện. Hàm được trả về bên trong effect dùng để hủy bộ đếm, gỡ sự kiện hoặc bỏ qua kết quả tải cũ.

Khi cập nhật object hoặc array trong state, tạo giá trị mới bằng `{ ...object }`, `[...array]`, `map` hoặc `filter`. Với giá trị phụ thuộc state trước đó, dùng dạng `setState(current => ...)`.

## Dữ liệu và API

Manager và Giảng viên dùng tài khoản SQL (`mg01`/`gv01`, mật khẩu mặc định `Neko@2026` nếu chưa đổi). Dữ liệu nghiệp vụ lấy qua `/api/v1/manager/*`, `/api/v1/lecturer/*` và các API nền hiện có; localStorage chỉ giữ phiên đăng nhập. Học viên/phụ huynh/tài khoản/xếp lớp được ghi cùng transaction. Học phí 8 buổi và hóa đơn thật dùng quy tắc BE hiện có; chưa có chính sách thì hồ sơ vẫn lưu và báo chờ, không tạo khoản thu giả. Email/push ngoài ứng dụng và dự báo AI cần dịch vụ thật; xem báo cáo Backend để biết phần đã kiểm thử.

Backend mặc định `http://127.0.0.1:8000/api/v1`; có thể đặt `VITE_API_BASE_URL` (gồm `/api/v1`). Hướng dẫn đủ 11 menu Manager/8 menu Giảng viên ở `D:\capstone1-NekoEDU\backend\DEMO.md`; chạy cả hệ thống bằng `node D:\capstone1-NekoEDU\backend\scripts\start_demo.mjs`. Hướng dẫn API Giảng viên ở `src/components/Lecturer/huongdan.md`.
