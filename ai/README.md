# AI của NEKO Edu

Giữ nguyên phần AI đã có trên nhánh `main` khi hợp nhất code FE/BE:

- `data/`: dữ liệu Excel của nhóm.
- `notebooks/`: notebook phân tích tuyển sinh, tài chính và mô hình đi kèm.
- `models/`: các file mô hình `.pkl` đã được nhóm cung cấp.
- `scripts/`: xử lý Excel, kết nối database, huấn luyện và nạp dữ liệu.

Hiện chưa có `requirements.txt` riêng, phiên bản thư viện cố định hoặc service/API AI trong thư mục này. FE/BE có hướng dẫn chạy riêng tại [README gốc](../README.md); chưa xác minh luồng dự báo từ các file AI này tới FE/BE.

Code AI hiện có giả định về thư mục chạy, đường dẫn Excel/model và cấu hình SQL Server. Cần người phụ trách AI kiểm tra trước khi chạy. Không chạy `scripts/seed_data.py` để kiểm tra kết nối: script này ghi dữ liệu và commit vào database. Đợt hợp nhất chỉ giữ nguyên các file AI, không chạy notebook, huấn luyện, tải mô hình hoặc thay đổi dữ liệu SQL Server.
