# Báo cáo kiểm tra hệ thống NEKO EDU

Ngày kiểm tra: 08/11/2026

## Tóm tắt

- BUG-001 được xác định ở Frontend và đã được sửa ở mức source: thiết kế được giữ; form thêm có tên/quan hệ guardian bắt buộc. Backend account tạo hoặc tái dùng guardian theo số điện thoại trong cùng transaction với student, sau đó tải lại danh sách.
- Backend có endpoint tạo học viên và source code thực hiện commit transaction. Chưa có bằng chứng source cho thấy lỗi nằm ở thao tác commit của endpoint này.
- Truy vấn chỉ đọc vào `NEKO_EDU` xác nhận `HV20264013` chưa tồn tại và `dbo.students` có 171 bản ghi. Con số 429 trên giao diện không phải số lượng hiện có trong SQL tại thời điểm kiểm tra.
- Frontend React/Vite đang dùng là checkout riêng `D:\NekoEDU-FE\frontend`, nhánh `FE`. Thư mục `frontend` trong repository Backend chỉ có README, không phải ứng dụng đang chạy.
- Toàn bộ giao diện Frontend chưa được xác minh là kết nối SQL; các trang Manager chủ yếu dùng fixture và state trong trình duyệt. Backend SQL có API cho một số nghiệp vụ, nhưng không đồng nghĩa các trang FE đã dùng API đó.

## Kiến trúc đã xác minh

| Thành phần | Công nghệ/đường dẫn | Bằng chứng |
|---|---|---|
| Frontend | React 19, Vite 8; `D:\NekoEDU-FE\frontend` | `package.json`, `vite.config.js`; build thành công |
| Backend | Flask 3, flask-smorest, SQLAlchemy, pyodbc; `backend` | `requirements.txt`, `app/`, `run.py` |
| Database | Microsoft SQL Server, instance `SQLEXPRESS`, database `NEKO_EDU` | Truy vấn chỉ đọc trả về `DB_NAME() = NEKO_EDU` |
| FE/API wiring | Tài khoản demo vẫn chạy local; Backend account lấy JWT thật và dùng API học viên | `src/api/client.js`, `src/api/auth.js`, trang Học viên trong checkout Frontend |

Hai checkout có cùng tên repository nhưng khác nhánh/commit: repository Backend ở `feature/backend-api`; Frontend ở nhánh `FE`, commit `2e052756b690ef2b3f4ef433d47944be5a091046`. Không được nhầm thư mục `D:\capstone1-NekoEDU\frontend` với checkout FE đang chạy.

## BUG-001: thêm học viên không lưu SQL

1. Trước khi sửa, `StudentFormModal` gọi handler `saveStudent`, handler tạo ID rồi chỉ gọi `setStudents`; danh sách khởi tạo từ fixture. Reload làm mất học viên.
2. Backend `POST /api/v1/students` yêu cầu quyền Manager, validate schema, thực hiện các ghi liên quan trong service rồi commit transaction.
3. Đã nối Backend login, GET danh sách/trình độ, POST student+guardian và PATCH các trường được form hỗ trợ. Service xử lý guardian trùng số bằng row/range lock và chỉ tái sử dụng khi tên/quan hệ khớp; guardian/student/audit cùng commit hoặc rollback.
4. Schema/API lưu gender/address/contact_email đã có sẵn trong DB. Xếp lớp, học phí và tài khoản học viên chưa được nối; tài khoản demo vẫn dùng dữ liệu mẫu và thông báo rõ chưa lưu SQL.

**Kết luận:** lỗi ban đầu nằm ở luồng Frontend chưa tích hợp API, không phải lỗi SQL commit đã được xác định. Luồng Backend đã được nối ở source; chưa xác minh browser E2E.

## Kiểm tra dữ liệu SQL (chỉ đọc)

- `SELECT DB_NAME()` trả về `NEKO_EDU`.
- `SELECT COUNT_BIG(*) FROM dbo.students` trả về **171**.
- `SELECT COUNT_BIG(*) FROM dbo.students WHERE student_code = 'HV20264013'` trả về **0**.

Không chạy INSERT/UPDATE/DELETE, seed hoặc migration trong lần kiểm tra này.

## Inventory module (mức độ bao phủ)

