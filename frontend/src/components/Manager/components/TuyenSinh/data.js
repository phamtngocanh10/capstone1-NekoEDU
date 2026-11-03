// Dữ liệu mẫu theo Figma (17.0–17.5) — thay bằng src/api/admissions.js khi có backend.
export const TABS = [
  { value: '', label: 'Tổng quan', title: 'Tuyển sinh' },
  { value: 'khoa', label: 'Khóa tiếp theo', title: 'Dự báo khóa tiếp theo' },
  { value: 'thang', label: 'Tháng tiếp theo', title: 'Dự báo tháng tiếp theo' },
  { value: 'nam', label: 'Năm tiếp theo', title: 'Dự báo năm tiếp theo' },
  { value: 'tai-dang-ky', label: 'Tái đăng ký', title: 'Tỉ lệ tái đăng ký' },
  { value: 'nghi-hoc', label: 'Nghỉ học', title: 'Tỉ lệ nghỉ học' },
]
export const SUBTITLE = 'Dự báo và đề xuất từ AI dựa trên dữ liệu thị trường và dữ liệu trung tâm'

export const G = 'var(--success-fill)', A = 'var(--warning-fill)', R = 'var(--danger)', B = 'var(--primary)', D = '#1a6fc9'
export const REENROLL = [
  { label: 'KINDY', value: 74, color: G }, { label: 'KID', value: 65, color: A },
]
export const DROPOUT_TREND = [
  { label: 'T4', value: 9.1 }, { label: 'T5', value: 8.6 }, { label: 'T6', value: 8.2 }, { label: 'T7', value: 7.9 }, { label: 'T8', value: 7.6 }, { label: 'T9', value: 7.2 },
]
export const OVERVIEW_KPIS = [
  { label: 'Tỉ lệ tái đăng ký', value: '69%', delta: '+4%', accent: G },
  { label: 'Tỉ lệ nghỉ học', value: '7.2%', delta: '−1.1%', accent: R },
  { label: 'Tỉ lệ chuyển đổi', value: '62%', delta: '+4%', accent: D },
  { label: 'Tỉ lệ lấp đầy lớp', value: '86%', delta: '+3%', accent: A },
]
export const FORECASTS = [
  { tab: 'khoa', caption: 'Khóa tiếp theo · T11/2026 – T1/2027', value: '438 học viên', delta: '+2.3% so với khóa hiện tại', ai: 'Mở thêm 1 lớp KINDY 1C, gộp 2 lớp KID level 3', conf: 78, accent: D },
  { tab: 'thang', caption: 'Tháng tiếp theo · T10/2026', value: '38–42 học viên mới', delta: '+12% so với tháng 9', ai: 'Tăng ngân sách Zalo/Facebook cho KINDY và KID', conf: 82, accent: G },
  { tab: 'nam', caption: 'Năm tiếp theo · 2027', value: '≈ 530 học viên mới', delta: '+12% so với năm 2026', ai: 'Mở thêm lớp KID level 3, tuyển thêm 2 giảng viên', conf: 64, accent: A },
]
export const PROPOSALS = [
  { id: 'p1', title: 'Mở thêm 1 lớp KINDY 1C vào 05/10', why: 'Lượng tìm kiếm "Tiếng Anh cho bé" +28%, 2 lớp KINDY đã đầy chỗ', conf: 82 },
  { id: 'p2', title: 'Gửi ưu đãi khóa tiếp cho 27 học viên sắp hoàn thành khóa', why: 'Khả năng tái đăng ký thấp (38–55%), chủ yếu lớp KID 1B và KID 3B', conf: 74 },
  { id: 'p3', title: 'Liên hệ 18 học viên có nguy cơ nghỉ học', why: 'Vắng từ 3 buổi liên tiếp hoặc học phí quá hạn', conf: 79 },
]

export const COURSE_FORECAST = [
  { name: 'KINDY', now: 168, rate: '74% · 124', fresh: 56, pred: 180, classes: '17 lớp (+1)', trust: 'Cao' },
  { name: 'KID', now: 260, rate: '65% · 170', fresh: 88, pred: 258, classes: '18 lớp (giữ)', trust: 'Trung bình' },
]
export const BASIS = [
  { t: 'Tìm kiếm "tiếng Anh cho bé" +28%', d: 'so với T8, tập trung ở nhóm 25–40 tuổi' },
  { t: 'Cao điểm đăng ký KID T10–T12', d: 'phụ huynh chốt lớp cho học kỳ mới' },
  { t: 'Đối thủ giảm 10% học phí lớp thiếu nhi', d: 'lượng quan tâm bị chia sẻ' },
  { t: 'KID tái đăng ký thấp hơn KINDY', d: '65%, thấp hơn mục tiêu 5 điểm %' },
]
export const NEXT_COURSE_ACTIONS = [
  { title: 'Mở thêm 1 lớp KINDY 1C', why: 'Dự kiến sĩ số 12 học viên, khai giảng đầu T11', conf: 82, label: 'Tạo lớp mới', to: '/khoahoc' },
  { title: 'Gộp 2 lớp KID level 3 sĩ số thấp', why: 'KID 3A và lớp mở thêm cùng khung giờ 17:00–19:00, tổng 12 học viên', conf: 71, label: 'Xem lớp', to: '/khoahoc' },
  { title: 'Mở đăng ký sớm cho học viên đang học', why: 'Ưu đãi 5% nếu đăng ký trước 20/10 · gửi qua Thông báo', conf: 77, label: 'Soạn thông báo', to: '/thongbao/soan' },
]

