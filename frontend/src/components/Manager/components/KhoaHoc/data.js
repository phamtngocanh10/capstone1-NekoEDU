// Dữ liệu dùng chung cho Manager và Giảng viên — thay bằng src/api/courses.js khi có backend.
const COURSE_DEFINITIONS = [
  { id: 'kindy', name: 'KINDY', desc: 'Tiếng Anh mầm non · Level 1–3', accent: 'var(--gradient)' },
  { id: 'kid', name: 'KID', desc: 'Tiếng Anh thiếu nhi · Level 1–3', accent: '#1a6fc9' },
  { id: 'teen', name: 'TEEN', desc: 'Tiếng Anh thiếu niên · Level 1–3', accent: '#299b70' },
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
export function matchStatus(filter, status) {
  if (filter === 'all') return true
  if (filter === 'open') return status === 'open' || status === 'full'
  return status === filter
}

const createClass = (id, name, courseId, teacher, room, days, listTime, range, size, cap, status, latest = 'done') => ({ id, name, courseId, level: Number(name.match(/ (\d)/)?.[1]), teacher, room, days, listTime, range, size, cap, status, latest })

// Ba khóa riêng biệt KINDY, KID, TEEN; mỗi khóa có Level 1, 2, 3 và nhóm lớp A/B.
export const CLASSES = [
  createClass('kindy-1a', 'KINDY 1A', 'kindy', 'Phạm Thu Hà', 'P.108', 'T2-T3-T5-T6', '15:00', '15:00–17:00', 12, 12, 'full'),
  createClass('kindy-1b', 'KINDY 1B', 'kindy', 'Phạm Thu Hà', 'P.105', 'T3-T5', '09:00', '09:00–11:00', 10, 12, 'open'),
  createClass('kindy-2a', 'KINDY 2A', 'kindy', 'Lê Anh Dũng', 'P.301', 'T2-T4-T6', '09:00', '09:00–11:00', 12, 12, 'full'),
  createClass('kindy-2b', 'KINDY 2B', 'kindy', 'Phạm Thu Hà', 'P.105', 'T7-CN', '07:00', '07:00–09:00', 10, 12, 'open'),
  createClass('kindy-3a', 'KINDY 3A', 'kindy', 'Lê Anh Dũng', 'P.301', 'T7', '07:00', '07:00–09:00', 9, 12, 'open'),
  createClass('kindy-3b', 'KINDY 3B', 'kindy', 'Trần Minh Khôi', 'P.202', 'T2', '15:00', '15:00–17:00', 11, 12, 'open'),
  createClass('kid-1a', 'KID 1A', 'kid', 'Lê Anh Dũng', 'P.301', 'T3-T5', '09:00', '09:00–11:00', 20, 20, 'full', 'todo'),
  createClass('kid-1b', 'KID 1B', 'kid', 'Lê Anh Dũng', 'P.301', 'T2-T5', '13:00', '13:00–15:00', 16, 20, 'open'),
  createClass('kid-2a', 'KID 2A', 'kid', 'Trần Minh Khôi', 'P.203', 'T2-T4-T6', '17:00', '17:00–19:00', 18, 20, 'open'),
  createClass('kid-2b', 'KID 2B', 'kid', 'Phạm Thu Hà', 'P.105', 'T2-T4-T6', '17:30', '17:30–19:00', 14, 15, 'open'),
  createClass('kid-3a', 'KID 3A', 'kid', 'Trần Minh Khôi', 'P.202', 'T3-T5-T7', '17:00', '17:00–19:00', 5, 20, 'soon', null),
  createClass('kid-3b', 'KID 3B', 'kid', 'Trần Minh Khôi', 'P.203', 'T2-T4', '13:00', '13:00–15:00', 16, 18, 'open'),
  createClass('teen-1a', 'TEEN 1A', 'teen', 'Trần Minh Khôi', 'P.203', 'T2-T4-T6', '19:00', '19:00–21:00', 18, 20, 'open'),
  createClass('teen-1b', 'TEEN 1B', 'teen', 'Đặng Quốc Bảo', 'P.204', 'T2-T4-T6', '07:00', '07:00–09:00', 16, 20, 'open'),
  createClass('teen-2a', 'TEEN 2A', 'teen', 'Trần Minh Khôi', 'P.203', 'T3-T5', '19:00', '19:00–21:00', 17, 20, 'open'),
  createClass('teen-2b', 'TEEN 2B', 'teen', 'Đặng Quốc Bảo', 'P.204', 'T3-T5', '15:00', '15:00–17:00', 14, 20, 'open'),
  createClass('teen-3a', 'TEEN 3A', 'teen', 'Trần Minh Khôi', 'P.203', 'T7', '15:00', '15:00–17:00', 15, 20, 'open'),
  createClass('teen-3b', 'TEEN 3B', 'teen', 'Đặng Quốc Bảo', 'P.301', 'T7-CN', '09:00', '09:00–11:00', 12, 20, 'open'),
]
export const COURSES = COURSE_DEFINITIONS.map((course) => {
  const classes = CLASSES.filter((classItem) => classItem.courseId === course.id)
  const students = classes.reduce((total, classItem) => total + classItem.size, 0)
  return {
    ...course,
    levels: LEVELS,
    classes: classes.length,
    students,
    open: classes.filter((classItem) => classItem.status === 'open' || classItem.status === 'full').length,
    soon: classes.filter((classItem) => classItem.status === 'soon').length,
    avgSize: `${(students / classes.length).toFixed(1)} / ${Math.max(...classes.map((classItem) => classItem.cap))}`,
  }
})
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
