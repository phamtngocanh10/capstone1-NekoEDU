export const KHOA_TAI_KHOAN_MAU = 'neko-trogiang-demo-profile-v1';
export const KHOA_PHIEN_MAU = 'neko-trogiang-demo-session-v1';
export const DANG_NHAP_MAU = Object.freeze({ taiKhoan: 'tg01', matKhau: 'Neko@2026' });

const TAI_KHOAN_MAU = {
  id: 'tro-giang-mau',
  username: DANG_NHAP_MAU.taiKhoan,
  name: 'Nguyễn Thảo Vy',
  role: 'Teaching Assistant',
  email: 'thaovy@neko.edu.vn',
  phone: '0905123456',
  address: 'Hải Châu, Đà Nẵng',
  joined: '09/2025',
  avatarUrl: '',
};

export function laTaiKhoanTroGiang(taiKhoan) {
  return String(taiKhoan).trim().toLowerCase() === DANG_NHAP_MAU.taiKhoan;
}

export function dangNhapTroGiang(taiKhoan, matKhau) {
  if (!laTaiKhoanTroGiang(taiKhoan) || matKhau !== DANG_NHAP_MAU.matKhau) {
    throw new Error('Tài khoản hoặc mật khẩu chưa đúng.');
  }
  try {
    // Phiên mẫu chỉ giữ danh tính, không lưu mật khẩu hay ghi đè token API.
    localStorage.setItem(KHOA_PHIEN_MAU, JSON.stringify({
      id: TAI_KHOAN_MAU.id,
      username: DANG_NHAP_MAU.taiKhoan,
      role: TAI_KHOAN_MAU.role,
    }));
  } catch {
    throw new Error('Không lưu được phiên đăng nhập. Vui lòng cho phép trình duyệt lưu dữ liệu rồi thử lại.');
  }
}

export function daDangNhapTroGiang() {
  try {
    const phien = JSON.parse(localStorage.getItem(KHOA_PHIEN_MAU));
    return phien?.id === TAI_KHOAN_MAU.id
      && phien.username === DANG_NHAP_MAU.taiKhoan && phien.role === TAI_KHOAN_MAU.role;
  } catch {
    return false;
  }
}

export function dangXuatTroGiang() {
  try {
    localStorage.removeItem(KHOA_PHIEN_MAU);
  } catch {
    throw new Error('Chưa xóa được phiên đăng nhập. Vui lòng thử lại.');
  }
}

function chuanHoaTaiKhoan(duLieu = {}) {
  const taiKhoan = { ...TAI_KHOAN_MAU };
  for (const tenTruong of ['name', 'email', 'phone', 'address', 'joined']) {
    if (typeof duLieu[tenTruong] === 'string') {
      taiKhoan[tenTruong] = duLieu[tenTruong].slice(0, 255);
    }
  }
  const anhDaiDien = duLieu.avatarUrl;
  if (typeof anhDaiDien === 'string'
    && anhDaiDien.length <= 1500000
    && /^data:image\/(png|jpeg|webp);base64,/.test(anhDaiDien)) {
    taiKhoan.avatarUrl = anhDaiDien;
  }
  return taiKhoan;
}

export function layTaiKhoanMau() {
  try {
    const duLieu = JSON.parse(localStorage.getItem(KHOA_TAI_KHOAN_MAU));
    return chuanHoaTaiKhoan(duLieu && typeof duLieu === 'object' ? duLieu : {});
  } catch {
    return { ...TAI_KHOAN_MAU };
  }
}

export function luuTaiKhoanMau(duLieu) {
  const taiKhoan = chuanHoaTaiKhoan(duLieu);
  try {
    localStorage.setItem(KHOA_TAI_KHOAN_MAU, JSON.stringify(taiKhoan));
    return taiKhoan;
  } catch {
    throw new Error('Trình duyệt chưa cho phép lưu hồ sơ mẫu. Hãy kiểm tra dung lượng hoặc quyền lưu trữ.');
  }
}
