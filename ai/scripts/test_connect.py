import pandas as pd
import pyodbc

print("Đang kết nối vào cơ sở dữ liệu SQL Server...")

try:
    # Kết nối vào SQL Server
    conn = pyodbc.connect(
        "DRIVER={ODBC Driver 17 for SQL Server};"
        "SERVER=localhost;"
        "DATABASE=neko_edu;"
        "Trusted_Connection=yes;"
        "TrustServerCertificate=yes;"
    )

    print("Kết nối thành công! Đang truy vấn bảng admission_leads...")

    # Đọc dữ liệu từ bảng admission_leads
    df = pd.read_sql("SELECT * FROM admission_leads", conn)
    conn.close()

    print(f"Lấy dữ liệu thành công! Tổng số dòng: {len(df)}")
    print("\nHiển thị 5 dòng đầu tiên:")
    print(df.head())

except Exception as e:
    print(f"Lỗi: {e}")