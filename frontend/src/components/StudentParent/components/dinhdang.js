export const taoma = (tiento) =>
  `${tiento}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function ngayhomnay() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function congngay(ngay, songay) {
  const moc = new Date(`${ngay}T12:00:00+07:00`);
  moc.setUTCDate(moc.getUTCDate() + songay);
  return moc.toISOString().slice(0, 10);
}

export function dautuan(ngay = ngayhomnay()) {
  const thu = new Date(`${ngay}T12:00:00+07:00`).getUTCDay();
  return congngay(ngay, -((thu + 6) % 7));
}

export function nhanthu(ngay) {
  const thu = new Date(`${ngay}T12:00:00+07:00`).getUTCDay();
  return thu === 0 ? 'CN' : `T${thu + 1}`;
}

export function dinhdangngay(ngay, tuychon = {}) {
  if (!ngay) return '—';
  const giatri = new Date(/^\d{4}-\d{2}-\d{2}$/.test(ngay) ? `${ngay}T12:00:00+07:00` : ngay);
  if (!Number.isFinite(giatri.getTime())) return '—';
  return giatri.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...tuychon,
  });
}

export function dinhdangngaygio(ngay) {
  if (!ngay) return '—';
  const giatri = new Date(ngay);
  return Number.isFinite(giatri.getTime())
    ? giatri.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
}

export const dinhdangtien = (sotien) => `${Number(sotien || 0).toLocaleString('vi-VN')}đ`;
export const tenkhoahoc = (dulieu, makhoa) =>
  dulieu.khoaHoc.find((khoa) => khoa.ma === makhoa)?.ten ?? 'Khóa học';
export const tenphuongthuc = (giatri) =>
  ({
    chuyenKhoan: 'Chuyển khoản ngân hàng',
    viDienTu: 'Ví MoMo / ZaloPay',
    tienMat: 'Tiền mặt tại quầy',
  })[giatri] ??
  giatri ??
  '—';

function chuanhoa(chuoi) {
  return String(chuoi ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function loctheotukhoa(danhsach, tukhoa, laychuoi) {
  const tuchuan = chuanhoa(tukhoa).trim();
  return tuchuan ? danhsach.filter((muc) => chuanhoa(laychuoi(muc)).includes(tuchuan)) : danhsach;
}
