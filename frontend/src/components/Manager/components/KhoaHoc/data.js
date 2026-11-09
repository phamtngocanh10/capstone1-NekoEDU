import createStore from '../../../../common/createStore'
import { getCatalog, getClasses, getCourses } from '../../../../api/courses'

export const academicStore = createStore({ courses: [], classes: [], catalog: { courses: [], rooms: [], staff: [], fees: [] } })
export const loadAcademic = async () => {
  const [courses, classes, catalog] = await Promise.all([getCourses(), getClasses(), getCatalog()])
  academicStore.set({ courses, classes, catalog })
  return { courses, classes, catalog }
}
export const apiError = (error) => error.response?.data?.message || error.message || 'Không lưu được dữ liệu'
export const LEVELS = [1, 2, 3]
export const courseById = (id) => academicStore.get().courses.find((c) => c.id === id)

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


export const COURSES = []
export const CLASSES = []
export const ROSTER = []
export const LECTURER_NAMES = []
export const ROOMS = []
export const rowsOfCourse = (id) => academicStore.get().classes.filter((item) => item.courseId === id)
export const findClass = (id) => academicStore.get().classes.find((item) => item.id === id)
export const TIME_SLOTS = ['07:00 – 08:30', '09:00 – 10:30', '13:00 – 14:30', '15:30 – 17:00', '18:00 – 19:30', '19:30 – 21:00']
