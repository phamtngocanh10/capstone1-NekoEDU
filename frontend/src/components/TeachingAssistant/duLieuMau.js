// Dữ liệu minh họa cho giao diện Trợ giảng khi chưa có API.
const DANH_SACH_TEN = {
  'lop-junior-3': [
    'Lê Bảo Nam', 'Đỗ Khánh Linh', 'Trần Gia Hân', 'Nguyễn Anh Khoa', 'Phạm Bảo Châu',
    'Vũ Minh Đức', 'Nguyễn Minh Anh', 'Trần Gia Bảo', 'Đỗ Minh Anh', 'Lê Hoàng Phúc',
    'Hoàng Gia Hân', 'Vũ Ngọc Diệp', 'Bùi Thanh Tùng', 'Phạm Đức Anh', 'Mai Ngọc Nhi',
  ],
  'lop-toeic-650': [
    'Nguyễn Hoàng Long', 'Trần Thu Trang', 'Lê Minh Quân', 'Phạm Ngọc Ánh', 'Võ Đức Huy',
    'Đặng Phương Thảo', 'Bùi Thanh Hà', 'Ngô Quốc Bảo', 'Đỗ Hoài An', 'Hoàng Tuấn Kiệt',
    'Dương Khánh Vy', 'Nguyễn Nhật Minh', 'Trần Bảo Trân', 'Lê Quỳnh Anh', 'Phạm Anh Tuấn',
    'Vũ Ngọc Mai', 'Nguyễn Thành Đạt', 'Đinh Hồng Nhung', 'Đỗ Gia Minh', 'Phan Thùy Dung',
    'Trương Hải Đăng', 'Huỳnh Phương Linh', 'Lý Minh Khang', 'Cao Thanh Tâm', 'Mai Anh Thư',
  ],
  'lop-starters-a': [
    'Nguyễn Bảo An', 'Trần Minh Khang', 'Lê Ngọc Hân', 'Phạm Khánh An', 'Vũ Gia Khánh', 'Đỗ Tuệ Nhi',
    'Bùi Anh Thư', 'Hoàng Hải Nam', 'Ngô Bảo Ngọc', 'Đặng Nhật Anh', 'Võ Minh Châu', 'Mai Gia Bảo',
  ],
};

function layNgayVietNam(thoiDiem) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(thoiDiem);
}

function themNgay(ngay, soNgay) {
  const ketQua = new Date(`${ngay}T12:00:00+07:00`);
  ketQua.setUTCDate(ketQua.getUTCDate() + soNgay);
  return ketQua.toISOString().slice(0, 10);
}

function thoiDiemTrongNgay(ngay, gio = '00:00:00') {
  return `${ngay}T${gio}+07:00`;
}

function taoHocVien(lop, namHienTai) {
  return DANH_SACH_TEN[lop.id].map((ten, chiSo) => ({
    id: `hv-${lop.maNhom}-${String(chiSo + 1).padStart(3, '0')}`,
    code: `${lop.maHocVien}${String(chiSo + 1).padStart(3, '0')}`,
    name: ten,
    birth: `${String(chiSo % 27 + 1).padStart(2, '0')}/${String(chiSo % 12 + 1).padStart(2, '0')}/${namHienTai - lop.tuoi}`,
    phone: `090${String(1000000 + lop.soDauDienThoai + chiSo)}`,
    rate: chiSo % 5 === 0 ? 88 : chiSo % 3 === 0 ? 94 : 100,
  }));
}

function taoCacDongDiem(danhSachHocVien, nhapDu = false) {
  const diemMau = [
    [7.5, 6.5, 6, 6.5], [6, 6.5, 5.5, 6], [7, 7.5, 6.5, 7],
    [6.5, 6, 6, 6.5], [7.5, 7, 7, 7.5],
  ];
  return danhSachHocVien.map((hocVien, chiSo) => ({
    studentId: hocVien.id,
    scores: nhapDu || chiSo < 5 ? [...diemMau[chiSo % diemMau.length]] : chiSo === 5 ? [6.5, 7.5, '', ''] : ['', '', '', ''],
    note: '',
  }));
}

