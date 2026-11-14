import { taodulieumau } from './duLieuMau.js';

export const khoadulieu = 'neko-student-parent-data-v1';
const cacdanhsach = [
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
export const saochep = (dulieu) => JSON.parse(JSON.stringify(dulieu));

function dulieuhople(dulieu) {
  const ladoituong = (giatri) => giatri && typeof giatri === 'object' && !Array.isArray(giatri);
  if (!ladoituong(dulieu) || dulieu.phienBan !== 1 || !ladoituong(dulieu.taiKhoan)) return false;
  if (
    !['ten', 'email', 'dienThoai', 'diaChi', 'anhDaiDien'].every(
      (ten) => typeof dulieu.taiKhoan[ten] === 'string'
    )
  )
    return false;
  if (
    !cacdanhsach.every(
      (ten) =>
        Array.isArray(dulieu[ten]) &&
        dulieu[ten].every((muc) => ladoituong(muc) && typeof muc.ma === 'string')
    )
  )
    return false;
  const cacmahocvien = new Set(dulieu.hocVien.map((hocvien) => hocvien.ma));
  const cacmakhoa = new Set(dulieu.khoaHoc.map((khoa) => khoa.ma));
  return (
    cacmahocvien.has(dulieu.maHocVien) &&
    dulieu.hocVien.every(
      (hocvien) => typeof hocvien.ten === 'string' && typeof hocvien.maSo === 'string'
    ) &&
    dulieu.khoaHoc.every(
      (khoa) =>
        typeof khoa.ten === 'string' &&
        Array.isArray(khoa.thuHoc) &&
        Array.isArray(khoa.chuongTrinh)
    ) &&
    ['ghiDanh', 'lichHoc', 'diemDanh', 'ketQua', 'hoaDon', 'danhGia'].every((ten) =>
      dulieu[ten].every((muc) => cacmahocvien.has(muc.maHocVien) && cacmakhoa.has(muc.maKhoa))
    ) &&
    dulieu.taiLieu.every((tep) => cacmakhoa.has(tep.maKhoa) && typeof tep.ten === 'string') &&
    dulieu.ketQua.every((ketqua) => Array.isArray(ketqua.kyNang) && Array.isArray(ketqua.goiY)) &&
    dulieu.thongBao.every(
      (thongbao) => Array.isArray(thongbao.tepDinhKem) && typeof thongbao.noiDung === 'string'
    )
  );
}

export function docdulieu() {
  try {
    const dulieu = JSON.parse(localStorage.getItem(khoadulieu));
    if (dulieuhople(dulieu)) return dulieu;
  } catch {
    /* Bộ nhớ bị chặn hoặc bản mẫu cũ bị hỏng: vẫn cho xem dữ liệu mới. */
  }
  return taodulieumau();
}

export function luudulieu(dulieu) {
  try {
    localStorage.setItem(khoadulieu, JSON.stringify(dulieu));
  } catch {
    throw new Error(
      'Chưa lưu được thay đổi. Hãy kiểm tra quyền lưu trữ hoặc dung lượng trình duyệt rồi thử lại.'
    );
  }
}
