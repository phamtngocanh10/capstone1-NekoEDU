import { taoDuLieuMau } from './duLieuMau.js';
import { diemHopLe } from './components/xuLyDiem.js';
import { baoLoi, docDuLieu, ghiDuLieu, MA_LOI, saoChep } from './luuTruMau.js';

function layLop(duLieu, maLop) {
  const lop = duLieu.classes.find(lopHoc => lopHoc.id === String(maLop));
  if (!lop) baoLoi('Không tìm thấy lớp được phân công.', MA_LOI.KHONG_TIM_THAY);
  return lop;
}

function layBuoi(duLieu, maBuoi) {
  const buoi = duLieu.buoiHoc.find(buoiHoc => buoiHoc.id === String(maBuoi));
  if (!buoi) baoLoi('Không tìm thấy buổi hỗ trợ.', MA_LOI.KHONG_TIM_THAY);
  return buoi;
}

function trangThaiQuyen(quyen) {
  if (['revoked', 'published'].includes(quyen.state)) return quyen.state;
  const hienTai = Date.now();
  if (hienTai < new Date(quyen.opensAt).getTime()) return 'scheduled';
  if (hienTai > new Date(quyen.closesAt).getTime()) return 'expired';
  return 'open';
}

function layQuyen(duLieu, maQuyen, canNhap = false) {
  const quyen = duLieu.grants.find(quyenNhap => quyenNhap.id === String(maQuyen));
  if (!quyen) baoLoi('Không tìm thấy quyền nhập điểm.', MA_LOI.KHONG_TIM_THAY);
  const lanGuiChoDuyet = duLieu.submissions.find(lanGui => lanGui.grantId === quyen.id && lanGui.status === 'PENDING');
  const ketQua = { ...quyen, state: trangThaiQuyen(quyen), pending: Boolean(lanGuiChoDuyet), submissionId: lanGuiChoDuyet?.id ?? null };
  if (canNhap && (ketQua.state !== 'open' || ketQua.pending)) {
    baoLoi('Quyền nhập điểm chưa mở, đã đóng hoặc bảng điểm đang chờ duyệt.', MA_LOI.QUYEN_DA_DONG);
  }
  return ketQua;
}

function taoKhongGian(duLieu) {
  return saoChep({
    staffId: duLieu.staffId, classes: duLieu.classes, periods: duLieu.periods,
    requests: duLieu.requests, submissions: duLieu.submissions,
    grants: duLieu.grants.map(quyen => layQuyen(duLieu, quyen.id)),
  });
}

function docNgay(giaTri) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(giaTri))) baoLoi('Ngày hỗ trợ không hợp lệ.');
  const ngay = new Date(`${giaTri}T12:00:00+07:00`);
  if (!Number.isFinite(ngay.getTime()) || ngay.toISOString().slice(0, 10) !== giaTri) baoLoi('Ngày hỗ trợ không hợp lệ.');
  return ngay.getTime();
}

function tinhBuoiHoc(duLieu, buoi) {
  const cacBanGhi = duLieu.diemDanhTheoBuoi[buoi.id]?.records ?? [];
  const soCoMat = cacBanGhi.filter(banGhi => ['present', 'late'].includes(banGhi.status)).length;
  return { ...buoi, status: buoi.sessionStatus === 'CANCELLED' ? 'cancelled'
    : cacBanGhi.length === buoi.students ? 'attended' : 'upcoming',
    att: `${soCoMat}/${buoi.students}`,
  };
}

function taoDiemDanh(duLieu, maBuoi) {
  const buoi = layBuoi(duLieu, maBuoi);
  const daLuu = duLieu.diemDanhTheoBuoi[buoi.id];
  const duocNhap = buoi.sessionStatus !== 'CANCELLED'
    && Date.now() >= new Date(`${buoi.iso}T${buoi.startTime}:00+07:00`).getTime();
  return {
    sessionId: buoi.id, classId: buoi.classId, date: buoi.iso,
    status: buoi.sessionStatus, editable: duocNhap, savedAt: daLuu?.savedAt ?? null,
    rows: duLieu.hocVienTheoLop[buoi.classId].map(hocVien => {
      const banGhi = daLuu?.records.find(dong => dong.studentId === hocVien.id);
      return { studentId: hocVien.id, name: hocVien.name, code: hocVien.code, status: banGhi?.status ?? '', note: banGhi?.note ?? '' };
    }),
  };
}

