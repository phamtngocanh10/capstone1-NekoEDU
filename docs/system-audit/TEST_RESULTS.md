# Kết quả kiểm thử và xác minh

Ngày kiểm tra: 08/11/2026

| Kiểm tra | Trạng thái | Kết quả / bằng chứng |
|---|---|---|
| Đọc kiến trúc và cấu hình Frontend/Backend | PASS (đọc source) | Frontend React/Vite ở `D:\NekoEDU-FE\frontend`; Backend Flask/SQLAlchemy/pyodbc |
| Truy vết BUG-001 trong FE | PASS (đọc source) | Nguyên nhân cũ là `saveStudent` chỉ gọi `setStudents`; Backend mode đã sửa để gọi API |
| Kiểm tra source Backend tạo học viên | PASS (đọc source) | `POST /api/v1/students`, Manager/JWT, service có transaction và commit |
| SELECT tên database SQL | PASS | `DB_NAME()` trả `NEKO_EDU` |
| SELECT số lượng học viên | PASS | `dbo.students` có 171 hàng |
| SELECT mã `HV20264013` | PASS | 0 hàng trong `dbo.students` |
| Build Frontend sau thay đổi | PASS | `npm run build` thành công với 2,232 modules; output vào thư mục tạm để không ghi đè `dist` |
| Frontend build bundle size | WARNING | Có chunk lớn hơn 500 kB sau minify; build không thất bại |
| Backend pytest collection | PASS (chỉ collection) | 867 test được thu thập trong 0.22 giây |
| Backend student API tests | PASS | Lần chạy cuối `scripts/prepare_database.py test -- tests/test_students.py -q`: 64 passed; gồm tạo guardian cùng transaction, tái sử dụng guardian trùng số phù hợp, rollback và POST → GET readback; DB test `NEKO_EDU_20261108_101553_c886e8f16e54_test` |
| Toàn bộ Backend pytest runtime | PASS (baseline trước thay đổi guardian) | `python scripts/prepare_database.py test -- -q`: 867 passed trong 653.58 giây trên DB test riêng |
| FE unit tests | NOT RUN | `package.json` chỉ có `dev`, `build`, `preview`; không khai báo script test |
| API POST → SQL → GET readback | PASS (DB test) | Integration test tạo guardian/student, GET lại hồ sơ và xác nhận quan hệ trên DB test riêng |
| E2E browser thao tác thêm học viên | NOT RUN | Chưa gửi form từ trình duyệt tới Backend test server |
| API POST từ Frontend → SQL Server | NOT RUN | Không ghi dữ liệu vào `NEKO_EDU` thật |
| Test toàn bộ CRUD các module | NOT RUN | Phạm vi audit source chưa đủ để tuyên bố E2E cho mọi chức năng |

## An toàn database

- Chỉ chạy SELECT trực tiếp/inspection trên `NEKO_EDU`; không chạy lệnh ghi vào database production.
- Không chạy INSERT/UPDATE/DELETE, `flask seed`, migration hoặc `pytest` trên database demo.
- Backend test helper chỉ đọc/đối chiếu `NEKO_EDU`, tạo database test riêng, migrate và chạy test trên database đó. Student tests mới nhất chạy trong `NEKO_EDU_20261108_101553_c886e8f16e54_test`; toàn bộ suite trước đó chạy trong `NEKO_EDU_20261108_084205_707aafd35113_test`. Các database test được giữ lại theo thiết kế helper.
- Test file `tests/test_students.py` dùng app/test fixtures trỏ tới `TEST_DATABASE_URL`; không có truy cập trực tiếp qua `DATABASE_URL` trong file này theo rà soát source.

## Kết luận

Build Frontend, toàn bộ 867 Backend tests trước đó, 64 student API tests mới nhất và các truy vấn metadata SQL chỉ đọc đã xác nhận được. API create→GET readback đã pass trên DB test; browser E2E và ghi thử vào DB thật không chạy. Kết quả này không phải xác nhận toàn bộ hệ thống E2E hoạt động.
