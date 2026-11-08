from datetime import datetime
import joblib
import numpy as np
import pandas as pd
import pyodbc
from sklearn.linear_model import LinearRegression

print("1. Đang kết nối CSDL để lấy dữ liệu lịch sử tuyển sinh...")

# Kết nối lấy dữ liệu từ SQL Server
conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost;"
    "DATABASE=neko_edu;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
)

# Đã fix lỗi DATETIMEOFFSET bằng cách CAST về DATETIME
query = """
    SELECT id, full_name, source, status, interested_course, 
           CAST(created_at AS DATETIME) AS created_at 
    FROM admission_leads
"""
df = pd.read_sql(query, conn)
conn.close()

if len(df) == 0:
    print(
        "Lỗi: Bảng dữ liệu đang trống! Bạn nhớ chạy file seed_data.py trước"
        " nhé."
    )
    exit()

print(f"Đã tải thành công {len(df)} dòng dữ liệu từ SQL Server.")

print("\n2. Đang xử lý và gom nhóm dữ liệu theo tháng...")
# Chuyển cột created_at sang kiểu datetime
df["created_at"] = pd.to_datetime(df["created_at"])

# Trích xuất tháng/năm (ví dụ: '2026-07', '2026-08'...)
df["month_year"] = df["created_at"].dt.to_period("M")

# Thống kê số lượng học viên đăng ký theo từng tháng
monthly_data = (
    df.groupby("month_year").size().reset_index(name="enrollment_count")
)
monthly_data["month_year"] = monthly_data["month_year"].astype(str)

print("Bảng thống kê số lượng học viên theo tháng:")
print(monthly_data)

# Sắp xếp lại theo thời gian
monthly_data = monthly_data.sort_values("month_year")

print("\n3. Đang chuẩn bị dữ liệu và huấn luyện mô hình AI...")
# Tạo biến đầu vào X (số thứ tự tháng: 0, 1, 2, 3...) và nhãn y (số lượng học viên thực tế)
X = np.arange(len(monthly_data)).reshape(-1, 1)
y = monthly_data["enrollment_count"].values

# Khởi tạo mô hình Hồi quy tuyến tính (Linear Regression)
model = LinearRegression()

# Huấn luyện mô hình (AI bắt đầu học từ dữ liệu)
model.fit(X, y)
print("Huấn luyện mô hình AI hoàn tất!")

print("\n4. Thử nghiệm dự báo tháng tiếp theo...")
# Dự báo cho tháng kế tiếp
next_month_index = [[len(X)]]
predicted_count = model.predict(next_month_index)
print(
    "-> Dự báo số lượng học viên đăng ký trong tháng tới:"
    f" {max(1, int(predicted_count[0]))} học viên"
)

print("\n5. Đang lưu mô hình thành file để bàn giao cho Backend...")
# Đóng gói mô hình thành file .pkl
joblib.dump(model, "enrollment_model.pkl")
print("Đã lưu thành công mô hình vào file: 'enrollment_model.pkl'")