function taoBanNhap(duLieu, maQuyen) {
  const quyen = layQuyen(duLieu, maQuyen);
  const banNhap = duLieu.banNhapTheoQuyen[quyen.id];
  return { grantId: quyen.id, classId: quyen.classId, className: quyen.className,
    assessmentId: quyen.assessmentId, title: quyen.title, teacher: quyen.teacher,
    opensAt: quyen.opensAt, closesAt: quyen.closesAt, state: quyen.state,
    pending: quyen.pending, editable: quyen.state === 'open' && !quyen.pending,
    version: banNhap?.version ?? null, updatedAt: banNhap?.updatedAt ?? null,
    rows: duLieu.hocVienTheoLop[quyen.classId].map(hocVien => {
      const dongDiem = banNhap?.rows.find(dong => dong.studentId === hocVien.id);
      return { studentId: hocVien.id, name: hocVien.name, code: hocVien.code,
        scores: dongDiem ? [...dongDiem.scores] : ['', '', '', ''], note: dongDiem?.note ?? '',
      };
    }),
  };
}

function kiemTraPhienBan(duLieu, quyen, noiDung) {
  const phienBan = duLieu.banNhapTheoQuyen[quyen.id]?.version ?? null;
  if (noiDung.version !== phienBan) baoLoi('Bản nháp đã thay đổi ở cửa sổ khác. Hãy tải lại trước khi lưu.', MA_LOI.PHIEN_BAN_CU);
}

function kiemTraDiem(duLieu, quyen, cacDong, canNhapDu = false) {
  const cacMaHocVien = new Set(duLieu.hocVienTheoLop[quyen.classId].map(hocVien => hocVien.id));
  if (!Array.isArray(cacDong) || cacDong.length !== cacMaHocVien.size) baoLoi('Danh sách điểm cần có đầy đủ học viên của lớp.');
  const daNhap = new Set();
  return cacDong.map(dong => {
    if (!dong || !cacMaHocVien.has(dong.studentId) || daNhap.has(dong.studentId)) baoLoi('Học viên không thuộc lớp hoặc bị trùng.');
    daNhap.add(dong.studentId);
    if (!Array.isArray(dong.scores) || dong.scores.length !== 4) baoLoi('Mỗi học viên cần bốn kỹ năng.');
    const danhSachDiem = dong.scores.map(diem => {
      if (!diemHopLe(diem, !canNhapDu)) baoLoi(canNhapDu
        ? 'Cần nhập đủ bốn kỹ năng từ 0 đến 9, bước 0,5 trước khi gửi duyệt.'
        : 'Điểm phải từ 0 đến 9, theo bước 0,5.');
      return diem === '' || diem === null || diem === undefined ? '' : Number(diem);
    });
    const ghiChu = String(dong.note ?? '').trim();
    if (ghiChu.length > 500) baoLoi('Ghi chú điểm tối đa 500 ký tự.');
    return { studentId: dong.studentId, scores: danhSachDiem, note: ghiChu };
  });
}

function capNhatBanNhap(duLieu, maQuyen, cacDong) {
  duLieu.banNhapTheoQuyen[maQuyen] = { rows: cacDong,
    version: String(Number(duLieu.banNhapTheoQuyen[maQuyen]?.version ?? 0) + 1),
    updatedAt: new Date().toISOString(),
  };
}

