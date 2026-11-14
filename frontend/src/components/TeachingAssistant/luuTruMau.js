import { taoDuLieuMau } from './duLieuMau.js';

export const MA_LOI = Object.freeze({
  DU_LIEU_KHONG_HOP_LE: 'DU_LIEU_KHONG_HOP_LE',
  KHONG_TIM_THAY: 'KHONG_TIM_THAY',
  CHUA_THE_DIEM_DANH: 'CHUA_THE_DIEM_DANH',
  QUYEN_DA_DONG: 'QUYEN_DA_DONG',
  PHIEN_BAN_CU: 'PHIEN_BAN_CU',
  YEU_CAU_TRUNG: 'YEU_CAU_TRUNG',
  KHONG_THE_LUU: 'KHONG_THE_LUU',
});

export const KHOA_LUU_MAU = 'neko-trogiang-demo-v1';
export const saoChep = duLieu => JSON.parse(JSON.stringify(duLieu));
let duLieuTrongBoNho = null;

function layBoLuu() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function ghiDuLieu(duLieu, batBuocLuu = false) {
  const banSao = saoChep(duLieu);
  const boLuu = layBoLuu();
  const baoLoiLuu = () => baoLoi(
    'Không lưu được dữ liệu mẫu trên trình duyệt. Các thay đổi chưa được lưu; hãy kiểm tra quyền lưu trữ hoặc dung lượng rồi thử lại.',
    MA_LOI.KHONG_THE_LUU,
  );
  if (boLuu) {
    try { boLuu.setItem(KHOA_LUU_MAU, JSON.stringify(banSao)); }
    catch { if (batBuocLuu) baoLoiLuu(); }
  } else if (batBuocLuu && typeof window !== 'undefined') {
    baoLoiLuu();
  }
  duLieuTrongBoNho = banSao;
}

function duLieuHopLe(duLieu) {
  const laDoiTuong = giaTri => giaTri && typeof giaTri === 'object' && !Array.isArray(giaTri);
  const laDanhSach = giaTri => Array.isArray(giaTri) && giaTri.every(laDoiTuong);
  const laChuoi = giaTri => typeof giaTri === 'string';
  if (!laDoiTuong(duLieu) || duLieu.phienBan !== 1) return false;
  const cacDanhSach = ['classes', 'periods', 'grants', 'requests', 'submissions', 'buoiHoc', 'thongBao'];
  const cacBanDo = ['hocVienTheoLop', 'banNhapTheoQuyen', 'diemDanhTheoBuoi'];
  if (!cacDanhSach.every(ten => laDanhSach(duLieu[ten]))
    || !cacBanDo.every(ten => laDoiTuong(duLieu[ten]))) return false;

  const cacMaLop = new Set(duLieu.classes.map(lop => lop.id));
  const cacHocVienHopLe = duLieu.classes.every(lop => laChuoi(lop.id) && laChuoi(lop.name)
    && laChuoi(lop.time) && Array.isArray(lop.days) && Array.isArray(lop.permissions)
    && laDanhSach(duLieu.hocVienTheoLop[lop.id])
    && duLieu.hocVienTheoLop[lop.id].every(hocVien => laChuoi(hocVien.id)
      && laChuoi(hocVien.name) && laChuoi(hocVien.code)));
  const cacBuoiHopLe = duLieu.buoiHoc.every(buoi => laChuoi(buoi.id)
    && cacMaLop.has(buoi.classId) && laChuoi(buoi.iso) && laChuoi(buoi.time)
    && laChuoi(buoi.startTime) && Array.isArray(buoi.permissions));
  const cacQuyenHopLe = duLieu.grants.every(quyen => laChuoi(quyen.id)
    && cacMaLop.has(quyen.classId) && Number.isFinite(new Date(quyen.opensAt).getTime())
    && Number.isFinite(new Date(quyen.closesAt).getTime()));
  const cacBanNhapHopLe = Object.values(duLieu.banNhapTheoQuyen).every(banNhap => (
    laDoiTuong(banNhap) && laDanhSach(banNhap.rows)
    && banNhap.rows.every(dong => laChuoi(dong.studentId) && Array.isArray(dong.scores)
      && dong.scores.length === 4)
  ));
  const cacDiemDanhHopLe = Object.values(duLieu.diemDanhTheoBuoi).every(diemDanh => (
    laDoiTuong(diemDanh) && laDanhSach(diemDanh.records)
    && diemDanh.records.every(dong => laChuoi(dong.studentId))
  ));
  return cacHocVienHopLe && cacBuoiHopLe && cacQuyenHopLe && cacBanNhapHopLe && cacDiemDanhHopLe;
}

export function docDuLieu() {
  const boLuu = layBoLuu();
  if (boLuu) {
    try {
      const duLieu = JSON.parse(boLuu.getItem(KHOA_LUU_MAU) || 'null');
      if (duLieuHopLe(duLieu)) {
        duLieuTrongBoNho = duLieu;
        return saoChep(duLieu);
      }
      // Bản lưu sai cấu trúc: giữ bản đang dùng hoặc tạo lại dữ liệu mẫu.
      ghiDuLieu(duLieuTrongBoNho ?? taoDuLieuMau());
    } catch { /* Bản lưu không đọc được: dùng bản trong bộ nhớ hoặc tạo lại dữ liệu mẫu. */ }
  }
  if (!duLieuTrongBoNho) ghiDuLieu(taoDuLieuMau());
  return saoChep(duLieuTrongBoNho);
}

export function baoLoi(thongDiep, maLoi = MA_LOI.DU_LIEU_KHONG_HOP_LE) {
  const loi = new Error(thongDiep);
  loi.ma = maLoi;
  throw loi;
}