export const MONTHS = [
  { label: 'T5', value: 26 }, { label: 'T6', value: 29 }, { label: 'T7', value: 31 }, { label: 'T8', value: 33 }, { label: 'T9', value: 34 }, { label: 'T10 (dự báo)', value: 40 },
]
export const BY_COURSE_T10 = [
  { label: 'KID', value: 24, color: B }, { label: 'KINDY', value: 16, color: G },
]
export const WEEKS = [
  { w: 'Tuần 1 · 01–07/10', lead: 34, enroll: 10, act: 'Chạy quảng cáo Zalo và Facebook cho KINDY và KID' },
  { w: 'Tuần 2 · 08–14/10', lead: 31, enroll: 11, act: 'Tổ chức buổi học thử miễn phí cuối tuần' },
  { w: 'Tuần 3 · 15–21/10', lead: 28, enroll: 10, act: 'Nhắc lại phụ huynh đã học thử chưa đăng ký' },
  { w: 'Tuần 4 · 22–31/10', lead: 27, enroll: 9, act: 'Ưu đãi đăng ký sớm khóa T11 qua Thông báo' },
]

export const YEAR = [34, 36, 42, 38, 40, 52, 58, 64, 48, 46, 42, 40].map((value, i) => ({ label: `T${i + 1}`, value, color: i >= 5 && i <= 7 ? A : '#9fd0ee' }))
export const QUARTERS = [{ q: 'Q1', hv: 112, cls: 26, gv: 5 }, { q: 'Q2', hv: 130, cls: 28, gv: 6 }, { q: 'Q3', hv: 160, cls: 32, gv: 7 }, { q: 'Q4', hv: 128, cls: 27, gv: 6 }]
export const STRATEGY = [
  { title: 'Mở thêm lớp KID level 3 từ quý 2', why: 'Học viên level 2 lên level 3 tăng +18%, học phí trung bình 3.2–3.8 triệu / khóa', conf: 68, label: 'Xem khóa học', to: '/khoahoc' },
  { title: 'Mở thêm 2 lớp KINDY cho mùa hè (T6–T8)', why: 'Tháng 6–8 lead cao điểm, các lớp KINDY hiện đã đầy', conf: 72, label: 'Xem lịch', to: '/lichphancong' },
  { title: 'Tuyển thêm 2 giảng viên trước T5/2027', why: 'Dự kiến thiếu giờ dạy ở quý 2 và quý 3', conf: 66, label: 'Xem giảng viên', to: '/giangvien' },
  { title: 'Điều chỉnh học phí +5% từ T1/2027', why: 'Chi phí vận hành tăng 8%, mức học phí còn thấp hơn thị trường', conf: 61, label: 'Xem mô phỏng', to: '/hocphi' },
]

export const AT_RISK_ENROLL = [
  { id: 1, name: 'Trần Gia Bảo', cls: 'KID 1B', gpa: '7.0', rate: '88%', prob: 41, tip: 'Ưu đãi 5% khi lên level 2' },
  { id: 2, name: 'Ngô Bảo Trâm', cls: 'KID 1B', gpa: '6.5', rate: '83%', prob: 38, tip: 'Tư vấn lộ trình học' },
  { id: 3, name: 'Lê Hoàng Phúc', cls: 'KID 3B', gpa: '6.5', rate: '80%', prob: 52, tip: 'Mời học thử level kế tiếp' },
  { id: 4, name: 'Đỗ Minh Anh', cls: 'KID 3B', gpa: '8.0', rate: '95%', prob: 78, tip: 'Nhắc đăng ký sớm' },
  { id: 5, name: 'Phạm Thu Uyên', cls: 'KID 2B', gpa: '7.5', rate: '90%', prob: 84, tip: 'Nhắc đăng ký sớm' },
]
export const REASONS = [
  { label: 'Học phí', value: 31, color: R }, { label: 'Lịch học không phù hợp', value: 24, color: A }, { label: 'Chuyển trung tâm khác', value: 18, color: B },
  { label: 'Kết quả chưa như kỳ vọng', value: 15, color: '#8e6bd8' }, { label: 'Lý do khác', value: 12, color: '#c5cfdb' },
]
export const DROPOUT_BY_COURSE = [
  { label: 'KID', value: 7.4, color: A }, { label: 'KINDY', value: 4.9, color: G },
]
export const DROPOUT_RISK = [
  { id: 1, name: 'Trần Gia Bảo', why: 'Vắng 3 buổi liên tiếp · nợ học phí', level: 'Cao' },
  { id: 2, name: 'Ngô Bảo Trâm', why: 'Nợ học phí 2 kỳ · điểm giảm', level: 'Cao' },
  { id: 3, name: 'Lê Hoàng Phúc', why: 'Điểm giảm 1.5 · vắng 2 buổi', level: 'Trung bình' },
  { id: 4, name: 'Vũ Đăng Khoa', why: 'Đổi lịch học 2 lần', level: 'Trung bình' },
  { id: 5, name: 'Nguyễn Gia Bảo', why: 'Quá hạn học phí', level: 'Trung bình' },
]
