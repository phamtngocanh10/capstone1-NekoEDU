import createStore from '../../../../common/createStore'

// Dữ liệu mẫu theo Figma (12-manager-giang-vien, 12.1–12.7) — thay bằng src/api/lecturers.js khi có backend.
// status: teaching (Đang dạy) | free (Đang rảnh) | none (Chưa nhận lớp) | stopped (Đã ngừng giảng dạy)
export const STATUS = {
  teaching: { label: 'Đang dạy', tone: 'green' },
  free: { label: 'Đang rảnh', tone: 'gray' },
  none: { label: 'Chưa nhận lớp', tone: 'amber' },
  stopped: { label: 'Đã ngừng giảng dạy', tone: 'red' },
}
export const ROLE_LABEL = { lecturer: 'Giảng viên', assistant: 'Trợ giảng' }

const base = { gender: 'Nam', account: 'Đã kích hoạt', rating: '4.8 / 5', punctual: '96%' }
export const LECTURERS = [
  { ...base, id: 'GV2024015', name: 'Trần Minh Khôi', cert: 'IELTS 7.5', role: 'lecturer', summary: '4 lớp · KID TEEN 2A, 3A, 3B, +1', hours: 16, cells: [0, 0, 1, 0, 1, 0], status: 'teaching', birth: '03/02/1990', address: '12 Lê Duẩn, Hải Châu', phone: '0905 xxx 118', email: 'khoi.tran@gmail.com', specialty: 'KID TEEN', certificate: 'IELTS 7.5 · TESOL', contract: 'Toàn thời gian', rate: 250000, joined: '15/08/2024', monthHours: 64 },
  { ...base, id: 'GV2024021', name: 'Lê Anh Dũng', cert: 'TOEIC 900', role: 'lecturer', summary: '4 lớp · KINDY 2A, 3A, KID TEEN 1A, 1B', hours: 18, cells: [0, 1, 0, 1, 0, 0], status: 'free', birth: '21/07/1988', address: '45 Nguyễn Văn Linh, Hải Châu', phone: '0912 xxx 305', email: 'dung.le@gmail.com', specialty: 'KID TEEN', certificate: 'TOEIC 900 · TESOL', contract: 'Toàn thời gian', rate: 230000, joined: '01/03/2024', monthHours: 72, rating: '4.7 / 5', punctual: '94%' },
  { ...base, id: 'GV2024033', name: 'Phạm Thu Hà', cert: 'KINDY · KID TEEN', role: 'lecturer', summary: '4 lớp · KINDY 1A, 1B, 2B, +1', hours: 20, cells: [0, 0, 0, 1, 1, 0], status: 'teaching', gender: 'Nữ', birth: '09/11/1992', address: '8 Hoàng Diệu, Hải Châu', phone: '0933 xxx 771', email: 'ha.pham@gmail.com', specialty: 'KINDY', certificate: 'CELTA · Young Learners', contract: 'Toàn thời gian', rate: 220000, joined: '12/06/2024', monthHours: 80, rating: '4.9 / 5', punctual: '98%' },
  { ...base, id: 'TG2025004', name: 'Nguyễn Thảo Vy', cert: 'Hỗ trợ lớp KID TEEN', role: 'assistant', summary: '1 lớp · KID TEEN 2A', hours: 6, cells: [0, 0, 0, 0, 1, 0], status: 'teaching', gender: 'Nữ', birth: '15/04/1999', address: '77 Lê Lợi, Hải Châu', phone: '0987 xxx 204', email: 'vy.nguyen@gmail.com', specialty: 'KID TEEN', certificate: 'IELTS 7.0', contract: 'Bán thời gian', rate: 90000, joined: '05/01/2025', monthHours: 24, rating: '4.6 / 5', punctual: '97%' },
  { ...base, id: 'GV2026002', name: 'Đặng Quốc Bảo', cert: 'Giảng viên mới', role: 'lecturer', summary: 'Chưa có lớp', hours: 0, cells: [0, 0, 0, 0, 0, 0], status: 'none', birth: '30/08/1995', address: '19 Trần Phú, Hải Châu', phone: '0968 xxx 412', email: 'bao.dang@gmail.com', specialty: 'KINDY', certificate: 'IELTS 7.5', contract: 'Toàn thời gian', rate: 200000, joined: '01/09/2026', monthHours: 0, rating: '—', punctual: '—' },
]

export const lecturerStore = createStore(LECTURERS)
export const updateLecturer = (id, patch) => lecturerStore.set((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)))
export const addLecturer = (lec) => lecturerStore.set((l) => [...l, lec])

