import { CLASSES, COURSES as COURSE_LIST } from '../KhoaHoc/data'

// Dữ liệu mẫu theo Figma (09-manager-hoc-vien-*) — thay bằng src/api/students.js khi có backend.
export const STUDENTS = [
  { id: 'HV20260142', name: 'Nguyễn Minh Anh', className: 'KID 2A', joined: '21/08/2026', tuition: 'paid', status: 'studying' },
  { id: 'HV20260098', name: 'Trần Gia Bảo', className: 'KID 1B', joined: '14/07/2026', tuition: 'overdue', status: 'studying' },
  { id: 'HV20260201', name: 'Đỗ Khánh Linh', className: 'KINDY 1A', joined: '02/09/2026', tuition: 'paid', status: 'studying' },
  { id: 'HV20260055', name: 'Lê Hoàng Phúc', className: 'KID 3B', joined: '10/06/2026', tuition: 'paid', status: 'studying' },
  { id: 'HV20259871', name: 'Phạm Thu Uyên', className: 'KID 2B', joined: '28/03/2026', tuition: 'paid', status: 'studying' },
  { id: 'HV20260177', name: 'Vũ Đăng Khoa', className: 'KID 2A', joined: '21/08/2026', tuition: 'paid', status: 'studying' },
  { id: 'HV20260033', name: 'Ngô Bảo Trâm', className: 'KID 1B', joined: '05/05/2026', tuition: 'overdue', status: 'studying' },
]

export const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'studying', label: 'Đang học' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'stopped', label: 'Ngừng học' },
]

export const COURSES = COURSE_LIST.map((course) => course.name)
export const COURSE_CLASSES = Object.fromEntries(COURSE_LIST.map((course) => [course.name, CLASSES.filter((classItem) => classItem.courseId === course.id).map((classItem) => classItem.name)]))
export const FEES = [
  { value: '2400000', label: '2.400.000đ (mặc định)' },
  { value: '2800000', label: '2.800.000đ' },
  { value: '3200000', label: '3.200.000đ' },
]
const courseOf = (className) => COURSES.find((course) => COURSE_CLASSES[course].includes(className)) ?? COURSES[0]

// Thông tin chi tiết dùng cho form sửa + trang hồ sơ (09.3). Học viên chưa có dữ liệu → dùng giá trị trống.
const DETAILS = {
  HV20260142: {
    birth: '12/05/2016', gender: 'Nữ', address: '12 Lê Duẩn, Hải Châu, Đà Nẵng', parent: 'Chị Trần Thị Mai',
    parentPhone: '0901 234 142', email: 'mai.nguyen@gmail.com', fee: '2400000', note: 'Đăng ký qua giới thiệu của phụ huynh.',
  },
}

export function findStudent(id, hint) {
  const base = STUDENTS.find((student) => student.id === id) ?? { id, name: hint?.name ?? `Học viên ${id}`, className: hint?.className ?? '—', joined: '—', tuition: 'paid', status: 'studying' }
  return { gender: 'Nam', birth: '', address: '', parent: '', parentPhone: '', email: '', fee: '2400000', note: '', ...DETAILS[id], ...base }
}

export const toFormValues = (student) => ({
  fullName: student.name, birth: student.birth, gender: student.gender, address: student.address, parentPhone: student.parentPhone, email: student.email,
  course: courseOf(student.className), className: student.className, fee: student.fee, password: '', note: student.note,
})

export const ATTENDANCE = [
  ['21/08', 'Có mặt'], ['24/08', 'Có mặt'], ['26/08', 'Có mặt'], ['28/08', 'Có mặt'], ['31/08', 'Đi muộn', true],
  ['02/09', 'Có mặt'], ['04/09', 'Có mặt'], ['07/09', 'Có mặt'], ['09/09', 'Có mặt'], ['11/09', 'Có mặt'], ['14/09', 'Có mặt'],
]

export const EXPORT_FIELDS = [
  { key: 'id', label: 'Mã học viên', locked: true },
  { key: 'name', label: 'Họ và tên', locked: true },
  { key: 'birth', label: 'Ngày sinh' },
  { key: 'contact', label: 'SĐT / Email phụ huynh' },
  { key: 'className', label: 'Lớp đang học' },
  { key: 'joined', label: 'Ngày nhập học' },
  { key: 'tuition', label: 'Học phí (trạng thái)' },
  { key: 'status', label: 'Trạng thái học' },
]
