# Giao diện giảng viên

Đăng nhập bằng tài khoản `giangvien`, mật khẩu ban đầu `Neko@123` (hoặc `manager` / `Neko@123` để vào Manager). Nhập mã xác nhận đang hiển thị. Hệ thống xác định vai trò theo tài khoản, không có ô chọn vai trò.

Nếu đã đổi mật khẩu, dùng mật khẩu mới trên trình duyệt hiện tại. Dữ liệu frontend chỉ lưu salt và hash, không lưu mật khẩu vừa nhập. Khi có backend, bỏ comment API trong `src/api/auth.js` để đăng nhập và đổi mật khẩu qua máy chủ.

Các trang giảng viên nằm trong `src/components/Lecturer/components`: `tongquan/`, `lichgiangday/`, `lophoc/`, `diemdanh/`, `bangdiem/`, `tailieuhoctap/`, `nhanxethocvien/`, `trogiang/`, `thongtincanhan/` (mỗi thư mục có `index.jsx` và các tệp chức năng liên quan). Các tệp tên tiếng Việt viết liền không dấu. `layout` chứa `bocuc.jsx`, `thanhben.jsx`, `tieude.jsx`, `menu.js`, `menutaikhoan.jsx`, `thongbao.jsx` và các context. Menu tài khoản, thông tin cá nhân và đổi mật khẩu dùng lại component Manager.

Ba khóa **KINDY, KID, TEEN** lấy từ dữ liệu chung `Manager/components/KhoaHoc/data.js`, mỗi khóa gồm level 1, 2, 3 (mỗi level có lớp A/B). Giảng viên chỉ thấy các lớp được phân công. Dữ liệu lịch của hai vai trò dùng chung ID buổi học, tên lớp, phòng, sĩ số và giờ học; lưu điểm danh ở một vai trò sẽ hiển thị ở vai trò còn lại.

Các mục: Tổng quan, Lịch giảng dạy, Lớp học của tôi, Điểm danh, Bảng điểm, Tài liệu học tập, Nhận xét học viên, Trợ giảng. Lịch và kỳ nhập điểm mẫu dùng tháng 09/2026 theo thiết kế. `/giangvien` vẫn là danh sách giảng viên trong Manager.

## Cách đọc code khi mới học React

Mỗi trang thường có ba phần: lấy dữ liệu và khai báo trạng thái ở đầu, các hàm xử lý ở giữa, rồi `return` chứa giao diện JSX ở cuối. Bạn có thể bắt đầu từ `components/lophoc/index.jsx`, sau đó đọc `nhanxethocvien/index.jsx` để hiểu cách tìm kiếm, mở hộp thoại và lưu dữ liệu.

- `useState` lưu dữ liệu có thể thay đổi trên trang, chẳng hạn từ khóa tìm kiếm hoặc trạng thái đang lưu.
- `useDuLieu` gọi API và cung cấp `data`, `error`, `reload`. Mảng tham số phía sau cho biết khi nào cần tải lại, ví dụ `[classId]` khi đổi lớp.
- Các hàm như `saveComment`, `changeClass`, `uploadDocument` xử lý thao tác; JSX chỉ gọi các hàm này qua `onClick`, `onChange` hoặc `onSubmit`.
- `map` tạo giao diện từ một danh sách; `filter` chọn những phần tử phù hợp. Khi cập nhật state dạng object hoặc array, tạo bản mới bằng `...` thay vì sửa trực tiếp.
- `useEffect` dùng cho việc đồng bộ dữ liệu hoặc đăng ký sự kiện. Hàm được `return` bên trong effect dùng để dọn sự kiện, bộ đếm hoặc bỏ qua kết quả tải cũ khi rời trang.

## Chuyển sang API

1. Đặt `VITE_API_BASE_URL` trong `.env.development`.
2. Mở `src/api/giangvien.js`, bỏ comment `import apiClient from './client'`.
3. Trong từng hàm cần dùng API, đổi URL và bỏ comment dòng `return apiClient...`. Lệnh return này thay thế dữ liệu demo bên dưới, không cần sửa các trang giao diện. Với upload, bỏ comment cả phần `FormData` và `return`.
4. Backend cần trả đúng cấu trúc JSON bên dưới, hoặc điều chỉnh `.then(r => r.data)` để map response theo backend.

