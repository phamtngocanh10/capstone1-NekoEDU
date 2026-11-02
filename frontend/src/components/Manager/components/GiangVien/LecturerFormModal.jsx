import { BookOpen, Calendar, CreditCard, Lock, Mail, MapPin, Phone, User } from 'lucide-react'
import { FormModal } from '../../../../common/ui'
import { CONTRACTS, RATES, ROLE_LABEL, SPECIALTIES } from './data'

const FIELDS = [
  { name: 'fullName', label: 'Họ và tên', icon: User, placeholder: 'Nguyễn Văn A', required: true },
  { name: 'birth', label: 'Ngày sinh', type: 'date' },
  { name: 'gender', label: 'Giới tính', type: 'radio', options: ['Nam', 'Nữ', 'Khác'], cols: 3 },
  { name: 'address', label: 'Địa chỉ', icon: MapPin, placeholder: 'Số nhà, đường, quận/huyện...' },
  { name: 'phone', label: 'SĐT', icon: Phone, placeholder: '09xx xxx xxx', required: true },
  { name: 'email', label: 'Email đăng nhập', icon: Mail, placeholder: 'email@gmail.com', required: true },
  { name: 'role', label: 'Vai trò', type: 'select', icon: User, options: Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label })) },
  { name: 'specialty', label: 'Chuyên môn', type: 'select', icon: BookOpen, options: SPECIALTIES },
  { name: 'password', label: 'Mật khẩu đăng nhập', type: 'password', icon: Lock, placeholder: 'Tối thiểu 6 ký tự' },
  { name: 'contract', label: 'Loại hợp đồng', type: 'select', icon: Calendar, options: CONTRACTS },
  { name: 'rate', label: 'Lương theo giờ', type: 'select', icon: CreditCard, options: RATES },
  { name: 'joined', label: 'Ngày bắt đầu', type: 'date' },
]

// lecturer = undefined → Thêm giảng viên mới (Figma 12.1) ; có lecturer → Sửa thông tin (Figma 12.3)
export default function LecturerFormModal({ lecturer, onSubmit, onClose }) {
  const editing = Boolean(lecturer)
  const initial = editing
    ? { fullName: lecturer.name, birth: lecturer.birth, gender: lecturer.gender, address: lecturer.address, phone: lecturer.phone, email: lecturer.email, role: lecturer.role, specialty: lecturer.specialty, contract: lecturer.contract, rate: String(lecturer.rate), joined: lecturer.joined }
    : { gender: 'Nam', role: 'lecturer', specialty: SPECIALTIES[0], contract: CONTRACTS[0], rate: '250000' }
  return (
    <FormModal
      title={editing ? 'Sửa thông tin giảng viên' : 'Thêm giảng viên mới'}
      subtitle={editing ? `Cập nhật hồ sơ ${lecturer.id} · ${lecturer.name}` : 'Tạo hồ sơ giảng viên / trợ giảng và cấp tài khoản đăng nhập'}
      fields={FIELDS}
      initial={initial}
      cancelVariant="ghost"
      submitLabel={editing ? 'Lưu thay đổi' : 'Lưu hồ sơ'}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  )
}
