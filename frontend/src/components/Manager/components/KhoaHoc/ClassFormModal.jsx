import { BookOpen, Calendar, MapPin, CirclePlus, UserCheck, Users } from 'lucide-react'
import { FormModal } from '../../../../common/ui'
import { academicStore, TIME_SLOTS } from './data'

// Figma 10.3 — Tạo lớp học mới (Figma có 2 ô "Phòng học" trùng nhau, ở đây chỉ giữ một).
export default function ClassFormModal({ course, onSubmit, onClose }) {
  const { catalog } = academicStore.use()
  const fields = [
  { name: 'course', label: 'Khóa học', type: 'select', icon: BookOpen, options: catalog.courses.map((c) => ({ value: String(c.id), label: c.name })) },
  { name: 'teacher', label: 'Giảng viên phụ trách', type: 'select', icon: UserCheck, options: catalog.staff.filter((item) => item.position === 'LECTURER').map((item) => ({ value: String(item.id), label: item.name })), placeholder: 'Chưa chọn' },
  { name: 'name', label: 'Tên lớp học', icon: BookOpen, placeholder: 'VD: KINDY 1C hoặc KID 2C', required: true, full: true },
  { name: 'room', label: 'Phòng học', type: 'select', icon: MapPin, options: catalog.rooms.map((item) => item.code), placeholder: 'Chưa chọn' },
  { name: 'cap', label: 'Sĩ số tối đa', type: 'number', icon: Users, placeholder: '20' },
  { name: 'days', label: 'Lịch học trong tuần', type: 'days' },
  { name: 'slot', label: 'Khung giờ', type: 'select', icon: Calendar, options: TIME_SLOTS },
  { name: 'start', label: 'Ngày khai giảng', type: 'date' },
]


  return (
    <FormModal
      title="Tạo lớp học mới"
      subtitle="Mở lớp mới thuộc một khóa học đã có sẵn"
      fields={fields}
      initial={{ course: String(catalog.courses.find((item) => item.groupId === course?.id)?.id ?? catalog.courses[0]?.id ?? ''), cap: 20, days: ['T2', 'T4', 'T6'], slot: TIME_SLOTS[4] }}
      submitLabel="Tạo lớp"
      submitIcon={CirclePlus}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  )
}
