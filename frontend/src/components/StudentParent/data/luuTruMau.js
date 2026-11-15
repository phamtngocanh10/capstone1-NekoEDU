import { createDemoData } from './duLieuMau.js';

export const DEMO_DATA_KEY = 'neko-student-parent-data-v1';
const DATA_LIST_KEYS = [
  'hocVien',
  'khoaHoc',
  'ghiDanh',
  'lichHoc',
  'taiLieu',
  'diemDanh',
  'ketQua',
  'hoaDon',
  'thongBao',
  'phanHoiThongBao',
  'danhGia',
];
export const cloneData = (data) => JSON.parse(JSON.stringify(data));

function isValidDemoData(data) {
  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
  if (!isObject(data) || data.phienBan !== 1 || !isObject(data.taiKhoan)) return false;
  if (
    !['ten', 'email', 'dienThoai', 'diaChi', 'anhDaiDien'].every(
      (name) => typeof data.taiKhoan[name] === 'string'
    )
  )
    return false;
  if (
    !DATA_LIST_KEYS.every(
      (name) =>
        Array.isArray(data[name]) &&
        data[name].every((item) => isObject(item) && typeof item.ma === 'string')
    )
  )
    return false;
  const studentIds = new Set(data.hocVien.map((student) => student.ma));
  const courseIds = new Set(data.khoaHoc.map((course) => course.ma));
  return (
    studentIds.has(data.maHocVien) &&
    data.hocVien.every(
      (student) => typeof student.ten === 'string' && typeof student.maSo === 'string'
    ) &&
    data.khoaHoc.every(
      (course) =>
        typeof course.ten === 'string' &&
        Array.isArray(course.thuHoc) &&
        Array.isArray(course.chuongTrinh)
    ) &&
    ['ghiDanh', 'lichHoc', 'diemDanh', 'ketQua', 'hoaDon', 'danhGia'].every((name) =>
      data[name].every((item) => studentIds.has(item.maHocVien) && courseIds.has(item.maKhoa))
    ) &&
    data.taiLieu.every((file) => courseIds.has(file.maKhoa) && typeof file.ten === 'string') &&
    data.ketQua.every((result) => Array.isArray(result.kyNang) && Array.isArray(result.goiY)) &&
    data.thongBao.every(
      (notification) =>
        Array.isArray(notification.tepDinhKem) && typeof notification.noiDung === 'string'
    )
  );
}

export function readDemoData() {
  try {
    const data = JSON.parse(localStorage.getItem(DEMO_DATA_KEY));
    if (isValidDemoData(data)) return data;
  } catch {
    /* Bộ nhớ bị chặn hoặc bản mẫu cũ bị hỏng: vẫn cho xem dữ liệu mới. */
  }
  return createDemoData();
}

export function writeDemoData(data) {
  try {
    localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(data));
  } catch {
    throw new Error(
      'Chưa lưu được thay đổi. Hãy kiểm tra quyền lưu trữ hoặc dung lượng trình duyệt rồi thử lại.'
    );
  }
}
