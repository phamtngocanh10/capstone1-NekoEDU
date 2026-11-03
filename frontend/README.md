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
| `src/api/`                 | Hàm gọi backend và API demo                         |
| `src/styles/`              | CSS của giao diện                                   |

Trong mỗi chức năng, bắt đầu từ `index.jsx`. Các file `data.js` hoặc `dulieu.js` chứa dữ liệu mẫu và hàm xử lý dữ liệu.

## Cách đọc một component

1. Xem `import` để biết component sử dụng gì.
2. Xem `useState` để biết dữ liệu nào thay đổi khi người dùng thao tác.
3. Xem các hàm xử lý lưu, tìm kiếm, đổi bộ lọc hoặc mở hộp thoại.
4. Xem phần `return` để hiểu giao diện và các sự kiện `onClick`, `onChange`, `onSubmit`.

`useEffect` chạy tác vụ như tải dữ liệu hoặc đăng ký sự kiện. Hàm được trả về bên trong effect dùng để hủy bộ đếm, gỡ sự kiện hoặc bỏ qua kết quả tải cũ.

Khi cập nhật object hoặc array trong state, tạo giá trị mới bằng `{ ...object }`, `[...array]`, `map` hoặc `filter`. Với giá trị phụ thuộc state trước đó, dùng dạng `setState(current => ...)`.

## Dữ liệu và API

Các trang Manager hiện chủ yếu dùng dữ liệu mẫu trong từng chức năng. Các trang giảng viên gọi `apiGiangVien` trong `src/api/giangvien.js`; bản demo lưu dữ liệu trên trình duyệt. Các file như `src/api/courses.js` đã có sẵn hàm gọi backend.

Đặt địa chỉ backend bằng `VITE_API_BASE_URL` trong `.env.development`. Hướng dẫn chi tiết cho API và dữ liệu giảng viên nằm ở `src/components/Lecturer/huongdan.md`.