| Nhóm | Frontend hiện tại | Backend/API |
|---|---|---|
| Học viên | Chế độ Backend gọi API cho list/create/update; chế độ tài khoản demo dùng fixture/state | Có list/create/detail/update/level transfer/learning history và liên kết |
| Khóa học/lớp | Dữ liệu mẫu; thao tác chủ yếu state/thông báo | Có API lớp, phân công nhân sự, lịch/buổi; chưa có CRUD đầy đủ danh mục khóa/lớp |
| Lịch/điểm danh | Lịch mẫu; một số thay đổi lưu browser localStorage | Có API lịch, buổi học, điểm danh, lịch sử và báo cáo |
| Học phí | Mẫu/state, thao tác thu không được xác minh là giao dịch SQL | Có API chu kỳ, tính/phát hành/điều chỉnh và chính sách; chưa có API tài chính tổng quát |
| Nhân sự | Mẫu/state | Có API users/staff và phân công |
| Đánh giá/điểm | Dữ liệu mẫu; giảng viên lưu browser-localStorage | Có API assessments/results; quy trình 4 kỹ năng và trợ giảng còn thiếu API hoàn chỉnh theo tài liệu schema |
| Thông báo | Store trong bộ nhớ; gửi thực tế chưa được xác minh | Có bảng schema nhưng không có router thông báo được đăng ký |
| Thu chi/lương | Mẫu/state | Có bảng schema; không có finance router được đăng ký |
| Tài liệu/nhận xét | Giảng viên dùng localStorage/IndexedDB | Có bảng schema; không có router cho file/tài liệu/nhận xét |
| Tài khoản/phân quyền | Đăng nhập demo hardcode; một số chỉnh sửa chỉ state/localStorage | Auth và API tài khoản/role có; ma trận quyền schema chưa được API thực thi đầy đủ |
| Tuyển sinh/AI | Dữ liệu mẫu; phần dự báo là minh họa | API admission leads có; bảng dự báo AI chưa có router AI |

Đây là inventory có giới hạn theo routes, API wrappers, README và các luồng chính. Chưa truy vết exhaustively mọi nút trên mọi component; không coi bảng này là bằng chứng E2E cho từng chức năng.

## Rủi ro ưu tiên

| Mức | Vấn đề | Tác động |
|---|---|---|
| Cao | BUG-001: nguyên nhân là luồng FE chỉ cập nhật state; đã nối Backend mode | Bản sửa build pass nhưng chưa chạy browser E2E |
| Cao | Các trang Manager chủ yếu dùng fixture/state | Giao diện có thể báo thao tác thành công nhưng SQL không đổi |
| Cao | FE demo login không có JWT Backend | Các route bảo vệ FE không đại diện cho xác thực/phân quyền SQL |
| Trung bình | Một số nhóm chỉ có schema, không có API | Không thể dùng SQL CRUD qua ứng dụng cho tài chính, thông báo, file, nhận xét, AI |
| Trung bình | Tệp JavaScript bundle lớn hơn 500 kB | Build thành công nhưng có cảnh báo kích thước bundle |

## Giới hạn và phần chưa xác minh

- Không kiểm thử giao diện thao tác thực tế trong browser; không chạy server mới.
- Backend test helper chỉ đọc/đối chiếu `NEKO_EDU`, tạo test database riêng và giữ lại database đó; toàn bộ 867 Backend tests đã pass ở baseline trước thay đổi guardian, và 64 student API tests pass sau thay đổi mới nhất. Không ghi dữ liệu production.
- `pytest --collect-only -q` thu thập được 867 test; đây không phải kết quả chạy test.
- `npm run build` sau thay đổi của FE thành công trong thư mục tạm, không ghi đè `dist` sẵn có.
- Không kiểm tra mọi component, mọi API wrapper hoặc mọi constraint bằng SQL metadata trong lượt này.
- Student API tests đã chạy trong database test riêng: 64 passed sau thay đổi guardian; toàn bộ Backend suite: 867 passed ở baseline trước các thay đổi mới nhất. Các kết quả này không chứng minh luồng browser FE gọi API thành công.
- Không thay đổi dữ liệu production trong audit này. Worktree Backend có nhiều thay đổi sẵn trước audit; giữ nguyên các thay đổi đó. `D:\NekoEDU-FE` là checkout riêng và ban đầu sạch; chỉ sửa file thuộc auth/API/Học viên.
