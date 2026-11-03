import { LayoutDashboard, CalendarDays, BookOpen, ClipboardCheck, FileSpreadsheet, FolderOpen, MessageSquare, Users } from 'lucide-react';

export const DANH_SACH_MENU = [
  { path: 'tongquan', label: 'Tổng quan', icon: LayoutDashboard, subtitle: 'Lịch giảng dạy và công việc hôm nay' },
  { path: 'lichgiangday', label: 'Lịch giảng dạy', icon: CalendarDays, subtitle: 'Toàn bộ lịch đứng lớp trong tuần của bạn' },
  { path: 'lophoc', label: 'Lớp học của tôi', icon: BookOpen, subtitle: 'Các lớp đang phụ trách trong học kỳ này' },
  { path: 'diemdanh', label: 'Điểm danh', icon: ClipboardCheck, subtitle: 'Đánh dấu điểm danh thủ công cho từng buổi học' },
  { path: 'bangdiem', label: 'Bảng điểm', icon: FileSpreadsheet, subtitle: 'Nhập điểm trực tiếp hoặc tải file Excel, rồi xác nhận để công bố' },
  { path: 'tailieu', label: 'Tài liệu học tập', icon: FolderOpen, subtitle: 'Tài liệu đã tải lên cho các lớp đang phụ trách' },
  { path: 'nhanxet', label: 'Nhận xét học viên', icon: MessageSquare, subtitle: 'Ghi nhận xét để học viên và phụ huynh theo dõi tiến bộ' },
  { path: 'trogiang', label: 'Trợ giảng', icon: Users, subtitle: 'Quản lý trợ giảng, quyền nhập điểm và yêu cầu chờ duyệt' },
];
