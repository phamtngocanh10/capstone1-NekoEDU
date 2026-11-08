import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier
import joblib

# ==========================================
# BƯỚC 1: NẠP VÀ TIỀN XỬ LÝ DỮ LIỆU
# ==========================================
print("1. Đang nạp dữ liệu từ Excel...")
df = pd.read_excel("NEKO_Edu_387HS_DayDu_6Sheet.xlsx", sheet_name="DanhSachHocSinh", header=1)

# Tính tuổi từ Ngày sinh để làm đặc trưng phân tích (Feature Engineering)
def calculate_age(dob):
    if pd.isna(dob):
        return 0
    today = datetime.now()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

df['Tuổi'] = df['Ngày sinh'].apply(calculate_age)

# Tạo dữ liệu giả lập cho biến mục tiêu: "Xác suất đăng ký thành công" (1: Đăng ký, 0: Trượt)
# Trong thực tế, dữ liệu này sẽ lấy từ bảng admission_leads trong SQL của bạn
np.random.seed(42)
df['Da_Dang_Ky'] = np.random.choice([1, 0], size=len(df), p=[0.7, 0.3])

# Chọn các cột có giá trị để AI học quy luật
features = ['Giới tính', 'Tuổi', 'Level', 'Ghi chú anh chị em']
X = df[features].copy()
y = df['Da_Dang_Ky']

# Chuyển đổi dữ liệu chữ (Nam/Nữ, KINDY/TEEN) thành số để thuật toán hiểu được
print("2. Đang mã hóa dữ liệu chữ thành số...")
le_dict = {}
for col in ['Giới tính', 'Level', 'Ghi chú anh chị em']:
    le = LabelEncoder()
    X[col] = le.fit_transform(X[col].astype(str))
    le_dict[col] = le # Lưu lại bộ mã hóa để dùng sau này

# ==========================================
# BƯỚC 2: HUẤN LUYỆN MÔ HÌNH BẰNG XGBOOST
# ==========================================
# Chia dữ liệu: 80% để học (train), 20% để thi kiểm tra (test)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("3. Đang huấn luyện AI bằng XGBoost...")
model = XGBClassifier(
    n_estimators=100, 
    learning_rate=0.1, 
    max_depth=4, 
    random_state=42,
    use_label_encoder=False,
    eval_metric='logloss'
)

# Bắt đầu cho máy học
model.fit(X_train, y_train)

# Chấm điểm độ chính xác
accuracy = model.score(X_test, y_test)
print(f"-> Hoàn thành! Độ chính xác của mô hình trên tập kiểm tra: {accuracy * 100:.2f}%")

# ==========================================
# BƯỚC 3: ĐÓNG GÓI XUẤT RA FILE .pkl
# ==========================================
print("4. Đang xuất mô hình ra file .pkl...")
joblib.dump(model, 'enrollment_model.pkl')
joblib.dump(le_dict, 'label_encoders.pkl') # Xuất cả bộ dịch chữ->số để API dùng
print("-> Đã lưu thành công file 'enrollment_model.pkl'!")
print("Sẵn sàng tích hợp vào FastAPI.")