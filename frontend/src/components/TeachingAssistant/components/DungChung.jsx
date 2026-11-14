import { useCallback, useEffect, useState } from 'react';
import { CircleAlert as BieuTuongLoi, Inbox as HopThu, LoaderCircle as VongTai } from 'lucide-react';
import { Btn as Nut, Card as The } from '../../../common/ui';
import { norm as chuanHoaChuoi } from '../../../common/format';

export function layThongBaoLoi(loi, macDinh = 'Không thể tải dữ liệu.') {
  return loi?.message || macDinh;
}

// phuThuoc quyết định lúc tải lại. Bỏ qua phản hồi cũ khi đổi trang/bộ lọc.
export function useTaiDuLieu(hamTai, phuThuoc = []) {
  const [duLieu, datDuLieu] = useState(null);
  const [loi, datLoi] = useState('');
  const [dangTai, datDangTai] = useState(true);
  const [lanTai, datLanTai] = useState(0);
  const taiLai = useCallback(() => datLanTai(soLan => soLan + 1), []);

  useEffect(() => {
    let conHieuLuc = true;
    datDangTai(true);
    datLoi('');
    datDuLieu(null);

    async function taiDuLieu() {
      try {
        const ketQua = await hamTai();
        if (conHieuLuc) datDuLieu(ketQua);
      } catch (loiTai) {
        if (conHieuLuc) datLoi(layThongBaoLoi(loiTai));
      } finally {
        if (conHieuLuc) datDangTai(false);
      }
    }

    taiDuLieu();
    return () => { conHieuLuc = false; };
  }, [...phuThuoc, lanTai]);

  return { duLieu, datDuLieu, loi, dangTai, taiLai };
}

export function TrangThaiTrong({ bieuTuong: BieuTuong = HopThu, tieuDe = 'Chưa có dữ liệu', moTa, children: noiDung }) {
  return (
    <div className="ta-empty">
      <span className="ta-empty__icon"><BieuTuong size={27} strokeWidth={1.6} /></span>
      <h3>{tieuDe}</h3>
      {moTa && <p>{moTa}</p>}
      {noiDung && <div className="ta-empty__actions">{noiDung}</div>}
    </div>
  );
}

export function TrangThaiTaiDuLieu({ loi, thuLai }) {
  return (
    <The className="ta-load" aria-live="polite">
      {loi ? <BieuTuongLoi size={22} /> : <VongTai className="ta-spin" size={22} />}
      <p role={loi ? 'alert' : 'status'}>{loi || 'Đang tải dữ liệu…'}</p>
      {loi && thuLai && <Nut variant="soft" onClick={thuLai}>Thử lại</Nut>}
    </The>
  );
}

export function NguoiDung({ ten = '', ma }) {
  const chuCaiDau = ten.trim().split(/\s+/).at(-1)?.charAt(0) || '?';
  return (
    <span className="ta-person">
      <span className="ta-person__avatar">{chuCaiDau}</span>
      <span><strong>{ten || 'Chưa có tên'}</strong>{ma && <small>{ma}</small>}</span>
    </span>
  );
}

export const coQuyen = (lop, quyen) => lop?.permissions?.includes(quyen) ?? false;

export function locTheoTuKhoa(danhSach, tuKhoa, layChuoi) {
  const tuKhoaChuan = chuanHoaChuoi(tuKhoa.trim());
  if (!tuKhoaChuan) return danhSach;
  return danhSach.filter(phanTu => chuanHoaChuoi(layChuoi(phanTu)).includes(tuKhoaChuan));
}

export function ngayHomNay() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function congNgay(ngay, soNgay) {
  const ngayMoi = new Date(`${String(ngay).slice(0, 10)}T12:00:00`);
  ngayMoi.setDate(ngayMoi.getDate() + soNgay);
  const nam = ngayMoi.getFullYear();
  const thang = String(ngayMoi.getMonth() + 1).padStart(2, '0');
  const ngayTrongThang = String(ngayMoi.getDate()).padStart(2, '0');
  return `${nam}-${thang}-${ngayTrongThang}`;
}

export function thuHaiDauTuan(ngay = ngayHomNay()) {
  const ngayCanTinh = new Date(`${String(ngay).slice(0, 10)}T12:00:00`);
  return congNgay(ngay, -((ngayCanTinh.getDay() + 6) % 7));
}

export function dinhDangNgay(ngay, tuyChon = {}) {
  if (!ngay) return '—';
  const chuoiNgay = String(ngay);
  const ngayVietNam = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(chuoiNgay);
  let ngayDaDoc;
  if (ngayVietNam) {
    ngayDaDoc = new Date(`${ngayVietNam[3]}-${ngayVietNam[2]}-${ngayVietNam[1]}T12:00:00`);
  } else {
    ngayDaDoc = new Date(/^\d{4}-\d{2}-\d{2}$/.test(chuoiNgay) ? `${chuoiNgay}T12:00:00` : ngay);
  }
  if (Number.isNaN(ngayDaDoc.getTime())) return chuoiNgay;
  return ngayDaDoc.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', ...tuyChon,
  });
}

export function dinhDangNgayGio(ngay) {
  if (!ngay) return '—';
  const ngayDaDoc = new Date(ngay);
  if (Number.isNaN(ngayDaDoc.getTime())) return String(ngay);
  return ngayDaDoc.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
