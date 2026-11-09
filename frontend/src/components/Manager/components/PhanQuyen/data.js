import { getAccounts } from '../../../../api/accounts'
import createStore from '../../../../common/createStore'

export const ROLES = ['Manager', 'Lecturer', 'Teaching Assistant', 'Student / Parent']
export const ROLE_TONE = { Manager: 'blue', Lecturer: 'gray', 'Teaching Assistant': 'green', 'Student / Parent': 'amber' }

export const accountStore = createStore([])
export const loadAccounts = async () => {
  const accounts = await getAccounts()
  accountStore.set(accounts)
  return accounts
}

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
