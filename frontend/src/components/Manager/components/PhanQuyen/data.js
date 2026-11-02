import createStore from '../../../../common/createStore'

// Dữ liệu mẫu theo Figma (18.0–18.7) — thay bằng src/api/accounts.js khi có backend.
export const ROLES = ['Manager', 'Lecturer', 'Teaching Assistant', 'Student / Parent']
export const ROLE_TONE = { Manager: 'blue', Lecturer: 'gray', 'Teaching Assistant': 'green', 'Student / Parent': 'amber' }

export const accountStore = createStore([
  { id: 'a1', name: 'Phạm Thị Ngọc Anh', email: 'manager@neko.edu.vn', role: 'Manager', status: 'active', last: 'Hôm nay 08:02', self: true },
  { id: 'a2', name: 'Trần Minh Khôi', email: 'khoi.tran@neko.edu.vn', role: 'Lecturer', status: 'active', last: 'Hôm nay 07:45' },
  { id: 'a3', name: 'Lê Anh Dũng', email: 'dung.le@neko.edu.vn', role: 'Lecturer', status: 'active', last: 'Hôm qua 21:10' },
  { id: 'a4', name: 'Phạm Thu Hà', email: 'ha.pham@neko.edu.vn', role: 'Lecturer', status: 'active', last: 'Hôm nay 08:30' },
  { id: 'a5', name: 'Đặng Quốc Bảo', email: 'bao.dang@neko.edu.vn', role: 'Lecturer', status: 'locked', last: 'Chưa đăng nhập' },
  { id: 'a6', name: 'Nguyễn Thảo Vy', email: 'vy.nguyen@neko.edu.vn', role: 'Teaching Assistant', status: 'active', last: 'Hôm nay 16:55' },
  { id: 'a7', name: 'Lê Minh Quân', email: 'quan.le@neko.edu.vn', role: 'Teaching Assistant', status: 'active', last: '12/09 09:20' },
  { id: 'a8', name: 'Nguyễn Thị Mai', email: 'mai.nguyen@gmail.com', role: 'Student / Parent', status: 'active', last: 'Hôm nay 07:12' },
])
export const patchAccount = (id, patch) => accountStore.set((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)))

export const LOCK_REASONS = ['Nghỉ phép dài ngày', 'Nghi ngờ truy cập bất thường', 'Vi phạm quy định trung tâm', 'Theo yêu cầu của người dùng', 'Lý do khác']

// Ma trận quyền: 2 = được phép, 1 = có điều kiện (xem ghi chú), 0 = không được phép. Cột: Xem, Thêm, Sửa, Xóa.
export const FUNCTIONS = ['Học viên (hồ sơ)', 'Khóa học & lớp học', 'Lịch', 'Điểm danh', 'Điểm số (nhập điểm)', 'Trợ giảng', 'Tài liệu học tập', 'Nhận xét học viên', 'Quản trị trung tâm']
const row = (perms, note = '') => ({ perms, note })
const ALL = [2, 2, 2, 2], VIEW = [2, 0, 0, 0], NONE = [0, 0, 0, 0], EDIT = [2, 2, 2, 0]
export const DEFAULT_MATRIX = {
  Manager: [row(ALL, 'Toàn trung tâm'), row(ALL, 'Toàn trung tâm'), row(ALL, 'Xếp lịch & phân công'), row(ALL, 'Mọi lớp'), row([2, 0, 2, 0], 'Đặt thời gian · không sửa điểm của giảng viên'), row(ALL), row(ALL), row(ALL), row(ALL, 'Học phí, thu chi, tuyển sinh, giảng viên, phân quyền')],
  Lecturer: [row(VIEW, 'Chỉ học viên trong lớp mình dạy'), row(VIEW, 'Chỉ lớp mình phụ trách'), row(VIEW, 'Xem lịch giảng dạy của mình'), row(EDIT, 'Lớp mình dạy'), row(EDIT, 'Trong thời gian Manager đặt · xác nhận để công bố'), row(ALL, 'Mở quyền nhập điểm · duyệt điểm trợ giảng nhập'), row(ALL, 'Tài liệu của mình'), row(EDIT), row(NONE, 'Học phí, thu chi, tuyển sinh, giảng viên, phân quyền')],
  'Teaching Assistant': [row(VIEW, 'Chỉ lớp được phân công'), row(VIEW, 'Chỉ lớp được phân công'), row(VIEW, 'Xem lịch hỗ trợ của mình'), row(EDIT, 'Điểm danh hỗ trợ'), row([1, 1, 1, 0], 'Chỉ khi giảng viên mở quyền · điểm cần giảng viên duyệt'), row(NONE, 'Chỉ giảng viên quản lý trợ giảng'), row([2, 2, 0, 0], 'Tải lên khi được giao'), row(VIEW), row(NONE, 'Học phí, thu chi, tuyển sinh, giảng viên, phân quyền')],
  'Student / Parent': [row(VIEW, 'Chỉ hồ sơ của mình / con'), row(VIEW, 'Lớp đang theo học'), row(VIEW, 'Lịch học của mình'), row(VIEW, 'Xem điểm danh của mình'), row(VIEW, 'Chỉ khi điểm đã công bố'), row(NONE), row(VIEW, 'Tải về tài liệu lớp mình'), row(VIEW, 'Nhận xét dành cho mình'), row(NONE, 'Học phí, thu chi, tuyển sinh, giảng viên, phân quyền')],
}
