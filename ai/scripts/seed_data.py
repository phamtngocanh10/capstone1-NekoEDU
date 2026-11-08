from datetime import datetime, timedelta
import random
import pyodbc

print("Đang kết nối vào SQL Server để tạo dữ liệu mẫu...")

# Kết nối database
conn = pyodbc.connect(
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost;"
    "DATABASE=neko_edu;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
)
cursor = conn.cursor()

# Danh sách tên giả lập để tạo dữ liệu ngẫu nhiên
ho = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ"]
dem = ["Văn", "Thị", "Hữu", "Đình", "Minh", "Thanh", "Ngọc", "Gia"]
ten = ["An", "Bình", "Cường", "Dung", "Hà", "H Huy", "Linh", "Nam", "Phương", "Quân"]

nguon = ["FACEBOOK", "WEBSITE", "WALK_IN", "REFERRAL", "HOTLINE"]
trang_thai = ["NEW", "CONTACTED", "CONSULTING", "ENROLLED"]
khoa_hoc = ["IELTS 6.5", "IELTS 7.0", "Giao tiếp cơ bản", "Tiếng Anh trẻ em"]

print("Đang chèn 20 dòng dữ liệu mẫu vào bảng admission_leads...")

# Vòng lặp tạo 20 bản ghi giả lập
for i in range(1, 21):
    full_name = f"{random.choice(ho)} {random.choice(dem)} {random.choice(ten)}"
    phone_number = f"09{random.randint(10000000, 99999999)}"
    email = f"user{i}@example.com"

    # Tạo ngày đăng ký ngẫu nhiên trong vòng 4 tháng qua (để AI có dữ liệu theo tháng)
    ngay_lui = random.randint(1, 120)
    created_at = datetime.now() - timedelta(days=ngay_lui)

    source = random.choice(nguon)
    status = random.choice(trang_thai)
    course = random.choice(khoa_hoc)

    # Câu lệnh SQL Insert
    sql = """
        INSERT INTO admission_leads (full_name, phone_number, email, source, status, interested_course, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    cursor.execute(
        sql,
        (
            full_name,
            phone_number,
            email,
            source,
            status,
            course,
            created_at,
            created_at,
        ),
    )

# Lưu thay đổi vào database
conn.commit()
cursor.close()
conn.close()

print("Đã tạo thành công 20 dòng dữ liệu mẫu vào cơ sở dữ liệu!")