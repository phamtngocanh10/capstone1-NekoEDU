export const khoaphien = 'neko-student-parent-session-v1';
export const taikhoanmau = Object.freeze({ taiKhoan: 'ph01', matKhau: 'Neko@2026' });

export function lataikhoanhocvien(tendangnhap) {
  return ['ph01', 'hv01'].includes(String(tendangnhap).trim().toLowerCase());
}

export function dangnhaphocvien(tendangnhap, matkhau) {
  if (!lataikhoanhocvien(tendangnhap) || matkhau !== taikhoanmau.matKhau) {
    throw new Error('Tài khoản hoặc mật khẩu chưa đúng.');
  }
  try {
    localStorage.setItem(
      khoaphien,
      JSON.stringify({
        taiKhoan: String(tendangnhap).trim().toLowerCase(),
        vaiTro: 'StudentParent',
      })
    );
  } catch {
    throw new Error(
      'Không lưu được phiên đăng nhập. Hãy cho phép trình duyệt lưu dữ liệu rồi thử lại.'
    );
  }
}

export function dadangnhaphocvien() {
  try {
    const phien = JSON.parse(localStorage.getItem(khoaphien));
    return phien?.vaiTro === 'StudentParent' && lataikhoanhocvien(phien.taiKhoan);
  } catch {
    return false;
  }
}

export function dangxuathocvien() {
  try {
    localStorage.removeItem(khoaphien);
  } catch {
    throw new Error('Chưa đăng xuất được. Vui lòng thử lại.');
  }
}
