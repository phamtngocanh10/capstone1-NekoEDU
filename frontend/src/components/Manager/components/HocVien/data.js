export const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'studying', label: 'Đang học' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'stopped', label: 'Ngừng học' },
]


export const STUDENTS = []
export const ATTENDANCE = []
export const COURSES = []
export const COURSE_CLASSES = {}
export const FEES = []
export const findStudent = (id, hint) => hint ?? null
export const toFormValues = (student) => ({
  fullName: student.name, birth: student.birth, gender: student.gender, address: student.address,
  parentPhone: student.parentPhone, parentName: student.parentName, parentRelationship: student.parentRelationship,
  email: student.email, course: student.course, className: student.className, fee: student.fee, password: '', note: student.note,
})
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
