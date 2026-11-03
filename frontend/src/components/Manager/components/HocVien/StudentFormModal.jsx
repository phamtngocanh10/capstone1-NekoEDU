import { BookOpen, CircleCheck, CreditCard, Lock, Mail, MapPin, Phone, UserCheck, Users } from 'lucide-react'
import { FormModal } from '../../../../common/ui'
import { COURSES, COURSE_CLASSES, FEES, toFormValues } from './data'

const GENDERS = ['Nam', 'Nữ', 'Khác']

const buildFields = (editing, values) => [
  { name: 'fullName', label: 'Họ và tên học viên', icon: UserCheck, placeholder: 'Nguyễn Văn A', required: true },
  { name: 'birth', label: 'Ngày sinh', type: 'date' },
  { name: 'gender', label: 'Giới tính', type: 'radio', options: GENDERS, cols: 3 },
  { name: 'address', label: 'Địa chỉ', icon: MapPin, placeholder: 'Số nhà, đường, quận/huyện...' },
  { name: 'parentPhone', label: 'SĐT phụ huynh', icon: Phone, placeholder: '09xx xxx xxx', required: true },
  { name: 'email', label: 'Email liên hệ', icon: Mail, placeholder: 'email@vidu.com' },
  { name: 'course', label: 'Khóa học đăng ký', type: 'select', icon: BookOpen, options: COURSES, resets: ['className'] },
  { name: 'className', label: 'Lớp học', type: 'select', icon: Users, options: COURSE_CLASSES[values.course] ?? [] },
  { name: 'fee', label: 'Học phí kỳ đầu', type: 'select', icon: CreditCard, options: FEES },
  { name: 'password', label: 'Mật khẩu đăng nhập', type: 'password', icon: Lock, placeholder: editing ? 'Để trống nếu không đổi' : 'Tối thiểu 6 ký tự' },
  { name: 'note', label: 'Ghi chú tuyển sinh', type: 'textarea', placeholder: 'Kênh tuyển sinh, người giới thiệu...' },
]

// student = undefined → thêm mới (Figma 09.1) ; có student → sửa (Figma 09.7)
export default function StudentFormModal({ student, onSubmit, onClose }) {
  const editing = Boolean(student)
  return (
    <FormModal
      title={editing ? 'Sửa hồ sơ học viên' : 'Thêm học viên mới'}
      subtitle={editing ? `Cập nhật thông tin của ${student.name} (${student.id})` : 'Tạo hồ sơ tuyển sinh và ghi danh vào lớp học'}
      fields={(values) => buildFields(editing, values)}
      initial={editing ? toFormValues(student) : { gender: 'Nam', course: COURSES[0], className: COURSE_CLASSES[COURSES[0]][2], fee: FEES[0].value }}
      submitLabel={editing ? 'Lưu thay đổi' : 'Lưu hồ sơ'}
      submitIcon={CircleCheck}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  )
}
