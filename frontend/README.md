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
| `src/components/TeachingAssistant/` | Các trang và bố cục của trợ giảng             |
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

## Giao diện Trợ giảng

Chạy frontend bằng `npm run dev`, mở `/login` và đăng nhập tài khoản Trợ giảng mẫu **`tg01` / `Neko@2026`**, nhập đúng mã xác nhận trên form. Đăng nhập thành công sẽ mở `/assistant/tongquan`; truy cập trang Trợ giảng khi chưa đăng nhập sẽ quay về form. Phần này xử lý đăng nhập ngay trên frontend, chưa cần API hay SQL Server. Phiên mẫu dùng khóa `neko-trogiang-demo-session-v1`, không lưu mật khẩu và không ghi đè phiên Manager/Giảng viên. Chọn **Đăng xuất** trong menu tài khoản để kết thúc phiên; hồ sơ và dữ liệu mẫu vẫn được giữ.

Các màn hình theo thiết kế CAP: tổng quan, lịch hỗ trợ theo tuần, lớp được phân công và danh sách học viên, điểm danh thủ công (có mặt/đi trễ/vắng), xin quyền nhập điểm, nhập bốn kỹ năng và lịch sử yêu cầu/bảng điểm. Hồ sơ và thông báo dùng dữ liệu mẫu; modal mật khẩu chỉ minh họa/kiểm tra form. Bảng màu và hiệu ứng lấy từ token Manager trong `theme.css`; CSS riêng nằm ở `assistant-shell.css` và `assistant-workflows.css`.

Code trợ giảng nằm trong hai thư mục đã có: `TeachingAssistant/layout` giữ bố cục, context, tìm kiếm và menu; `TeachingAssistant/components` giữ các trang và hàm xử lý dùng chung. Tên biến/hàm nội bộ dùng tiếng Việt không dấu. Logic tự lưu/phiên bản bản nháp nằm trong `components/useBanNhapDiem.js`; kiểm tra điểm nằm trong `components/xuLyDiem.js`.

`TeachingAssistant/duLieuMau.js` tạo dữ liệu minh họa theo tuần hiện tại. `duLieuTroGiang.js` xử lý danh sách lớp, lịch, điểm danh, yêu cầu, bản nháp và bảng điểm ngay trong frontend; `luuTruMau.js` chỉ phụ trách đọc, kiểm tra và ghi dữ liệu trình duyệt. Dữ liệu được giữ ở khóa localStorage `neko-trogiang-demo-v1`, tách với phiên đăng nhập Manager/Giảng viên. Nút **Khôi phục dữ liệu mẫu** trên thanh thông tin giúp thử lại từ đầu hoặc tạo lịch/quyền mẫu cho tuần hiện tại; thao tác có xác nhận và giữ hồ sơ mẫu. Có thể thay bộ xử lý dữ liệu khi API được phát triển sau này.

Mẫu có ba lớp và các trạng thái quyền nhập điểm khác nhau để xem đầy đủ giao diện. Điểm từ 0–9, bước 0,5; bản nháp có thể nhập từng phần và tự lưu trong trình duyệt. Chỉ chuyển sang chờ duyệt khi đủ bốn kỹ năng của toàn bộ học viên. Yêu cầu/bảng điểm không được gửi cho người khác và không tạo dữ liệu thật trên máy chủ.

Kiểm tra bản dựng frontend: `npm run build` (chạy từ `frontend/`).
