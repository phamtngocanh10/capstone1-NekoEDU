export const TEN_KY_NANG = ['Nghe', 'Đọc', 'Nói', 'Viết'];

export function diemHopLe(giaTri, choPhepTrong = true) {
  if (giaTri === '' || giaTri === null || giaTri === undefined) return choPhepTrong;
  if (typeof giaTri === 'boolean' || (typeof giaTri === 'string' && !giaTri.trim())) return false;
  const diem = Number(giaTri);
  return Number.isFinite(diem) && diem >= 0 && diem <= 9 && Number.isInteger(diem * 2);
}

export function daNhapDuDiem(dongDiem) {
  return dongDiem.scores?.length === 4 && dongDiem.scores.every(giaTri => diemHopLe(giaTri, false));
}

export function tinhDiemTrungBinh(danhSachDiem) {
  if (!daNhapDuDiem({ scores: danhSachDiem })) return null;
  const tongDiem = danhSachDiem.reduce((tong, giaTri) => tong + Number(giaTri), 0);
  return (tongDiem / 4).toFixed(1);
}

export function taoDuLieuDiem(danhSachDong) {
  return danhSachDong.map(({ studentId: maHocVien, scores: danhSachDiem, note: ghiChu }) => ({
    studentId: maHocVien,
    scores: danhSachDiem.map(giaTri => giaTri === '' || giaTri === null || giaTri === undefined ? '' : Number(giaTri)),
    note: ghiChu || '',
  }));
}
