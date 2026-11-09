# Checklist sẵn sàng demo NEKO EDU

Ngày kiểm tra: 08/11/2026

## Có thể trình bày

- [x] Frontend demo React/Vite build được.
- [x] Frontend chạy ở checkout `D:\NekoEDU-FE\frontend`.
- [x] Backend có API học viên và các API nghiệp vụ được liệt kê trong Swagger.
- [x] SQL Server `NEKO_EDU` đã được xác nhận truy cập được bằng truy vấn chỉ đọc.
- [x] Có thể kiểm tra bằng Swagger: đăng nhập Backend, Authorize access token, gọi `GET /api/v1/students`.
- [x] Có hướng dẫn chạy demo ở [RUN_DEMO.md](../../RUN_DEMO.md).

## Không nên giới thiệu là đã nối SQL

- [ ] Chỉ thao tác Học viên với Backend account (ví dụ `mg01`) mới đọc/lưu SQL; account FE demo `manager`/`giangvien` vẫn dùng state demo và toast ghi rõ chưa lưu SQL.
- [ ] Không giới thiệu số học viên FE 429 là số trong database; SQL hiện có 171 học viên.
- [ ] Không coi tài khoản FE `manager`/`giangvien` là tài khoản SQL. Đăng nhập FE demo không phát hành JWT Backend.
- [ ] Không giới thiệu Thu chi, Thông báo, nhận xét/tài liệu hoặc dự báo AI trên FE là nghiệp vụ SQL hoàn chỉnh.

## Kiểm tra trước khi demo

- [ ] Chạy SQL Server instance `SQLEXPRESS`.
- [ ] Chạy Backend ở `http://127.0.0.1:8000`; health endpoint trả `status: ok`.
- [ ] Chạy Frontend ở `http://127.0.0.1:5173`.
- [ ] Mở Swagger `http://127.0.0.1:8000/docs`.
- [ ] Để chứng minh dữ liệu thật, dùng Swagger login Backend và truy vấn `GET /api/v1/students`.
- [ ] Không chạy `flask seed` trên `NEKO_EDU`.

## BUG và phần chưa sẵn sàng

- [ ] BUG-001: đã nối Backend mode ở source và build pass; chưa chạy browser E2E round-trip nên chưa xác nhận hoàn toàn.
- [ ] FE/backend integration cho các module còn lại chưa được kiểm chứng đầy đủ.
- [x] Backend student API tests: 64 test pass sau thay đổi guardian; toàn bộ Backend suite: 867 test pass ở baseline trước thay đổi guardian. Browser E2E chưa chạy.
- [ ] Không có kết quả E2E browser; không tuyên bố toàn hệ thống đã hoạt động 100%.
