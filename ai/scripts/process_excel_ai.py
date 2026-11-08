import pandas as pd
import numpy as np

# ==========================================
# PHẦN 1: KẾT NỐI VÀ LÀM SẠCH DỮ LIỆU (ETL)
# ==========================================
FILE_PATH = "NEKO_Edu_387HS_DayDu_6Sheet.xlsx"

def load_and_clean_data(file_path):
    print("Đang nạp dữ liệu từ Excel...")
    
    # 1. Load danh sách học sinh (Header ở dòng 2 - index 1)
    df_hocsinh = pd.read_excel(file_path, sheet_name='DanhSachHocSinh', header=1)
    
    # 2. Load bảng theo dõi học phí (Header ở dòng 3 - index 2)
    df_hocphi = pd.read_excel(file_path, sheet_name='TheoDoiHocPhi', header=2)
    
    # 3. Load bảng Thu - Chi & AI Cảnh báo (Header ở dòng 3 - index 2)
    df_thuchi = pd.read_excel(file_path, sheet_name='BangThuChi_09_2025_09_2026', header=2)
    df_thuchi = df_thuchi.dropna(subset=['Tháng/Năm']) # Loại bỏ dòng trống
    
    return df_hocsinh, df_hocphi, df_thuchi

# ==========================================
# PHẦN 2: MODULE AI01 - TỰ ĐỘNG TÍNH HỌC PHÍ
# ==========================================
def ai_tinh_hoc_phi_chu_ky_moi(df_hocphi):
    """
    Tính học phí dự kiến cho chu kỳ tiếp theo (Tháng 10) dựa trên quy tắc nghiệp vụ.
    """
    print("\n--- [AI01] CHẠY THUẬT TOÁN TÍNH HỌC PHÍ THÁNG 10 ---")
    
    # Khởi tạo cột học phí tháng 10
    df_hocphi['Tháng 10 - Dự kiến thu'] = 0

    
    for index, row in df_hocphi.iterrows():
        hoc_phi_co_so = row['Học phí cơ sở / chu kỳ'] # Đã trừ 10% nếu có anh/chị/em
        giam_tru = row['Giảm trừ T9 (Vắng >4b / Hủy buổi)']
        
        # Xử lý ngoại lệ: Nếu thiếu dữ liệu (NaN), gán về 0 để tránh lỗi
        if pd.isna(hoc_phi_co_so): hoc_phi_co_so = 1000000
        if pd.isna(giam_tru): giam_tru = 0
            
        # Thuật toán tính tổng thu
        tien_phai_thu = hoc_phi_co_so - giam_tru
        
        # Đảm bảo tiền thu không bị âm
        df_hocphi.at[index, 'Tháng 10 - Dự kiến thu'] = max(0, tien_phai_thu)
        
        # Phân loại trạng thái chờ duyệt nếu có dấu hiệu bất thường (công nợ cũ chưa thanh toán)
        if "Quá hạn" in str(row['Tháng 9 - Trạng thái']):
            df_hocphi.at[index, 'Cảnh báo AI01'] = "Cần quản lý duyệt (Nợ kỳ trước)"
        else:
            df_hocphi.at[index, 'Cảnh báo AI01'] = "Gửi tự động"

    # In ra 5 học sinh đầu tiên để kiểm tra
    ket_qua = df_hocphi[['Mã học sinh', 'Họ và tên', 'Học phí cơ sở / chu kỳ', 'Giảm trừ T9 (Vắng >4b / Hủy buổi)', 'Tháng 10 - Dự kiến thu', 'Cảnh báo AI01']]
    print(ket_qua.head())
    return df_hocphi

# ==========================================
# PHẦN 3: MODULE AI03 - CẢNH BÁO RỦI RO TÀI CHÍNH
# ==========================================
def ai_canh_bao_rui_ro_tai_chinh(df_thuchi):
    """
    Thuật toán phân tích tỷ lệ Chi/Thu và phát tín hiệu cảnh báo rủi ro tài chính.
    """
    print("\n--- [AI03] CHẠY MÔ HÌNH PHÂN TÍCH TÀI CHÍNH ---")
    
    canh_bao_list = []
    
    for index, row in df_thuchi.iterrows():
        thang = row['Tháng/Năm']
        tong_thu = row['Thực thu học phí (VNĐ)']
        tong_chi = row['Tổng chi phí (VNĐ)']
        cong_no = row['Công nợ / Chờ xác minh (VNĐ)']
        
        # Xử lý phép chia cho 0
        if tong_thu == 0:
            ty_le = float('inf')
            trang_thai = "LỖI DÒNG TIỀN (DOANH THU = 0)"
        else:
            ty_le = (tong_chi / tong_thu) * 100
            
            # Logic cảnh báo theo TC-08 trong tài liệu Proposal
            if ty_le >= 80:
                trang_thai = f"CẢNH BÁO ĐỎ (Tỷ lệ Chi/Thu: {ty_le:.1f}%)"
            elif cong_no > (tong_thu * 0.1): # Bổ sung: Nợ vượt 10% doanh thu
                trang_thai = "CẢNH BÁO CÔNG NỢ CAO"
            else:
                trang_thai = "AN TOÀN"
                
        canh_bao_list.append({
            'Tháng': thang,
            'Thực Thu': tong_thu,
            'Tổng Chi': tong_chi,
            'Tỷ lệ Chi/Thu (%)': round(ty_le, 2) if tong_thu != 0 else 'N/A',
            'Kết luận AI': trang_thai
        })
        
    df_ket_qua_ai03 = pd.DataFrame(canh_bao_list)
    print(df_ket_qua_ai03.tail(5)) # In ra 5 tháng gần nhất
    return df_ket_qua_ai03

# ==========================================
# RUN HỆ THỐNG
# ==========================================
if __name__ == "__main__":
    # 1. Load data
    df_hs, df_hp, df_tc = load_and_clean_data(FILE_PATH)
    
    # 2. Xử lý AI01
    df_hocphi_moi = ai_tinh_hoc_phi_chu_ky_moi(df_hp)
    
    # 3. Phân tích AI03
    df_canh_bao = ai_canh_bao_rui_ro_tai_chinh(df_tc)