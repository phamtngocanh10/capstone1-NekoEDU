import { BookOpen, CircleCheck, CreditCard, Lock, Mail, MapPin, Phone, UserCheck, Users } from 'lucide-react'
import { FormModal } from '../../../../common/ui'
import { toFormValues } from './data'
import { academicStore } from '../KhoaHoc/data'

const GENDERS = ['Nam', 'Nữ', 'Khác']

const GUARDIAN_RELATIONSHIPS = [
  { value: 'FATHER', label: 'Bố' },
  { value: 'MOTHER', label: 'Mẹ' },
  { value: 'GUARDIAN', label: 'Người giám hộ' },
]

const buildFields = (editing, values, courses, classes, fees) => [
  { name: 'fullName', label: 'Họ và tên học viên', icon: UserCheck, placeholder: 'Nguyễn Văn A', required: true },
  { name: 'birth', label: 'Ngày sinh', type: 'date', required: !editing },
  { name: 'gender', label: 'Giới tính', type: 'radio', options: GENDERS, cols: 3 },
  { name: 'address', label: 'Địa chỉ', icon: MapPin, placeholder: 'Số nhà, đường, quận/huyện...' },
  { name: 'parentPhone', label: 'SĐT phụ huynh', icon: Phone, placeholder: '09xx xxx xxx', required: true },
  ...(!editing ? [
    { name: 'parentName', label: 'Họ tên phụ huynh', icon: Users, placeholder: 'Nguyễn Văn B', required: true },
    { name: 'parentRelationship', label: 'Quan hệ với học viên', type: 'select', icon: Users, options: GUARDIAN_RELATIONSHIPS, placeholder: 'Chọn quan hệ', required: true },
  ] : []),
  { name: 'email', label: 'Email liên hệ', icon: Mail, placeholder: 'email@vidu.com' },
  { name: 'course', label: 'Khóa học đăng ký', type: 'select', icon: BookOpen, options: courses.map((item) => ({ value: String(item.id), label: item.name })), resets: ['className'] },
  { name: 'className', label: 'Lớp học', type: 'select', icon: Users, options: classes.filter((item) => String(item.sqlCourseId) === values.course && (item.enrollable || (editing && item.name === values.className))).map((item) => item.name) },
  { name: 'fee', label: 'Học phí kỳ đầu', type: 'select', icon: CreditCard, options: fees.length ? fees : [{ value: '', label: 'Chưa có chính sách học phí' }] },
  { name: 'password', label: 'Mật khẩu đăng nhập', type: 'password', icon: Lock, placeholder: editing ? 'Để trống nếu không đổi' : 'Tối thiểu 8 ký tự' },
  { name: 'note', label: 'Ghi chú tuyển sinh', type: 'textarea', placeholder: 'Kênh tuyển sinh, người giới thiệu...' },
]

// student = undefined → thêm mới (Figma 09.1) ; có student → sửa (Figma 09.7)
export default function StudentFormModal({ student, onSubmit, onClose }) {
  const editing = Boolean(student)
  const { courses, classes, catalog } = academicStore.use()
  const firstClass = classes.find((item) => item.enrollable)
  const matchedCourses = catalog.courses.filter((item) => item.levelId === student?.levelId)
  const selectedCourse = student?.sqlCourseId ?? (matchedCourses.length === 1 ? matchedCourses[0].id : undefined)
  const initialStudent = student ? { ...toFormValues(student), course: String(selectedCourse ?? ''), className: student.classId ? student.className : '' } : null
  return (
    <FormModal
      title={editing ? 'Sửa hồ sơ học viên' : 'Thêm học viên mới'}
      subtitle={editing ? `Cập nhật thông tin của ${student.name} (${student.id})` : 'Tạo hồ sơ tuyển sinh và ghi danh vào lớp học'}
      fields={(values) => buildFields(editing, values, catalog.courses, classes, catalog.fees)}
      initial={editing ? initialStudent : { gender: 'Nam', course: String(firstClass?.sqlCourseId ?? catalog.courses[0]?.id ?? ''), className: firstClass?.name ?? '', fee: catalog.fees[0]?.value ?? '' }}
      submitLabel={editing ? 'Lưu thay đổi' : 'Lưu hồ sơ'}
      submitIcon={CircleCheck}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  )
}