const taoMa = tienTo => `${tienTo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const duLieuTroGiang = {
  async layKhongGian() {
    return taoKhongGian(docDuLieu());
  },

  async layLichHoTro(tuNgay, denNgay = tuNgay) {
    const batDau = docNgay(tuNgay);
    const ketThuc = docNgay(denNgay);
    if (ketThuc < batDau || ketThuc - batDau > 62 * 86400000) baoLoi('Khoảng lịch hợp lệ tối đa 62 ngày.');
    const duLieu = docDuLieu();
    return saoChep(duLieu.buoiHoc.filter(buoi => buoi.iso >= tuNgay && buoi.iso <= denNgay)
      .map(buoi => tinhBuoiHoc(duLieu, buoi)));
  },

  async layDanhSachHocVien(maLop) {
    const duLieu = docDuLieu();
    const lop = layLop(duLieu, maLop);
    return saoChep(duLieu.hocVienTheoLop[lop.id]);
  },

  async layDiemDanh(maBuoi) {
    return saoChep(taoDiemDanh(docDuLieu(), maBuoi));
  },

  async luuDiemDanh(maBuoi, noiDung = {}) {
    const duLieu = docDuLieu();
    const diemDanh = taoDiemDanh(duLieu, maBuoi);
    if (!diemDanh.editable) baoLoi('Chỉ có thể điểm danh buổi đã bắt đầu và chưa bị hủy.', MA_LOI.CHUA_THE_DIEM_DANH);
    const cacBanGhi = noiDung.records;
    const cacMaHocVien = new Set(diemDanh.rows.map(dong => dong.studentId));
    if (!Array.isArray(cacBanGhi) || cacBanGhi.length !== cacMaHocVien.size) baoLoi('Cần điểm danh đầy đủ học viên của buổi hỗ trợ.');
    const daNhap = new Set();
    const banGhiHopLe = cacBanGhi.map(banGhi => {
      if (!banGhi || !cacMaHocVien.has(banGhi.studentId) || daNhap.has(banGhi.studentId)) baoLoi('Học viên điểm danh không thuộc lớp hoặc bị trùng.');
      daNhap.add(banGhi.studentId);
      if (!['present', 'late', 'absent'].includes(banGhi.status)) baoLoi('Vui lòng chọn Có mặt, Đi trễ hoặc Vắng cho từng học viên.');
      const ghiChu = String(banGhi.note ?? '').trim();
      if (ghiChu.length > 255) baoLoi('Ghi chú điểm danh tối đa 255 ký tự.');
      return { studentId: banGhi.studentId, status: banGhi.status, note: ghiChu };
    });
    duLieu.diemDanhTheoBuoi[maBuoi] = { records: banGhiHopLe, savedAt: new Date().toISOString() };
    ghiDuLieu(duLieu, true);
    return saoChep(taoDiemDanh(duLieu, maBuoi));
  },

  async guiYeuCau(noiDung = {}) {
    const duLieu = docDuLieu();
    const lop = layLop(duLieu, noiDung.classId);
    const kyDiem = duLieu.periods.find(ky => ky.classId === lop.id && ky.assessmentId === noiDung.assessmentId && ky.status !== 'PUBLISHED');
    if (!kyDiem) baoLoi('Kỳ điểm không thuộc lớp hoặc đã công bố.');
    const batDau = new Date(noiDung.from).getTime();
    const ketThuc = new Date(noiDung.to).getTime();
    if (!Number.isFinite(batDau) || !Number.isFinite(ketThuc) || batDau >= ketThuc || ketThuc <= Date.now()
      || batDau < new Date(kyDiem.opensAt).getTime() || ketThuc > new Date(kyDiem.closesAt).getTime()) {
      baoLoi('Thời gian yêu cầu phải nằm trong kỳ nhập điểm, còn hiệu lực và kết thúc sau lúc bắt đầu.');
    }
    const ghiChu = String(noiDung.note ?? '').trim();
    if (!ghiChu || ghiChu.length > 500) baoLoi('Vui lòng nhập lý do từ 1 đến 500 ký tự.');
    if (duLieu.requests.some(yeuCau => yeuCau.classId === lop.id && yeuCau.assessmentId === kyDiem.assessmentId && yeuCau.status === 'PENDING')) {
      baoLoi('Đã có yêu cầu cho kỳ điểm này đang chờ duyệt.', MA_LOI.YEU_CAU_TRUNG);
    }
    const yeuCau = { id: taoMa('yeucau'), classId: lop.id, className: lop.name,
      assessmentId: kyDiem.assessmentId, title: kyDiem.title, teacher: lop.teacher,
      from: new Date(batDau).toISOString(), to: new Date(ketThuc).toISOString(), note: ghiChu,
      status: 'PENDING', createdAt: new Date().toISOString(), reviewedAt: '', reviewNote: '',
    };
    duLieu.requests.unshift(yeuCau);
    ghiDuLieu(duLieu, true);
    return saoChep(yeuCau);
  },

  async layBanNhap(maQuyen) {
    return saoChep(taoBanNhap(docDuLieu(), maQuyen));
  },

  async luuBanNhap(maQuyen, noiDung = {}) {
    const duLieu = docDuLieu();
    const quyen = layQuyen(duLieu, maQuyen, true);
    kiemTraPhienBan(duLieu, quyen, noiDung);
    const cacDong = kiemTraDiem(duLieu, quyen, noiDung.rows);
    capNhatBanNhap(duLieu, quyen.id, cacDong);
    ghiDuLieu(duLieu, true);
    return saoChep(taoBanNhap(duLieu, quyen.id));
  },

  async guiDuyetDiem(maQuyen, noiDung = {}) {
    const duLieu = docDuLieu();
    const quyen = layQuyen(duLieu, maQuyen, true);
    kiemTraPhienBan(duLieu, quyen, noiDung);
    const cacDong = kiemTraDiem(duLieu, quyen, noiDung.rows, true);
    const lanGui = { id: taoMa('bangdiem'), classId: quyen.classId, className: quyen.className,
      assessmentId: quyen.assessmentId, title: quyen.title, status: 'PENDING',
      createdAt: new Date().toISOString(), reviewedAt: '', reviewNote: '', studentCount: cacDong.length, grantId: quyen.id,
    };
    capNhatBanNhap(duLieu, quyen.id, cacDong);
    duLieu.submissions.unshift(lanGui);
    ghiDuLieu(duLieu, true);
    return { id: lanGui.id, status: lanGui.status };
  },

  async layThongBao() {
    const duLieu = docDuLieu();
    return { items: saoChep(duLieu.thongBao), unread: duLieu.thongBao.filter(thongBao => !thongBao.read).length };
  },

  async danhDauTatCaDaDoc() {
    const duLieu = docDuLieu();
    const soChuaDoc = duLieu.thongBao.filter(thongBao => !thongBao.read).length;
    duLieu.thongBao.forEach(thongBao => { thongBao.read = true; });
    ghiDuLieu(duLieu, true);
    return { updated: soChuaDoc };
  },
};

export async function layBuoiDiemDanh({ maBuoiHoc, maLop, ngay }) {
  const duLieu = docDuLieu();
  const ngayCanXem = maBuoiHoc ? layBuoi(duLieu, maBuoiHoc).iso : ngay;
  docNgay(ngayCanXem);
  const cacBuoiHoc = duLieu.buoiHoc
    .filter(buoi => buoi.iso === ngayCanXem)
    .map(buoi => tinhBuoiHoc(duLieu, buoi));
  const buoiDaChon = maBuoiHoc
    ? cacBuoiHoc.find(buoi => buoi.id === String(maBuoiHoc))
    : cacBuoiHoc.find(buoi => (!maLop || buoi.classId === String(maLop))
      && buoi.permissions.includes('attendance') && buoi.status !== 'cancelled');
  return saoChep({
    cacBuoiHoc,
    buoiDaChon,
    diemDanh: buoiDaChon ? taoDiemDanh(duLieu, buoiDaChon.id) : null,
  });
}

export async function khoiPhucDuLieuMau() {
  const duLieu = taoDuLieuMau();
  ghiDuLieu(duLieu, true);
  return taoKhongGian(duLieu);
}
