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

## Giao diện Student / Parent

Chạy `npm run dev` trong `frontend/`, mở `/login` và dùng **`ph01` / `Neko@2026`** (hoặc tên đăng nhập `hv01` cho cùng tài khoản mẫu). Nhập đúng mã xác nhận trên form. Phần StudentParent hoạt động hoàn toàn ở frontend, không gọi API và không cần SQL Server. Manager/Giảng viên vẫn dùng luồng đăng nhập hiện có.

Giao diện theo 15 màn hình/trạng thái StudentParent trong `CAP (2).fig`, dùng chung token màu Manager ở `theme.css`: trang chủ, khóa học và đăng ký, chi tiết khóa, lịch tuần, thư viện tài liệu, chuyên cần và kết quả, chi tiết bài kiểm tra, học phí và hóa đơn, thanh toán mẫu, thông báo và tệp đính kèm, phản hồi, đánh giá. Hồ sơ phụ huynh có thể chỉnh sửa và lưu ảnh đại diện; biểu mẫu đổi mật khẩu chỉ minh họa, không đổi mật khẩu đăng nhập.

Các trang được gom theo tên menu trong `src/components/StudentParent/components`: `TrangChu`, `KhoaHocCuaToi`, `LichHoc`, `TaiLieu`, `DiemDanhKetQua`, `HocPhiHoaDon`, `ThongBao`, `PhanHoiDanhGia`, `ThongTinCaNhan`. Mỗi menu có `index.jsx` làm trang chính; trang chi tiết và biểu mẫu nằm cùng thư mục. Tên file giữ tiếng Việt không dấu; tên biến, hàm, component và hook dùng tiếng Anh, ví dụ `student`, `getInvoices`, `saveProfile`, `InvoiceDetails`, `useStudentParent`.

Đọc logic từ `layout/NguCanhHocVien.jsx` (state và lưu thay đổi), rồi `data/xuLyDuLieu.js` (lọc theo học viên, kiểm tra điều kiện, xử lý đăng ký/thanh toán/phản hồi). `data/luuTruMau.js` chỉ đọc/ghi localStorage; `data/duLieuMau.js` tạo dữ liệu mẫu và `data/duLieuDangNhap.js` giữ luồng đăng nhập mẫu. Mỗi lần cập nhật luôn dựa trên bản dữ liệu mới nhất và chỉ đổi giao diện sau khi lưu thành công. Các khóa JSON, trạng thái, tham số URL và phiên đăng nhập đã lưu được giữ nguyên để tương thích.

`components/shared` chứa giao diện dùng chung (`DungChung.jsx`), định dạng ngày/tiền/tìm kiếm (`dinhDang.js`) và xuất PDF/Word/lịch (`xuatTep.js`); `tienIch.js` xuất lại các hàm để các trang sử dụng. Các form lớn được tách thành `KhoaHocCuaToi/XacNhanDangKy.jsx`, `HocPhiHoaDon/ThanhToanMau.jsx`, `PhanHoiDanhGia/BieuMauDanhGia.jsx`, `ThongTinCaNhan/BieuMauHoSo.jsx` và `ThongTinCaNhan/DoiMatKhauMau.jsx`. `layout` giữ khung trang, context, menu và tìm kiếm. CSS khung trang là `src/styles/student-parent.css`; CSS các nhóm chức năng nằm trong `StudentParent/styles`.

Dữ liệu mẫu tạo theo tuần hiện tại, có phụ huynh Nguyễn Thị Mai và hai học viên Nguyễn Minh Anh / Nguyễn Minh Khang. Bộ chọn học viên đồng bộ các lớp, lịch, điểm, tài liệu, hóa đơn, phản hồi và đánh giá theo từng hồ sơ. Khóa localStorage `neko-student-parent-data-v1` giữ thay đổi; `neko-student-parent-session-v1` giữ phiên đăng nhập mẫu. Không lưu mật khẩu trong bộ nhớ trình duyệt và không ghi đè `access_token` hoặc `neko-auth-user`.

Đăng ký khóa học tạo trạng thái **Chờ xác nhận**. Thanh toán chỉ cập nhật hóa đơn minh họa, không chuyển tiền hay kết nối ngân hàng/ví. PDF, DOCX và audio tải xuống là tài liệu mẫu. Google Calendar dùng tệp lịch `.ics` có thể tải và nhập thủ công, không giả lập kết nối tài khoản Google. Nút **Khôi phục dữ liệu mẫu** có xác nhận và đặt lại mọi thay đổi mẫu theo tuần hiện tại.

Kiểm tra bản dựng: `npm run build`. Không có thay đổi backend, migration hay seed cho StudentParent.
