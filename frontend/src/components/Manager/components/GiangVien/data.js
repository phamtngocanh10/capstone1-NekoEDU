import createStore from '../../../../common/createStore'
import { CLASSES } from '../KhoaHoc/data'
import { DAYS, MOCK_TODAY, SLOTS, lessonsOn } from '../LichPhanCong/data'

// Dữ liệu mẫu theo Figma (12-manager-giang-vien, 12.1–12.7) — thay bằng src/api/lecturers.js khi có backend.
// status: teaching (Đang dạy) | free (Đang rảnh) | none (Chưa nhận lớp) | stopped (Đã ngừng giảng dạy)
export const STATUS = {
  teaching: { label: 'Đang dạy', tone: 'green' },
  free: { label: 'Đang rảnh', tone: 'gray' },
  none: { label: 'Chưa nhận lớp', tone: 'amber' },
  stopped: { label: 'Đã ngừng giảng dạy', tone: 'red' },
}
export const ROLE_LABEL = { lecturer: 'Giảng viên', assistant: 'Trợ giảng' }

const defaultProfile = { gender: 'Nam', account: 'Đã kích hoạt', rating: '4.8 / 5', punctual: '96%' }
const LECTURER_PROFILES = [
  { ...defaultProfile, id: 'GV2024015', name: 'Trần Minh Khôi', cert: 'IELTS 7.5', role: 'lecturer', status: 'teaching', birth: '03/02/1990', address: '12 Lê Duẩn, Hải Châu', phone: '0905 xxx 118', email: 'khoi.tran@gmail.com', specialty: 'KID', certificate: 'IELTS 7.5 · TESOL', contract: 'Toàn thời gian', rate: 250000, joined: '15/08/2024' },
  { ...defaultProfile, id: 'GV2024021', name: 'Lê Anh Dũng', cert: 'TOEIC 900', role: 'lecturer', status: 'free', birth: '21/07/1988', address: '45 Nguyễn Văn Linh, Hải Châu', phone: '0912 xxx 305', email: 'dung.le@gmail.com', specialty: 'KID', certificate: 'TOEIC 900 · TESOL', contract: 'Toàn thời gian', rate: 230000, joined: '01/03/2024', rating: '4.7 / 5', punctual: '94%' },
  { ...defaultProfile, id: 'GV2024033', name: 'Phạm Thu Hà', cert: 'KINDY · KID', role: 'lecturer', status: 'teaching', gender: 'Nữ', birth: '09/11/1992', address: '8 Hoàng Diệu, Hải Châu', phone: '0933 xxx 771', email: 'ha.pham@gmail.com', specialty: 'KINDY', certificate: 'CELTA · Young Learners', contract: 'Toàn thời gian', rate: 220000, joined: '12/06/2024', rating: '4.9 / 5', punctual: '98%' },
  { ...defaultProfile, id: 'TG2025004', name: 'Nguyễn Thảo Vy', cert: 'Hỗ trợ lớp KID', role: 'assistant', summary: '1 lớp · KID 2A', hours: 6, cells: [0, 0, 0, 0, 1, 0], status: 'teaching', gender: 'Nữ', birth: '15/04/1999', address: '77 Lê Lợi, Hải Châu', phone: '0987 xxx 204', email: 'vy.nguyen@gmail.com', specialty: 'KID', certificate: 'IELTS 7.0', contract: 'Bán thời gian', rate: 90000, joined: '05/01/2025', monthHours: 24, rating: '4.6 / 5', punctual: '97%' },
  { ...defaultProfile, id: 'GV2026002', name: 'Đặng Quốc Bảo', cert: 'Giảng viên mới', role: 'lecturer', status: 'none', birth: '30/08/1995', address: '19 Trần Phú, Hải Châu', phone: '0968 xxx 412', email: 'bao.dang@gmail.com', specialty: 'KINDY', certificate: 'IELTS 7.5', contract: 'Toàn thời gian', rate: 200000, joined: '01/09/2026', rating: '—', punctual: '—' },
]

