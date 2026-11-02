import { MOCK_TODAY, lessonsOn } from '../LichPhanCong/data'
import { findClass } from '../KhoaHoc/data'

// Dữ liệu mẫu theo Figma (08-manager-tong-quan) — thay bằng getDashboard() (src/api/dashboard.js) khi có backend.
// Lớp học hôm nay lấy thẳng từ lịch (LichPhanCong) để hai màn hình luôn khớp nhau.
const timeOf = (c) => (c.time ?? c.slot).replace('-', '–')
export const TODAY_CLASSES = Object.values(lessonsOn(MOCK_TODAY))
  .flat()
  .map((c) => ({
    id: c.id, name: c.name, teacher: c.teacher, room: c.room, time: timeOf(c),
    size: `${c.students}/${findClass(c.name.toLowerCase().replace(/\s+/g, '-')).cap}`,
    done: c.status === 'attended',
  }))
  .sort((a, b) => a.time.localeCompare(b.time))

export const REQUESTS = [
  { id: 1, name: 'Nguyễn Gia Bảo', status: 'Đang học' },
  { id: 2, name: 'Đỗ Minh Anh', status: 'Đang học' },
  { id: 3, name: 'Trần Thị Lan', status: 'Đang học' },
]

// icon: khóa ánh xạ sang icon lucide trong index.jsx
export const RECENT = [
  { id: 1, icon: 'fee', text: 'Đã ghi nhận học phí tháng 9 cho lớp KID TEEN 1B', time: '10 phút trước' },
  { id: 2, icon: 'upload', text: 'Giảng viên Lê Anh Dũng tải lên bảng điểm mới', time: '1 giờ trước' },
  { id: 3, icon: 'student', text: '3 học viên mới hoàn tất tuyển sinh', time: '3 giờ trước' },
  { id: 4, icon: 'chat', text: 'Phụ huynh Nguyễn Văn Hùng gửi phản hồi mới', time: '5 giờ trước' },
]
