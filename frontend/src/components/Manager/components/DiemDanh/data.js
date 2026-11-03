import createStore from '../../../../common/createStore'
import { COURSES, rowsOfCourse } from '../KhoaHoc/data'

// Dữ liệu mẫu theo Figma (13.0–13.5) — thay bằng src/api/grades.js khi có backend.
// state: open (Đang mở) | closing (Sắp đóng) | notopen (Chưa mở) | closed (Đã đóng)
export const STATE = {
  open: { label: 'Đang mở', tone: 'green', bar: 'var(--primary)' },
  closing: { label: 'Sắp đóng', tone: 'amber', bar: '#1a6fc9' },
  notopen: { label: 'Chưa mở', tone: 'gray', bar: 'var(--divider)' },
  closed: { label: 'Đã đóng', tone: 'blue', bar: 'var(--success-fill)' },
}
export const COURSE_CARDS = COURSES.map((course) => ({
  id: course.id, name: course.name, meta: `${course.classes} lớp · ${course.students} học viên`,
  state: 'open', deadline: '16/09', published: Math.ceil(course.classes / 3), total: course.classes,
  term: 'Giữa kỳ T9', window: '10/09 08:00 → 16/09 23:59', release: 'Ngay khi GV xác nhận',
  note: 'Dữ liệu mẫu · đóng lúc 16/09/2026 23:59', avg: '—', left: '16/09', accent: course.accent,
}))
export const scoreStore = createStore(COURSE_CARDS)
export function updateCard(id, changes) {
  scoreStore.set((courses) => courses.map((course) => (
    course.id === id ? { ...course, ...changes } : course
  )))
}

export const PROGRESS_STATE = {
  published: { label: 'Đã công bố', tone: 'green' },
  pending: { label: 'Chờ GV xác nhận', tone: 'amber' },
  empty: { label: 'Chưa nhập điểm', tone: 'gray' },
}
export const progressRows = (courseId) => rowsOfCourse(courseId).map((c, i) => ({
  id: c.id, name: c.name, teacher: c.teacher, students: c.size,
  state: ['published', 'pending', 'empty'][i % 3], at: i % 3 === 0 ? '12/09 20:10' : '—', avg: i % 3 === 2 ? '—' : (7.2 + i * 0.3).toFixed(1),
}))

export function avg(list) {
  const scores = list.map(Number).filter((score) => !Number.isNaN(score))
  if (scores.length === 0) return null
  const total = scores.reduce((sum, score) => sum + score, 0)
  return Math.round((total / scores.length) * 10) / 10
}

export function grade(score) {
  if (score === null) return null
  if (score >= 9) return ['Xuất sắc', 'green']
  if (score >= 8) return ['Giỏi', 'blue']
  if (score >= 7) return ['Giỏi', 'green']
  if (score >= 6) return ['Khá', 'blue']
  if (score >= 5) return ['TB', 'amber']
  return ['Yếu', 'red']
}

// Bảng điểm lớp (Figma 13.3): nghe, nói, đọc, viết
export const SCORE_ROWS = [
  ['HV20260301', 'Nguyễn Bảo Châu', 9.5, 9.0, 9.0, 9.3], ['HV20260302', 'Trần Minh Khang', 9.0, 8.5, 9.0, 9.0],
  ['HV20260303', 'Lê Gia Hân', 9.0, 9.5, 8.5, 9.0], ['HV20260304', 'Phạm Tuấn Kiệt', 8.5, 8.0, 8.5, 8.5],
  ['HV20260305', 'Võ Ngọc Mai', 9.0, 8.5, 8.5, 9.0], ['HV20260306', 'Đặng Hoàng Nam', 8.5, 9.0, 8.5, 8.5],
  ['HV20260307', 'Bùi Thảo Nhi', 9.0, 9.5, 9.0, 9.0], ['HV20260308', 'Hoàng Minh Quân', 8.0, 8.5, 8.5, 9.0],
].map(([id, name, ...s]) => ({ id, name, s }))

// Nhập điểm (Figma 13.4): nghe, đọc, nói, viết — '' = chưa nhập
const createEntryRow = (name, s, note = '') => ({ name, s: s.map((x) => (x === null ? '' : Number(x).toFixed(1))), note })
export const ENTRY_ROWS = [
  createEntryRow('Nguyễn Gia Bảo', [7.5, 6.5, 6.0, 6.5]), createEntryRow('Đỗ Minh Anh', [6.0, 6.5, 5.5, 6.0]), createEntryRow('Lê Thu Hà', [7.0, 7.5, 6.5, 7.0]),
  createEntryRow('Trần Quốc Việt', [5.5, 5.0, 5.0, 5.5], 'Cần luyện thêm Speaking'), createEntryRow('Phạm Thu Uyên', [8.0, 7.5, 7.0, 7.5]), createEntryRow('Vũ Đăng Khoa', [6.5, 6.0, 6.0, 6.5]),
  createEntryRow('Ngô Bảo Trâm', [6.0, 5.5, null, null]), createEntryRow('Hoàng Kim Ngân', [9.5, 6.5, 6.0, 6.5]), createEntryRow('Bùi Thanh Tú', [null, null, null, null]), createEntryRow('Đặng Hồng Nhung', [null, null, null, null]),
  ...['Lê Quang Huy', 'Trịnh Mai Anh', 'Phan Đức Tài', 'Võ Thị Lan', 'Nguyễn Hữu Phước', 'Đinh Khánh Vy', 'Cao Minh Triết', 'Lý Ngọc Hân'].map((n) => createEntryRow(n, [null, null, null, null])),
]
export const ENTRY_CLASSES = ['KID 2A', 'KID 3B', 'KID 1B', 'KINDY 1A']
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