// Lớp, giờ dạy và tóm tắt của giảng viên lấy từ cùng dữ liệu Khóa học & Lớp học.
// Giữ riêng thông tin trợ giảng để không thay đổi việc phân công hỗ trợ hiện có.
const minutesOf = (time) => {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}
const durationOf = (classItem) => {
  const [start, end] = classItem.range.split('–').map(minutesOf)
  return (end - start) / 60
}
const daysOf = (classItem) => classItem.days.split('-').map((day) => day === 'CN' ? 6 : Number(day.slice(1)) - 2)
const monthlyHoursOf = (classes) => {
  // Tháng 9/2026 là tháng mẫu đang hiển thị trên màn hồ sơ.
  const weekdayCounts = Array(7).fill(0)
  for (let day = 1; day <= 30; day++) {
    const weekday = (new Date(2026, 8, day).getDay() + 6) % 7
    weekdayCounts[weekday]++
  }
  let totalHours = 0
  for (const classItem of classes) {
    const lessonCount = daysOf(classItem).reduce((total, day) => total + weekdayCounts[day], 0)
    totalHours += durationOf(classItem) * lessonCount
  }
  return totalHours
}
const planForToday = lessonsOn(MOCK_TODAY)
export const LECTURERS = LECTURER_PROFILES.map((lecturer) => {
  if (lecturer.role !== 'lecturer') return lecturer
  const classes = CLASSES.filter((classItem) => classItem.teacher === lecturer.name)
  const names = classes.slice(0, 3).map((classItem) => classItem.name).join(', ')
  let summary = 'Chưa có lớp'
  if (classes.length > 0) {
    summary = `${classes.length} lớp · ${names}`
    if (classes.length > 3) summary += `, +${classes.length - 3}`
  }
  return {
    ...lecturer,
    summary,
    hours: classes.reduce((sum, classItem) => sum + durationOf(classItem) * daysOf(classItem).length, 0),
    monthHours: monthlyHoursOf(classes),
    cells: SLOTS.map((slot) => planForToday[slot].some((lesson) => lesson.teacher === lecturer.name) ? 1 : 0),
    status: classes.length && lecturer.status === 'none' ? 'free' : lecturer.status,
  }
})

export const lecturerStore = createStore(LECTURERS)
export function updateLecturer(id, changes) {
  lecturerStore.set((lecturers) => lecturers.map((lecturer) => (
    lecturer.id === id ? { ...lecturer, ...changes } : lecturer
  )))
}
export const addLecturer = (lecturer) => lecturerStore.set((lecturers) => [...lecturers, lecturer])

const makeTeachingClass = (name, room, schedule, size, cap, status, extra) => ({ id: name, name, room, schedule, size, cap, status, ...extra })
export const TEACHING = Object.fromEntries(LECTURERS.map((lecturer) => [
  lecturer.id,
  lecturer.role === 'assistant'
    ? [makeTeachingClass('KID 2A', 'P.203', 'T2-T4-T6 · 17:00–19:00', 18, 20, 'open')]
    : CLASSES.filter((classItem) => classItem.teacher === lecturer.name).map((classItem) => ({
      id: classItem.id,
      name: classItem.name,
      room: classItem.room,
      schedule: `${classItem.days} · ${classItem.range}`,
      size: classItem.size,
      cap: classItem.cap,
      status: classItem.status,
      days: classItem.days.split('-'),
      slot: classItem.range.replace('–', ' – '),
    })),
]))
// Lớp có thể phân công thêm (Figma 12.5) — busy: lịch đang dạy của giảng viên dùng để kiểm tra trùng
export const ASSIGNABLE = [
  { value: 'KID 1C · Sắp khai giảng', days: ['T2', 'T4'], slot: '13:00 – 15:00', room: 'P.204' },
  { value: 'KINDY 1C · Sắp khai giảng', days: ['T3', 'T5'], slot: '15:00 – 17:00', room: 'P.301' },
]
export const ASSIGN_SLOTS = ['07:00 – 09:00', '09:00 – 11:00', '13:00 – 15:00', '15:00 – 17:00', '17:00 – 19:00', '19:00 – 21:00']
export const SPECIALTIES = ['KINDY', 'KID', 'TEEN']
export const CONTRACTS = ['Toàn thời gian', 'Bán thời gian', 'Thời vụ']
export const RATES = [90000, 200000, 220000, 230000, 250000, 300000].map((value) => ({ value: String(value), label: `${value.toLocaleString('vi-VN')}đ / giờ` }))
export const money = (value) => `${Number(value).toLocaleString('vi-VN')}đ / giờ`

// Lịch dạy theo tuần: slot → chỉ số ngày → buổi dạy; giữ đúng shape WeekGrid đang dùng.
const makeLesson = (name, room, status) => ({ name, room, status })
export const SCHEDULE = Object.fromEntries(LECTURERS.map((lecturer) => {
  if (lecturer.role === 'assistant') return [lecturer.id, {
    '17:00-19:00': { 0: makeLesson('KID 2A', 'P.203', 'attended'), 2: makeLesson('KID 2A', 'P.203', 'upcoming'), 4: makeLesson('KID 2A', 'P.203', 'upcoming') },
  }]
  const plan = {}
  DAYS.forEach((day, dayIndex) => {
    const lessons = lessonsOn(day.d)
    SLOTS.forEach((slot) => {
      const lesson = lessons[slot].find((item) => item.teacher === lecturer.name)
      if (!lesson) return
      if (!plan[slot]) plan[slot] = {}
      plan[slot][dayIndex] = makeLesson(lesson.name, lesson.room, lesson.status)
    })
  })
  return [lecturer.id, plan]
}))