const row = (name, room, schedule, size, cap, status, extra) => ({ id: name, name, room, schedule, size, cap, status, ...extra })
export const TEACHING = {
  GV2024015: [
    row('KID TEEN 2A', 'P.203', 'T2-T4-T6 · 17:00–19:00', 18, 20, 'open', { days: ['T2', 'T4', 'T6'], slot: '17:00 – 19:00' }),
    row('KID TEEN 3A', 'P.202', 'T3-T5-T7 · 17:00–19:00', 5, 20, 'soon', { days: ['T3', 'T5', 'T7'], slot: '17:00 – 19:00' }),
    row('KID TEEN 3B', 'P.203', 'T2-T4 · 13:00–15:00', 16, 18, 'open', { days: ['T2', 'T4'], slot: '13:00 – 15:00' }),
    row('KINDY 3B', 'P.202', 'T2 · 15:00–17:00', 11, 12, 'open', { days: ['T2'], slot: '15:00 – 17:00' }),
  ],
  GV2024021: [
    row('KID TEEN 1B', 'P.301', 'T2-T5 · 13:00–15:00', 16, 20, 'open'),
    row('KINDY 3A', 'P.301', 'T7 · 07:00–09:00', 9, 12, 'open'),
    row('KINDY 2A', 'P.301', 'T2-T4-T6 · 09:00–11:00', 12, 12, 'full'),
    row('KID TEEN 1A', 'P.301', 'T3-T5 · 09:00–11:00', 20, 20, 'full'),
  ],
  GV2024033: [
    row('KINDY 1A', 'P.108', 'T2-T3-T5-T6 · 15:00–17:00', 12, 12, 'full'),
    row('KID TEEN 2B', 'P.105', 'T2-T4-T6 · 17:30–19:00', 14, 15, 'open'),
    row('KINDY 1B', 'P.105', 'T3-T5 · 09:00–11:00', 10, 12, 'open'),
    row('KINDY 2B', 'P.105', 'T7-CN · 07:00–09:00', 10, 12, 'open'),
  ],
  TG2025004: [row('KID TEEN 2A', 'P.203', 'T2-T4-T6 · 17:00–19:00', 18, 20, 'open')],
  GV2026002: [],
}
// Lớp có thể phân công thêm (Figma 12.5) — busy: lịch đang dạy của giảng viên dùng để kiểm tra trùng
export const ASSIGNABLE = [
  { value: 'KID TEEN 1C · Sắp khai giảng', days: ['T2', 'T4'], slot: '13:00 – 15:00', room: 'P.204' },
  { value: 'KINDY 1C · Sắp khai giảng', days: ['T3', 'T5'], slot: '15:00 – 17:00', room: 'P.301' },
]
export const ASSIGN_SLOTS = ['07:00 – 09:00', '09:00 – 11:00', '13:00 – 15:00', '15:00 – 17:00', '17:00 – 19:00', '19:00 – 21:00']
export const SPECIALTIES = ['KINDY', 'KID TEEN']
export const CONTRACTS = ['Toàn thời gian', 'Bán thời gian', 'Thời vụ']
export const RATES = [90000, 200000, 220000, 230000, 250000, 300000].map((v) => ({ value: String(v), label: `${v.toLocaleString('vi-VN')}đ / giờ` }))
export const money = (v) => `${Number(v).toLocaleString('vi-VN')}đ / giờ`

// Lịch dạy theo tuần: slot → chỉ số ngày → buổi dạy (Figma 12.4)
const t = (name, room, status) => ({ name, room, status })
export const SCHEDULE = {
  GV2024015: {
    '13:00-15:00': { 0: t('KID TEEN 3B', 'P.203', 'attended'), 2: t('KID TEEN 3B', 'P.203', 'upcoming') },
    '15:00-17:00': { 0: t('KINDY 3B', 'P.202', 'attended') },
    '17:00-19:00': { 0: t('KID TEEN 2A', 'P.203', 'attended'), 1: t('KID TEEN 3A', 'P.202', 'upcoming'), 2: t('KID TEEN 2A', 'P.203', 'cancelled'), 3: t('KID TEEN 3A', 'P.202', 'upcoming'), 4: t('KID TEEN 2A', 'P.203', 'upcoming'), 5: t('KID TEEN 3A', 'P.202', 'upcoming') },
  },
  GV2024021: {
    '07:00-09:00': { 5: t('KINDY 3A', 'P.301', 'upcoming') },
    '09:00-11:00': { 0: t('KINDY 2A', 'P.301', 'attended'), 1: t('KID TEEN 1A', 'P.301', 'upcoming'), 2: t('KINDY 2A', 'P.301', 'upcoming'), 3: t('KID TEEN 1A', 'P.301', 'upcoming'), 4: t('KINDY 2A', 'P.301', 'upcoming') },
    '13:00-15:00': { 0: t('KID TEEN 1B', 'P.301', 'attended'), 3: t('KID TEEN 1B', 'P.301', 'upcoming') },
  },
  GV2024033: {
    '07:00-09:00': { 6: t('KINDY 2B', 'P.105', 'upcoming') },
    '09:00-11:00': { 1: t('KINDY 1B', 'P.105', 'upcoming'), 3: t('KINDY 1B', 'P.105', 'upcoming') },
    '15:00-17:00': { 0: t('KINDY 1A', 'P.108', 'attended'), 1: t('KINDY 1A', 'P.108', 'upcoming'), 3: t('KINDY 1A', 'P.108', 'upcoming'), 4: t('KINDY 1A', 'P.108', 'upcoming') },
    '17:00-19:00': { 0: t('KID TEEN 2B', 'P.105', 'upcoming'), 2: t('KID TEEN 2B', 'P.105', 'cancelled'), 4: t('KID TEEN 2B', 'P.105', 'upcoming') },
  },
  TG2025004: { '17:00-19:00': { 0: t('KID TEEN 2A', 'P.203', 'attended'), 2: t('KID TEEN 2A', 'P.203', 'upcoming'), 4: t('KID TEEN 2A', 'P.203', 'upcoming') } },
  GV2026002: {},
}
