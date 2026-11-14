export const TEN_THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function dinhDangThu(danhSachThu = []) {
  return danhSachThu.map(thu => TEN_THU[thu] || thu).join(' · ');
}

export function layGioBuoiHoc(buoiHoc) {
  const [gioBatDau, gioKetThuc] = buoiHoc.time?.split(/[–-]/) ?? [];
  return {
    batDau: buoiHoc.startTime || gioBatDau,
    ketThuc: buoiHoc.endTime || gioKetThuc,
  };
}

export function duongDanDiemDanh(buoiHoc) {
  const thamSo = new URLSearchParams({
    sessionId: buoiHoc.id,
    classId: buoiHoc.classId,
  });
  return `/assistant/diemdanh?${thamSo}`;
}
