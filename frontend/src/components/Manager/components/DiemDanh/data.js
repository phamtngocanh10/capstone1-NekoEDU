import createStore from '../../../../common/createStore'
import { rowsOfCourse } from '../KhoaHoc/data'

// Dữ liệu mẫu theo Figma (13.0–13.5) — thay bằng src/api/grades.js khi có backend.
// state: open (Đang mở) | closing (Sắp đóng) | notopen (Chưa mở) | closed (Đã đóng)
export const STATE = {
  open: { label: 'Đang mở', tone: 'green', bar: 'var(--primary)' },
  closing: { label: 'Sắp đóng', tone: 'amber', bar: '#1a6fc9' },
  notopen: { label: 'Chưa mở', tone: 'gray', bar: 'var(--divider)' },
  closed: { label: 'Đã đóng', tone: 'blue', bar: 'var(--success-fill)' },
}
export const COURSE_CARDS = [
  { id: 'kindy', name: 'KINDY', meta: '16 lớp · 168 học viên', state: 'open', deadline: '16/09', published: 9, total: 16, term: 'Giữa kỳ T9', window: '10/09 08:00 → 16/09 23:59', release: 'Ngay khi GV xác nhận', note: 'Còn 2 ngày · đóng lúc 16/09/2026 23:59', avg: '8.4 / 10', left: '2 ngày', accent: 'var(--gradient)' },
  { id: 'kid-teen', name: 'KID TEEN', meta: '18 lớp · 260 học viên', state: 'closing', deadline: '15/09', published: 12, total: 18, term: 'Giữa kỳ T9', window: '10/09 08:00 → 15/09 23:59', release: 'Ngay khi GV xác nhận', note: 'Còn 1 ngày · đóng lúc 15/09/2026 23:59', avg: '7.8 / 10', left: '1 ngày', accent: '#1a6fc9' },
]
export const scoreStore = createStore(COURSE_CARDS)
export const updateCard = (id, patch) => scoreStore.set((l) => l.map((c) => (c.id === id ? { ...c, ...patch } : c)))

export const PROGRESS_STATE = {
  published: { label: 'Đã công bố', tone: 'green' },
  pending: { label: 'Chờ GV xác nhận', tone: 'amber' },
  empty: { label: 'Chưa nhập điểm', tone: 'gray' },
}
export const progressRows = (courseId) => rowsOfCourse(courseId).map((c, i) => ({
  id: c.id, name: c.name, teacher: c.teacher, students: c.size,
  state: ['published', 'pending', 'empty'][i % 3], at: i % 3 === 0 ? '12/09 20:10' : '—', avg: i % 3 === 2 ? '—' : (7.2 + i * 0.3).toFixed(1),
}))

export const avg = (list) => {
  const n = list.map(Number).filter((x) => !Number.isNaN(x))
  return n.length ? Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 10) / 10 : null
}
export const grade = (score) => (score === null ? null : score >= 9 ? ['Xuất sắc', 'green'] : score >= 8 ? ['Giỏi', 'blue'] : score >= 7 ? ['Giỏi', 'green'] : score >= 6 ? ['Khá', 'blue'] : score >= 5 ? ['TB', 'amber'] : ['Yếu', 'red'])

// Bảng điểm lớp (Figma 13.3): nghe, nói, đọc, viết
export const SCORE_ROWS = [
  ['HV20260301', 'Nguyễn Bảo Châu', 9.5, 9.0, 9.0, 9.3], ['HV20260302', 'Trần Minh Khang', 9.0, 8.5, 9.0, 9.0],
  ['HV20260303', 'Lê Gia Hân', 9.0, 9.5, 8.5, 9.0], ['HV20260304', 'Phạm Tuấn Kiệt', 8.5, 8.0, 8.5, 8.5],
  ['HV20260305', 'Võ Ngọc Mai', 9.0, 8.5, 8.5, 9.0], ['HV20260306', 'Đặng Hoàng Nam', 8.5, 9.0, 8.5, 8.5],
  ['HV20260307', 'Bùi Thảo Nhi', 9.0, 9.5, 9.0, 9.0], ['HV20260308', 'Hoàng Minh Quân', 8.0, 8.5, 8.5, 9.0],
].map(([id, name, ...s]) => ({ id, name, s }))

// Nhập điểm (Figma 13.4): nghe, đọc, nói, viết — '' = chưa nhập
const E = (name, s, note = '') => ({ name, s: s.map((x) => (x === null ? '' : Number(x).toFixed(1))), note })
export const ENTRY_ROWS = [
  E('Nguyễn Gia Bảo', [7.5, 6.5, 6.0, 6.5]), E('Đỗ Minh Anh', [6.0, 6.5, 5.5, 6.0]), E('Lê Thu Hà', [7.0, 7.5, 6.5, 7.0]),
  E('Trần Quốc Việt', [5.5, 5.0, 5.0, 5.5], 'Cần luyện thêm Speaking'), E('Phạm Thu Uyên', [8.0, 7.5, 7.0, 7.5]), E('Vũ Đăng Khoa', [6.5, 6.0, 6.0, 6.5]),
  E('Ngô Bảo Trâm', [6.0, 5.5, null, null]), E('Hoàng Kim Ngân', [9.5, 6.5, 6.0, 6.5]), E('Bùi Thanh Tú', [null, null, null, null]), E('Đặng Hồng Nhung', [null, null, null, null]),
  ...['Lê Quang Huy', 'Trịnh Mai Anh', 'Phan Đức Tài', 'Võ Thị Lan', 'Nguyễn Hữu Phước', 'Đinh Khánh Vy', 'Cao Minh Triết', 'Lý Ngọc Hân'].map((n) => E(n, [null, null, null, null])),
]
export const ENTRY_CLASSES = ['KID TEEN 2A', 'KID TEEN 3B', 'KID TEEN 1B', 'KINDY 1A']
export const EXAMS = ['Kiểm tra giữa kỳ', 'Kiểm tra cuối kỳ', 'Bài kiểm tra 15 phút']

// Tải file điểm lên (Figma 13.5)
export const UPLOAD_ROWS = [
  { line: 2, id: 'HV20260142', name: 'Nguyễn Gia Bảo', s: [7.5, 6.5, 6.0, 6.5], res: 'ok' },
  { line: 3, id: 'HV20260098', name: 'Đỗ Minh Anh', s: [6.0, 6.5, 5.5, 6.0], res: 'ok' },
  { line: 4, id: 'HV20260201', name: 'Lê Thu Hà', s: [7.0, 7.5, 6.5, 7.0], res: 'ok' },
  { line: 6, id: 'HV20260055', name: 'Trần Quốc Việt', s: [2.0, 5.0, 5.0, 5.5], res: 'warn', msg: 'Nghe giảm 3.5 so với lần trước' },
  { line: 9, id: 'HV20260210', name: 'Hoàng Kim Ngân', s: [6.5, 6.0, 9.5, 6.5], res: 'err', bad: 2, msg: 'Nói = 9.5 vượt thang 9.0' },
  { line: 12, id: 'HV20260999', name: '—', s: [6.0, 6.0, 6.0, 6.0], res: 'err', msg: 'Mã HV không có trong lớp' },
]
