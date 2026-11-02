// Dữ liệu mẫu theo Figma (10-manager-khoa-hoc-lop-hoc, 10.1, 10.2) — thay bằng src/api/courses.js khi có backend.
export const COURSES = [
  { id: 'kindy', name: 'KINDY', desc: 'Tiếng Anh mầm non · Level 1–3', classes: 16, students: 168, open: 13, soon: 2, avgSize: '10.5 / 12', accent: 'var(--gradient)' },
  { id: 'kid-teen', name: 'KID TEEN', desc: 'Tiếng Anh thiếu nhi & thiếu niên · Level 1–3', classes: 18, students: 260, open: 14, soon: 3, avgSize: '14.4 / 18', accent: '#1a6fc9' },
]
export const LEVELS = [1, 2, 3]
export const courseById = (id) => COURSES.find((c) => c.id === id) ?? COURSES[0]

// status: open (Đang mở) | full (Đủ chỗ) | soon (Sắp khai giảng) | ended (Đã kết thúc)
export const STATUS = {
  open: { label: 'Đang mở', tone: 'green' },
  full: { label: 'Đủ chỗ', tone: 'amber' },
  soon: { label: 'Sắp khai giảng', tone: 'blue' },
  ended: { label: 'Đã kết thúc', tone: 'gray' },
}
export const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'open', label: 'Đang mở' },
  { value: 'soon', label: 'Sắp khai giảng' },
  { value: 'ended', label: 'Đã kết thúc' },
]
export const matchStatus = (filter, status) => filter === 'all' || (filter === 'open' ? status === 'open' || status === 'full' : status === filter)

const mk = (id, name, courseId, teacher, room, days, listTime, range, size, cap, status, latest = 'done') => ({ id, name, courseId, teacher, room, days, listTime, range, size, cap, status, latest })

// Danh sách lớp ở trang Khóa học & Lớp học. Tên lớp = <KHÓA> <LEVEL><NHÓM>, ví dụ KINDY 1A, KID TEEN 2B.
export const CLASSES = [
  mk('kindy-1a', 'KINDY 1A', 'kindy', 'Phạm Thu Hà', 'P.108', 'T2-T3-T5-T6', '15:00', '15:00–17:00', 12, 12, 'full'),
  mk('kindy-1b', 'KINDY 1B', 'kindy', 'Phạm Thu Hà', 'P.105', 'T3-T5', '09:00', '09:00–11:00', 10, 12, 'open'),
  mk('kindy-2a', 'KINDY 2A', 'kindy', 'Lê Anh Dũng', 'P.301', 'T2-T4-T6', '09:00', '09:00–11:00', 12, 12, 'full'),
  mk('kindy-2b', 'KINDY 2B', 'kindy', 'Phạm Thu Hà', 'P.105', 'T7-CN', '07:00', '07:00–09:00', 10, 12, 'open'),
  mk('kindy-3a', 'KINDY 3A', 'kindy', 'Lê Anh Dũng', 'P.301', 'T7', '07:00', '07:00–09:00', 9, 12, 'open'),
  mk('kindy-3b', 'KINDY 3B', 'kindy', 'Trần Minh Khôi', 'P.202', 'T2', '15:00', '15:00–17:00', 11, 12, 'open'),
  mk('kid-teen-1a', 'KID TEEN 1A', 'kid-teen', 'Lê Anh Dũng', 'P.301', 'T3-T5', '09:00', '09:00–11:00', 20, 20, 'full', 'todo'),
  mk('kid-teen-1b', 'KID TEEN 1B', 'kid-teen', 'Lê Anh Dũng', 'P.301', 'T2-T5', '13:00', '13:00–15:00', 16, 20, 'open'),
  mk('kid-teen-2a', 'KID TEEN 2A', 'kid-teen', 'Trần Minh Khôi', 'P.203', 'T2-T4-T6', '17:00', '17:00–19:00', 18, 20, 'open'),
  mk('kid-teen-2b', 'KID TEEN 2B', 'kid-teen', 'Phạm Thu Hà', 'P.105', 'T2-T4-T6', '17:30', '17:30–19:00', 14, 15, 'open'),
  mk('kid-teen-3a', 'KID TEEN 3A', 'kid-teen', 'Trần Minh Khôi', 'P.202', 'T3-T5-T7', '17:00', '17:00–19:00', 5, 20, 'soon', null),
  mk('kid-teen-3b', 'KID TEEN 3B', 'kid-teen', 'Trần Minh Khôi', 'P.203', 'T2-T4', '13:00', '13:00–15:00', 16, 18, 'open'),
]
export const rowsOfCourse = (courseId) => CLASSES.filter((c) => c.courseId === courseId)
export const findClass = (id) => CLASSES.find((c) => c.id === id) ?? CLASSES[0]

export const ROSTER = [
  { id: 'HV20260142', name: 'Nguyễn Minh Anh', today: 'present', rate: '95%', score: '8.5/10', fee: 'paid' },
  { id: 'HV20260118', name: 'Trần Gia Bảo', today: 'present', rate: '88%', score: '7.0/10', fee: 'overdue' },
  { id: 'HV20260163', name: 'Đỗ Minh Anh', today: 'present', rate: '95%', score: '—', fee: 'overdue' },
  { id: 'HV20260127', name: 'Lê Hoàng Phúc', today: 'late', rate: '80%', score: '6.5/10', fee: 'paid' },
  { id: 'HV20260214', name: 'Hoàng Gia Hân', today: 'present', rate: '91%', score: '7.5/10', fee: 'paid' },
  { id: 'HV20260260', name: 'Vũ Ngọc Diệp', today: 'late', rate: '86%', score: '8.0/10', fee: 'paid' },
  { id: 'HV20260131', name: 'Bùi Thanh Tùng', today: 'present', rate: '93%', score: '7.0/10', fee: 'paid' },
  { id: 'HV20260253', name: 'Phạm Đức Anh', today: 'present', rate: '90%', score: '8.0/10', fee: 'paid' },
]

export const LECTURER_NAMES = ['Trần Minh Khôi', 'Lê Anh Dũng', 'Phạm Thu Hà', 'Đặng Quốc Bảo']
export const ROOMS = ['P.101', 'P.105', 'P.108', 'P.202', 'P.203', 'P.204', 'P.301']
export const TIME_SLOTS = ['07:00 – 08:30', '09:00 – 10:30', '13:00 – 14:30', '15:30 – 17:00', '18:00 – 19:30', '19:30 – 21:00']
