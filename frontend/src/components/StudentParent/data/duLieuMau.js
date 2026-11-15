import { addDays, startOfWeek, todayISO } from '../components/shared/tienIch.js';

const curriculum = [
  { donVi: 'Unit 1–3', ten: 'Grammar nền tảng & Listening cơ bản', trangThai: 'hoanThanh' },
  { donVi: 'Unit 4–6', ten: 'Reading skills & Vocabulary theo chủ đề', trangThai: 'hoanThanh' },
  { donVi: 'Unit 7–9', ten: 'Speaking Part 1–2 & Writing Task 1', trangThai: 'dangHoc' },
  { donVi: 'Unit 10–12', ten: 'Ôn tập & Kiểm tra cuối kỳ', trangThai: 'sapToi' },
];

export function createDemoData() {
  const today = todayISO();
  const weekStart = startOfWeek(today);
  const currentMonth = today.slice(0, 7);
  const timestampInDays = (dayCount, time = '08:30') =>
    `${addDays(today, dayCount)}T${time}:00+07:00`;
  const courses = [
    {
      ma: 'ielts-foundation-2',
      ten: 'IELTS Foundation 2',
      moTa: 'Xây nền tảng vững chắc, tự tin chinh phục IELTS 5.5–6.5.',
      giangVien: 'Thầy Trần Minh Khôi',
      phong: 'P.203',
      thuHoc: [1, 3, 5],
      gioBatDau: '18:00',
      gioKetThuc: '19:30',
      hocPhi: 2400000,
      soBuoi: 48,
      tuanHienTai: 6,
      tongSoTuan: 16,
      siSo: 18,
      sucChua: 20,
      ngayKhaiGiang: addDays(weekStart, -35),
      nhom: 'IELTS',
      mucTieu: 'IELTS 5.5–6.5',
      chuongTrinh: curriculum,
    },
    {
      ma: 'ielts-advanced',
      ten: 'IELTS Advanced',
      moTa: 'Nâng cao 6.5+ → 7.5+ · 16 buổi',
      giangVien: 'Cô Lê Thu Hà',
      phong: 'P.301',
      thuHoc: [2, 4],
      gioBatDau: '19:30',
      gioKetThuc: '21:00',
      hocPhi: 2800000,
      soBuoi: 16,
      tuanHienTai: 0,
      tongSoTuan: 8,
      siSo: 12,
      sucChua: 18,
      ngayKhaiGiang: addDays(weekStart, 15),
      nhom: 'IELTS',
      mucTieu: 'IELTS 7.5+',
      chuongTrinh: curriculum.map((item) => ({ ...item, trangThai: 'sapToi' })),
    },
    {
      ma: 'junior-3',
      ten: 'Giao tiếp Junior 3',
      moTa: 'Phản xạ giao tiếp cho lứa tuổi 10–13.',
      giangVien: 'Cô Phạm Thu Hà',
      phong: 'P.105',
      thuHoc: [2, 4, 6],
      gioBatDau: '17:00',
      gioKetThuc: '18:30',
      hocPhi: 2000000,
      soBuoi: 36,
      tuanHienTai: 4,
      tongSoTuan: 12,
      siSo: 15,
      sucChua: 20,
      ngayKhaiGiang: addDays(weekStart, -20),
      nhom: 'Giao tiếp',
      mucTieu: 'Tự tin giao tiếp mỗi ngày',
      chuongTrinh: curriculum,
    },
    {
      ma: 'speaking-club',
      ten: 'Speaking Club',
      moTa: 'Câu lạc bộ luyện nói cuối tuần, kết nối và tự tin thể hiện.',
      giangVien: 'Thầy David Nguyễn',
      phong: 'P.105',
      thuHoc: [6],
      gioBatDau: '19:30',
      gioKetThuc: '21:00',
      hocPhi: 800000,
      soBuoi: 8,
      tuanHienTai: 0,
      tongSoTuan: 8,
      siSo: 10,
      sucChua: 24,
      ngayKhaiGiang: addDays(weekStart, 12),
      nhom: 'Giao tiếp',
      mucTieu: 'Phản xạ và phát âm tự nhiên',
      chuongTrinh: curriculum.map((item) => ({ ...item, trangThai: 'sapToi' })),
    },
  ];
  const enrollments = [
    {
      ma: 'gd-minhanh',
      maHocVien: 'hv-minh-anh',
      maKhoa: 'ielts-foundation-2',
      trangThai: 'dangHoc',
      ngayDangKy: addDays(weekStart, -40),
      phuongThuc: 'chuyenKhoan',
    },
    {
      ma: 'gd-minhkhang',
      maHocVien: 'hv-minh-khang',
      maKhoa: 'junior-3',
      trangThai: 'dangHoc',
      ngayDangKy: addDays(weekStart, -25),
      phuongThuc: 'tienMat',
    },
  ];
  const schedule = enrollments.flatMap((enrollment) => {
    const course = courses.find((course) => course.ma === enrollment.maKhoa);
    return [-1, 0, 1, 2].flatMap((weekOffset) =>
      course.thuHoc.map((weekday, index) => {
        const date = addDays(weekStart, weekOffset * 7 + weekday - 1);
        return {
          ma: `buoi-${enrollment.maHocVien}-${date}`,
          maHocVien: enrollment.maHocVien,
          maKhoa: course.ma,
          ngay: date,
          batDau: course.gioBatDau,
          ketThuc: course.gioKetThuc,
          phong: course.phong,
          giangVien: course.giangVien,
          noiDung: ['Listening & Vocabulary', 'Reading & Grammar', 'Speaking Practice'][index],
          trangThai:
            new Date(`${date}T${course.gioKetThuc}:00+07:00`) < new Date() ? 'daHoc' : 'sapHoc',
        };
      })
    );
  });
  const attendance = enrollments.flatMap((enrollment) =>
    Array.from({ length: 12 }, (_, index) => ({
      ma: `dd-${enrollment.maHocVien}-${index}`,
      maHocVien: enrollment.maHocVien,
      maKhoa: enrollment.maKhoa,
      ngay: addDays(today, -(12 - index)),
      trangThai: index === 3 ? 'vangCoPhep' : index === 7 ? 'diTre' : 'coMat',
    }))
  );
  const materials = [
    {
      ma: 'tl-speaking',
      maKhoa: 'ielts-foundation-2',
      ten: 'Giáo trình Unit 5 - Speaking.pdf',
      loai: 'PDF',
      dungLuong: 'Tài liệu mẫu',
      ngayDang: addDays(today, -2),
      noiDung:
        'UNIT 5 — SPEAKING: MY DAILY LIFE\nMục tiêu: trả lời câu hỏi Part 1 bằng câu hoàn chỉnh.\n1. Tell me about your daily routine.\n2. What do you enjoy doing after school?\n3. Describe your favourite place in your hometown.\nPractice: ghi âm phần trả lời trong 60 giây, nghe lại và sửa phát âm.',
    },
    {
      ma: 'tl-listening',
      maKhoa: 'ielts-foundation-2',
      ten: 'Bài tập Listening Practice 3.pdf',
      loai: 'PDF',
      dungLuong: 'Tài liệu mẫu',
      ngayDang: addDays(today, -4),
      noiDung:
        'LISTENING PRACTICE 3\nNghe đoạn audio trong thư viện và hoàn thành câu trả lời.\n1. Where does the speaker live?\n2. What does the speaker do every morning?\n3. Which activity helps the speaker practise English?\nLuyện tập hai lần: lần đầu hiểu ý chính, lần sau ghi từ khóa.',
    },
    {
      ma: 'tl-flashcard',
      maKhoa: 'ielts-foundation-2',
      ten: 'Flashcard từ vựng Unit 6.pdf',
      loai: 'PDF',
      dungLuong: 'Tài liệu mẫu',
      ngayDang: addDays(today, -7),
      noiDung:
        'UNIT 6 — VOCABULARY\nConfident: tự tin. Example: I feel confident when speaking English.\nImprove: cải thiện. Example: I practise every day to improve my pronunciation.\nRoutine: thói quen. Example: Reading is part of my daily routine.\nEnvironment: môi trường. Example: We should protect the environment.',
    },
    {
      ma: 'tl-audio',
      maKhoa: 'ielts-foundation-2',
      ten: 'Audio Practice - Part 2.mp3',
      loai: 'MP3',
      dungLuong: 'Audio mẫu · 30 giây',
      ngayDang: addDays(today, -9),
      duongDan: '/student-parent/audio-practice.mp3',
      noiDung:
        'Nghe bài đọc tiếng Anh mẫu về thói quen học tập, sau đó ghi lại ba hoạt động được nhắc tới.',
    },
    {
      ma: 'tl-ontap',
      maKhoa: 'ielts-foundation-2',
      ten: 'Lịch ôn tập giữa kỳ.docx',
      loai: 'DOCX',
      dungLuong: 'Tài liệu mẫu',
      ngayDang: addDays(today, -12),
      noiDung:
        'LỊCH ÔN TẬP GIỮA KỲ\nThứ Hai: Listening — luyện nghe ý chính và từ khóa.\nThứ Tư: Reading — đọc lướt, tìm thông tin chi tiết.\nThứ Sáu: Speaking — trả lời Part 1, luyện phát âm.\nCuối tuần: Writing Task 1 — hoàn thiện bố cục và ví dụ.',
    },
    {
      ma: 'tl-ketqua',
      maKhoa: 'ielts-foundation-2',
      ten: 'Bài làm đã chấm giữa kỳ.pdf',
      loai: 'PDF',
      dungLuong: 'Tài liệu mẫu',
      ngayDang: addDays(today, -1),
      noiDung:
        'PHIẾU NHẬN XÉT BÀI KIỂM TRA GIỮA KỲ\nHọc viên: Nguyễn Minh Anh\nListening: 9.0/10\nReading: 8.5/10\nSpeaking: 8.0/10\nWriting: 8.5/10\nTiến bộ tốt ở kỹ năng Speaking. Cần luyện thêm phát âm và bổ sung ví dụ cho Writing.',
    },
    {
      ma: 'tl-junior',
      maKhoa: 'junior-3',
      ten: 'Junior 3 - My family.pdf',
      loai: 'PDF',
      dungLuong: 'Tài liệu mẫu',
      ngayDang: addDays(today, -3),
      noiDung:
        'MY FAMILY\nLearn the words: mother, father, sister, brother, grandparents.\nDraw your family tree and introduce three family members.\nExample: This is my mother. She is kind and helpful.',
    },
  ];
  const results = enrollments.flatMap((enrollment) =>
    [
      {
        ma: `kq-${enrollment.maHocVien}-giua-ky`,
        tieuDe: 'Bài kiểm tra giữa kỳ',
        ngay: addDays(today, -1),
        diemTong: 8.5,
        nhanXet:
          'Tiến bộ tốt ở kỹ năng Speaking, cần luyện thêm phát âm. Bài Writing có bố cục rõ ràng, nên bổ sung ví dụ minh họa cụ thể để tăng tính thuyết phục.',
        maTaiLieu: enrollment.maHocVien === 'hv-minh-anh' ? 'tl-ketqua' : 'tl-junior',
      },
      {
        ma: `kq-${enrollment.maHocVien}-writing`,
        tieuDe: 'Bài luyện Writing Task 2',
        ngay: addDays(today, -9),
        diemTong: 7.0,
        nhanXet: 'Bố cục rõ ràng, cần thêm ví dụ minh họa cụ thể.',
        maTaiLieu: 'tl-ontap',
      },
      {
        ma: `kq-${enrollment.maHocVien}-dau-vao`,
        tieuDe: 'Kiểm tra đầu vào',
        ngay: addDays(today, -24),
        diemTong: 6.5,
        nhanXet: 'Nền tảng ngữ pháp tốt, vốn từ vựng cần mở rộng thêm.',
        maTaiLieu: 'tl-flashcard',
      },
    ].map((result) => ({
      ...result,
      maTaiLieu: enrollment.maHocVien === 'hv-minh-khang' ? 'tl-junior' : result.maTaiLieu,
      maHocVien: enrollment.maHocVien,
      maKhoa: enrollment.maKhoa,
      hang: 3,
      siSo: enrollment.maHocVien === 'hv-minh-khang' ? 15 : 18,
      kyNang: ['Listening', 'Reading', 'Speaking', 'Writing'].map((name, index) => ({
        ten: name,
        diem: Math.min(10, result.diemTong + [0.5, 0, -0.5, 0][index]),
        trungBinhLop: [7.1, 6.8, 6.5, 6.6][index],
      })),
      goiY: [
        'Speaking: luyện phát âm theo bộ âm /θ/ – /ð/.',
        'Writing: thêm ví dụ cụ thể vào mỗi đoạn thân bài.',
        'Duy trì phong độ Listening & Reading.',
      ],
    }))
  );
  const invoices = enrollments.flatMap((enrollment) => {
    const course = courses.find((course) => course.ma === enrollment.maKhoa);
    return Array.from({ length: enrollment.maHocVien === 'hv-minh-anh' ? 9 : 4 }, (_, index) => {
      const dateValue = new Date(`${currentMonth}-15T12:00:00+07:00`);
      dateValue.setUTCMonth(dateValue.getUTCMonth() - index);
      const period = dateValue.toISOString().slice(0, 7);
      const isPaid = index > 0;
      const amount = enrollment.maHocVien === 'hv-minh-anh' && index >= 5 ? 2200000 : course.hocPhi;
      return {
        ma: `hd-${enrollment.maHocVien}-${period}`,
        maHocVien: enrollment.maHocVien,
        maKhoa: course.ma,
        tieuDe: `Học phí tháng ${Number(period.slice(5))}/${period.slice(0, 4)}`,
        kyHocPhi: period,
        soTien: amount,
        soTienGoc: amount,
        hanThanhToan: isPaid ? `${period}-20` : addDays(today, 6),
        trangThai: isPaid ? 'daThanhToan' : 'chuaThanhToan',
        ngayThanhToan: isPaid ? `${period}-18` : '',
        phuongThuc: isPaid ? ['chuyenKhoan', 'viDienTu', 'tienMat'][index % 3] : '',
        maGiaoDich: isPaid ? `NEKO-MAU-${period}-${enrollment.maHocVien.slice(-3)}` : '',
      };
    });
  });
  const createAttachment = (id, name, content) => ({
    ma: id,
    ten: name,
    loai: 'PDF',
    dungLuong: 'Tài liệu mẫu',
    noiDung: content,
  });
  const notifications = [
    {
      ma: 'tb-hoc-phi',
      tieuDe: `Nhắc nhở: học phí tháng ${Number(today.slice(5, 7))} sắp đến hạn`,
      loai: 'hocPhi',
      quanTrong: true,
      daDoc: false,
      tomTat:
        'Học phí kỳ này đang chờ thanh toán. Vui lòng kiểm tra thời hạn trong mục Học phí & Hóa đơn.',
      noiDung:
        'Kính gửi Quý phụ huynh,\nNEKO EDU xin nhắc lịch đóng học phí kỳ hiện tại. Phụ huynh vui lòng xem hóa đơn, thời hạn và thông tin lớp học tại mục Học phí & Hóa đơn.\nNếu cần hỗ trợ về kỳ học hoặc các ưu đãi, vui lòng gửi phản hồi đến trung tâm.\nTrân trọng,\nBộ phận Chăm sóc học viên NEKO EDU.',
      ngayGui: timestampInDays(0, '07:30'),
      nguoiGui: 'Phòng Kế toán',
      doiTuong: 'Phụ huynh và học viên',
      maHocVien: null,
      tepDinhKem: [
        createAttachment(
          'tep-hocphi',
          'Huong-dan-hoc-phi.pdf',
          'HƯỚNG DẪN HỌC PHÍ MẪU\nMở mục Học phí & Hóa đơn, chọn kỳ học và xem chi tiết.\nCác thao tác thanh toán trong giao diện này chỉ là mô phỏng, không thực hiện giao dịch thật.'
        ),
      ],
    },
    {
      ma: 'tb-ket-qua',
      tieuDe: 'Bảng điểm giữa kỳ của Minh Anh đã được cập nhật',
      loai: 'ketQua',
      quanTrong: false,
      daDoc: false,
      tomTat: 'Điểm trung bình 8.5/10 — xem chi tiết trong mục Điểm danh & Kết quả.',
      noiDung:
        'Kính gửi chị Mai,\nBảng điểm giữa kỳ của Nguyễn Minh Anh đã được công bố. Minh Anh tiến bộ tốt ở Speaking và duy trì kết quả Listening ổn định.\nChị và Minh Anh có thể xem nhận xét chi tiết, điểm từng kỹ năng và gợi ý luyện tập trong mục Điểm danh & Kết quả.\nTrân trọng,\nThầy Trần Minh Khôi.',
      ngayGui: timestampInDays(-1, '16:30'),
      nguoiGui: 'Thầy Trần Minh Khôi',
      doiTuong: 'Lớp IELTS Foundation 2',
      maHocVien: 'hv-minh-anh',
      tepDinhKem: [],
    },
    {
      ma: 'tb-hoc-bu',
      tieuDe: 'Thông báo lịch nghỉ và buổi học bù',
      loai: 'lichHoc',
      quanTrong: true,
      daDoc: true,
      tomTat: 'Một số lớp có lịch sinh hoạt chung. Vui lòng theo dõi lịch học của từng học viên.',
      noiDung:
        'Kính gửi Quý phụ huynh và các bạn học viên,\nTrung tâm tổ chức hoạt động ngoại khóa vào cuối tuần. Lịch học bù được thông báo theo từng lớp; học viên vui lòng kiểm tra thời gian và phòng học trước khi đến trung tâm.\nNếu không thể tham gia, vui lòng liên hệ Phòng Đào tạo để được hỗ trợ.\nTrân trọng,\nNEKO EDU.',
      ngayGui: timestampInDays(-7),
      nguoiGui: 'Phòng Đào tạo',
      doiTuong: 'Toàn trung tâm',
      maHocVien: null,
      tepDinhKem: [
        createAttachment(
          'tep-hocbu',
          'Lich-hoc-bu.pdf',
          'LỊCH HỌC BÙ MẪU\nTheo dõi lịch cá nhân ở mục Lịch học. Mọi thông tin trong tài liệu là dữ liệu minh họa.'
        ),
      ],
    },
    {
      ma: 'tb-lich-thi',
      tieuDe: 'Lịch thi giữa kỳ IELTS Foundation 2',
      loai: 'lichHoc',
      quanTrong: true,
      daDoc: true,
      tomTat: 'Buổi thi giữa kỳ diễn ra theo khung giờ học thường lệ tại phòng P.203.',
      noiDung: `Kính gửi Quý phụ huynh và các bạn học viên lớp IELTS Foundation 2,\nNEKO EDU thông báo lịch thi giữa kỳ của lớp như sau:\n• Thời gian: ${addDays(weekStart, 7)}, theo khung giờ học thường lệ của lớp.\n• Địa điểm: Phòng P.203 (tầng 2). Học viên có mặt trước giờ thi 15 phút.\n• Nội dung: Listening, Reading và Writing Task 1.\n• Mang theo: thẻ học viên, bút chì 2B, bút bi xanh hoặc đen.\nHọc viên vắng mặt có lý do vui lòng liên hệ trung tâm hoặc giảng viên trước ngày thi ít nhất một ngày để sắp xếp lịch thi bù.\nTrân trọng,\nPhòng Đào tạo NEKO EDU.`,
      ngayGui: timestampInDays(-5),
      nguoiGui: 'Phòng Đào tạo',
      doiTuong: 'Lớp IELTS Foundation 2',
      maHocVien: 'hv-minh-anh',
      tepDinhKem: [
        createAttachment(
          'tep-lichthi',
          'Lich-thi-giua-ky-IELTS-F2.pdf',
          'LỊCH THI GIỮA KỲ\nLớp IELTS Foundation 2 — Phòng P.203.\nHọc viên có mặt trước giờ thi 15 phút.\nNội dung: Listening, Reading và Writing Task 1.'
        ),
        createAttachment(
          'tep-sodo',
          'So-do-phong-thi-P203.pdf',
          'SƠ ĐỒ PHÒNG HỌC MẪU\nTầng 1: Quầy lễ tân, phòng P.101–P.105.\nTầng 2: Phòng P.201–P.205. Phòng thi P.203 nằm bên phải cầu thang.'
        ),
      ],
    },
    {
      ma: 'tb-khai-giang',
      tieuDe: 'Khai giảng lớp IELTS Advanced khóa mới',
      loai: 'chung',
      quanTrong: false,
      daDoc: true,
      tomTat:
        'Nhận ưu đãi 5% khi đăng ký sớm. Khám phá chương trình mới trong mục Khóa học của tôi.',
      noiDung:
        'Khóa IELTS Advanced dành cho học viên hướng tới mục tiêu IELTS 7.5+. Chương trình tập trung chiến thuật làm bài và thực hành phản hồi theo từng kỹ năng.\nXem nội dung, lịch dự kiến và gửi yêu cầu đăng ký tại mục Khóa học của tôi.\nƯu đãi và đăng ký hiển thị trong bản frontend này chỉ là dữ liệu mẫu.',
      ngayGui: timestampInDays(-12),
      nguoiGui: 'NEKO EDU',
      doiTuong: 'Toàn trung tâm',
      maHocVien: null,
      tepDinhKem: [
        createAttachment(
          'tep-khaigiang',
          'Gioi-thieu-IELTS-Advanced.pdf',
          'IELTS ADVANCED\nMục tiêu 7.5+. 16 buổi học.\nTăng cường chiến thuật nghe, đọc, viết và luyện nói theo chủ đề.'
        ),
      ],
    },
  ];
  return {
    phienBan: 1,
    maHocVien: 'hv-minh-anh',
    taiKhoan: {
      ma: 'ph-mai',
      ten: 'Nguyễn Thị Mai',
      email: 'mai.nguyen@example.com',
      dienThoai: '0905123456',
      diaChi: 'Hải Châu, Đà Nẵng',
      anhDaiDien: '',
    },
    hocVien: [
      {
        ma: 'hv-minh-anh',
        ten: 'Nguyễn Minh Anh',
        maSo: 'HV20260142',
        ngaySinh: '2011-05-18',
        gioiTinh: 'Nữ',
      },
      {
        ma: 'hv-minh-khang',
        ten: 'Nguyễn Minh Khang',
        maSo: 'HV20260143',
        ngaySinh: '2014-08-12',
        gioiTinh: 'Nam',
      },
    ],
    khoaHoc: courses,
    ghiDanh: enrollments,
    lichHoc: schedule,
    taiLieu: materials,
    diemDanh: attendance,
    ketQua: results,
    hoaDon: invoices,
    thongBao: notifications,
    phanHoiThongBao: [],
    danhGia: [
      {
        ma: 'dg-cu-1',
        maHocVien: 'hv-minh-anh',
        maKhoa: 'ielts-foundation-2',
        chatLuongGiangDay: 5,
        coSoVatChat: 4,
        hoTroTrungTam: 5,
        nhanXet: 'Giảng viên nhiệt tình, con tiến bộ rõ rệt qua từng buổi học.',
        ngayGui: timestampInDays(-35),
      },
      {
        ma: 'dg-cu-2',
        maHocVien: 'hv-minh-anh',
        maKhoa: 'speaking-club',
        chatLuongGiangDay: 4,
        coSoVatChat: 5,
        hoTroTrungTam: 4,
        nhanXet: 'Không khí lớp học vui vẻ, nên tăng thêm buổi luyện nói trong tuần.',
        ngayGui: timestampInDays(-20),
      },
    ],
  };
}