export function taoDuLieuMau(ngayThamChieu = new Date()) {
  const homNay = layNgayVietNam(ngayThamChieu);
  const thuHienTai = new Date(`${homNay}T12:00:00+07:00`).getUTCDay();
  const dauTuan = themNgay(homNay, -((thuHienTai + 6) % 7));
  const mocThoiGian = soPhut => new Date(ngayThamChieu.getTime() + soPhut * 60000).toISOString();
  const moKyLuc = thoiDiemTrongNgay(dauTuan);
  const dongKyLuc = thoiDiemTrongNgay(themNgay(dauTuan, 13), '23:59:59');
  const cacLop = [
    { id: 'lop-junior-3', name: 'Giao tiếp Junior 3', code: 'JUNIOR-03', course: 'Giao tiếp Junior', courseId: 'junior', teacher: 'Cô Phạm Thu Hà', lecturerId: 'gv-thuha', room: 'P.105', size: 15, cap: 18, days: [0, 2, 4], time: '09:00-10:30', maNhom: 'junior', maHocVien: 'JR', tuoi: 12, soDauDienThoai: 0 },
    { id: 'lop-toeic-650', name: 'TOEIC 650+', code: 'TOEIC-650', course: 'Luyện thi TOEIC', courseId: 'toeic', teacher: 'Thầy Lê Anh Dũng', lecturerId: 'gv-anhdung', room: 'P.301', size: 25, cap: 28, days: [0, 3], time: '14:00-15:30', maNhom: 'toeic', maHocVien: 'TC', tuoi: 21, soDauDienThoai: 100 },
    { id: 'lop-starters-a', name: 'Starters Kids A', code: 'STARTERS-A', course: 'Cambridge Starters', courseId: 'starters', teacher: 'Cô Phạm Thu Hà', lecturerId: 'gv-thuha', room: 'P.108', size: 12, cap: 15, days: [0, 1, 4], time: '16:00-17:15', maNhom: 'starters', maHocVien: 'ST', tuoi: 8, soDauDienThoai: 200 },
  ];
  const hocVienTheoLop = Object.fromEntries(cacLop.map(lop => [lop.id, taoHocVien(lop, Number(homNay.slice(0, 4)))]));
  const danhSachLop = cacLop.map(({ maNhom, maHocVien, tuoi, soDauDienThoai, ...lop }) => ({
    ...lop, start: themNgay(dauTuan, -56), end: themNgay(dauTuan, 56), status: 'open',
    permissions: ['attendance', 'roster'], assignmentId: `phancong-${lop.id}`,
  }));
  const cacKyDiem = danhSachLop.map(lop => ({
    id: `ky-${lop.id}`, classId: lop.id, assessmentId: `bai-${lop.id}-giuaky`,
    title: 'Kiểm tra giữa kỳ', term: `Giữa kỳ T${Number(homNay.slice(5, 7))}`,
    teacher: lop.teacher, opensAt: moKyLuc, closesAt: dongKyLuc, status: 'DRAFT',
  }));
  const cacQuyenNhap = [
    { id: 'quyen-junior-mo', classId: 'lop-junior-3', className: 'Giao tiếp Junior 3', assessmentId: 'bai-lop-junior-3-giuaky', title: 'Kiểm tra giữa kỳ', teacher: 'Cô Phạm Thu Hà', opensAt: moKyLuc, closesAt: dongKyLuc, state: 'open', pending: false, submissionId: null },
    { id: 'quyen-toeic-het-han', classId: 'lop-toeic-650', className: 'TOEIC 650+', assessmentId: 'bai-toeic-da-ket-thuc', title: 'Kiểm tra đầu vào', teacher: 'Thầy Lê Anh Dũng', opensAt: thoiDiemTrongNgay(themNgay(homNay, -7)), closesAt: thoiDiemTrongNgay(themNgay(homNay, -1), '23:59:59'), state: 'expired', pending: false, submissionId: null },
    { id: 'quyen-starters-sap-mo', classId: 'lop-starters-a', className: 'Starters Kids A', assessmentId: 'bai-lop-starters-a-giuaky', title: 'Kiểm tra giữa kỳ', teacher: 'Cô Phạm Thu Hà', opensAt: thoiDiemTrongNgay(themNgay(homNay, 1), '08:00:00'), closesAt: dongKyLuc, state: 'scheduled', pending: false, submissionId: null },
    { id: 'quyen-junior-cu', classId: 'lop-junior-3', className: 'Giao tiếp Junior 3', assessmentId: 'bai-junior-thang-truoc', title: 'Kiểm tra tháng trước', teacher: 'Cô Phạm Thu Hà', opensAt: thoiDiemTrongNgay(themNgay(homNay, -14)), closesAt: thoiDiemTrongNgay(themNgay(homNay, -7), '23:59:59'), state: 'expired', pending: false, submissionId: null },
  ];

  const buoiHoc = [];
  const diemDanhTheoBuoi = {};
  for (let doLech = -7; doLech <= 13; doLech += 1) {
    const ngay = themNgay(dauTuan, doLech);
    const thu = ((doLech % 7) + 7) % 7;
    for (const lop of danhSachLop) {
      // Có ba buổi hỗ trợ hôm nay, hôm qua và ngày mai để dễ thử các màn hình.
      if (!lop.days.includes(thu) && ![-1, 0, 1].some(khoangCach => ngay === themNgay(homNay, khoangCach))) continue;
      const [gioBatDau, gioKetThuc] = lop.time.split('-');
      const maBuoi = `buoi-${lop.id}-${ngay}`;
      buoiHoc.push({
        id: maBuoi, classId: lop.id, name: lop.name, code: lop.code, iso: ngay,
        time: lop.time, startTime: gioBatDau, endTime: gioKetThuc,
        room: lop.room, teacher: lop.teacher, students: lop.size, sessionStatus: 'SCHEDULED',
        permissions: [...lop.permissions],
      });
      const daQuaBuoiHoc = new Date(thoiDiemTrongNgay(ngay, `${gioKetThuc}:00`)) < ngayThamChieu;
      if (ngay < homNay || ngay === homNay && lop.id === 'lop-junior-3' && daQuaBuoiHoc) {
        diemDanhTheoBuoi[maBuoi] = {
          records: hocVienTheoLop[lop.id].map((hocVien, chiSo) => ({
            studentId: hocVien.id, status: chiSo !== 0 && chiSo % 13 === 0 ? 'absent' : chiSo % 7 === 0 ? 'late' : 'present',
            note: chiSo % 7 === 0 ? 'Đến trễ 5 phút' : '',
          })),
          savedAt: thoiDiemTrongNgay(ngay, `${gioKetThuc}:00`),
        };
      }
    }
  }
  buoiHoc.sort((trai, phai) => `${trai.iso} ${trai.startTime}`.localeCompare(`${phai.iso} ${phai.startTime}`));

  const banNhapTheoQuyen = Object.fromEntries(cacQuyenNhap.map(quyen => [quyen.id, {
    rows: taoCacDongDiem(hocVienTheoLop[quyen.classId], quyen.id === 'quyen-junior-cu'),
    version: '1', updatedAt: mocThoiGian(-3),
  }]));
  const cacYeuCau = [
    { id: 'yeucau-junior-da-duyet', classId: 'lop-junior-3', className: 'Giao tiếp Junior 3', assessmentId: 'bai-lop-junior-3-giuaky', title: 'Kiểm tra giữa kỳ', from: moKyLuc, to: dongKyLuc, note: 'Em hỗ trợ nhập điểm bốn kỹ năng cho lớp.', status: 'APPROVED', createdAt: mocThoiGian(-2880), reviewedAt: mocThoiGian(-2820), reviewNote: 'Đã mở quyền nhập điểm. Em kiểm tra đủ bốn kỹ năng nhé.', teacher: 'Cô Phạm Thu Hà' },
    { id: 'yeucau-toeic-cho-duyet', classId: 'lop-toeic-650', className: 'TOEIC 650+', assessmentId: 'bai-lop-toeic-650-giuaky', title: 'Kiểm tra giữa kỳ', from: thoiDiemTrongNgay(themNgay(homNay, 1), '08:00:00'), to: thoiDiemTrongNgay(themNgay(homNay, 2), '18:00:00'), note: 'Em hỗ trợ tổng hợp điểm bài kiểm tra giữa kỳ.', status: 'PENDING', createdAt: mocThoiGian(-120), reviewedAt: '', reviewNote: '', teacher: 'Thầy Lê Anh Dũng' },
    { id: 'yeucau-starters-tu-choi', classId: 'lop-starters-a', className: 'Starters Kids A', assessmentId: 'bai-starters-cu', title: 'Kiểm tra tuần trước', from: thoiDiemTrongNgay(themNgay(homNay, -3), '08:00:00'), to: thoiDiemTrongNgay(themNgay(homNay, -2), '18:00:00'), note: 'Em xin hỗ trợ nhập điểm cho lớp.', status: 'REJECTED', createdAt: mocThoiGian(-5760), reviewedAt: mocThoiGian(-5700), reviewNote: 'Bảng điểm này cô đã hoàn thành. Em hỗ trợ kỳ tiếp theo nhé.', teacher: 'Cô Phạm Thu Hà' },
  ];
  const cacLanGuiDiem = [
    { id: 'bangdiem-junior-tra-lai', classId: 'lop-junior-3', className: 'Giao tiếp Junior 3', assessmentId: 'bai-lop-junior-3-giuaky', title: 'Kiểm tra giữa kỳ', status: 'RETURNED', createdAt: mocThoiGian(-1440), reviewedAt: mocThoiGian(-1380), reviewNote: 'Em kiểm tra lại điểm phần Viết và hoàn thiện các học viên còn thiếu.', studentCount: 15, grantId: 'quyen-junior-mo' },
    { id: 'bangdiem-junior-da-duyet', classId: 'lop-junior-3', className: 'Giao tiếp Junior 3', assessmentId: 'bai-junior-thang-truoc', title: 'Kiểm tra tháng trước', status: 'APPROVED', createdAt: mocThoiGian(-11520), reviewedAt: mocThoiGian(-11400), reviewNote: 'Đã kiểm tra và phê duyệt bảng điểm.', studentCount: 15, grantId: 'quyen-junior-cu' },
  ];

  return {
    phienBan: 1,
    ngayKhoiTao: homNay,
    staffId: 'tg-thaovy',
    classes: danhSachLop, periods: cacKyDiem, grants: cacQuyenNhap, requests: cacYeuCau, submissions: cacLanGuiDiem,
    hocVienTheoLop, buoiHoc, diemDanhTheoBuoi, banNhapTheoQuyen,
    thongBao: [
      { id: 'thongbao-mo-quyen', title: 'Giảng viên đã mở quyền nhập điểm', text: 'Cô Phạm Thu Hà đã mở quyền nhập điểm lớp Giao tiếp Junior 3 cho Thảo Vy.', read: false, time: mocThoiGian(-30), announcementId: null, type: 'GRADING' },
      { id: 'thongbao-chinh-sua', title: 'Bảng điểm cần chỉnh sửa', text: 'Kiểm tra phản hồi của giảng viên trước khi gửi lại bảng điểm giữa kỳ.', read: false, time: mocThoiGian(-1380), announcementId: null, type: 'GRADING' },
      { id: 'thongbao-lich', title: 'Lịch hỗ trợ trong tuần', text: 'Lịch hỗ trợ của bạn đã được cập nhật. Vui lòng kiểm tra phòng học trước mỗi buổi.', read: true, time: mocThoiGian(-2880), announcementId: null, type: 'SCHEDULE' },
    ],
  };
}