| Hàm | Response mẫu |
| --- | --- |
| `classes()` | `[{ id, name, size, room, days: [0,2,4], time: "08:00-09:30", rate: 96 }]`; days: 0 = thứ Hai |
| `profile()` / `saveProfile(payload)` | `{ id, name, role, email, phone, address, joined }` |
| `sessions(date)` | `[{ id, classId, name, room, time, slot, students, status, iso }]`; cùng ID buổi học mà Manager dùng |
| `roster(classId)` | `[{ id, name, birth, phone, rate }]` |
| `attendance(sessionId)` | `null` nếu chưa điểm danh, hoặc `{ classId, date, records: [{ studentId, status, note }], savedAt }`; status: `present`, `late`, `absent` |
| `saveAttendance(sessionId, payload)` | Trả bản ghi điểm danh đã lưu theo cấu trúc trên |
| `grades(classId, test)` | `{ status, rows: [{ studentId, scores: [7,6.5,6,7], note }], updatedAt }`; điểm chưa nhập là chuỗi rỗng; status: `draft`, `pending`, `published` |
| `saveGrades(classId, test, payload)` | Trả bảng điểm đã lưu |
| `comments(classId)` | `[{ id, studentId, classId, text, date }]` |
| `addComment(payload)` | Trả nhận xét mới |
| `assistants()` | `[{ id, name, email, classId, permissions, open, start, end, request, pending }]`; permissions: `attendance`, `roster`, `documents` |
| `assistantCandidates()` | `[{ id, name, email }]`; tài khoản trợ giảng có thể phân công |
| `gradingWindow(classId)` | `{ opensAt: "2026-09-10T00:00", closesAt: "2026-09-16T23:59", test: "Giữa kỳ T9" }`; định dạng ngày giờ local cho input datetime-local |
| `saveAssistant(payload)` | Trả toàn bộ danh sách trợ giảng đã cập nhật |
| `assistantSubmission(assistantId, classId)` | `{ test, rows: [{ studentId, scores, note }] }` |
| `reviewSubmission(assistantId, classId, payload)` | Duyệt/trả lại bài nhập điểm; `payload: { approve, test, rows, reason }`; API nên xử lý duyệt và cập nhật điểm cùng transaction |
| `documents()` | `[{ id, name, classIds, size, date, downloads, events: ["Tải lên..."] }]` |
| `uploadDocument(file, metadata)` | Nhận multipart: `file`, `metadata` (JSON `{ name, classIds }`); trả tài liệu mới |
| `updateDocument(doc)` | Trả tài liệu sau cập nhật |
| `downloadDocument(id)` | Blob nội dung tệp |
| `deleteDocument(id)` | Thành công 200 hoặc 204 |

API client hiện có tự gắn `access_token`. Vai trò ở màn đăng nhập lấy từ response backend. Quyền truy cập lớp, quyền trợ giảng, kỳ nhập điểm và chống sửa điểm đã công bố cần được backend xác thực. Lịch mẫu sinh từ các lớp Manager và trả qua `sessions(date)`; khi có backend, cả hai vai trò cần dùng chung session ID và class ID từ backend. ID buổi học frontend hiện là `date|slot|classId`.

## Dữ liệu demo

- Điểm danh, bảng điểm, nhận xét và trợ giảng lưu trong localStorage, prefix `neko-lecturer-v1:`.
- Nội dung tài liệu tải lên lưu ở IndexedDB `neko-lecturer-files`; metadata lưu localStorage. Các tài liệu có sẵn theo thiết kế chưa có file gốc, giao diện báo rõ khi tải xuống.
- Trạng thái điểm danh trên lịch Manager lưu ở `neko-schedule-overrides-v1`. Nút điểm danh trong lịch ngày và chi tiết khung giờ cùng mở `Attendance.jsx`; chỉ cập nhật lịch sau khi lưu đủ trạng thái học viên.
- ExcelJS chỉ tải khi dùng xuất/nhập Excel. Tệp nhập phải là `.xlsx`, tối đa 5 MB, giữ nguyên header của mẫu. Kiểm tra mã học viên, trùng mã, điểm 0–9 bước 0.5; có xem trước lỗi, tùy chọn bỏ dòng lỗi và ghi đè. Danh sách xuất được `.xlsx`, CSV, hoặc In / Lưu PDF.
- Bảng điểm được tự lưu sau 30 giây ngừng nhập. Xác nhận công bố yêu cầu đủ điểm hợp lệ và chuyển sang chỉ đọc.
