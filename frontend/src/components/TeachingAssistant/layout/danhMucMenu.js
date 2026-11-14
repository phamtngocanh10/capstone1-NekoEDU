import { BookOpen, CalendarDays, ClipboardCheck, FilePenLine, LayoutDashboard } from 'lucide-react';

export const MENU_ITEMS = [
  {
    path: 'tongquan',
    label: 'Tổng quan',
    icon: LayoutDashboard,
    description: 'Lịch hỗ trợ và công việc hôm nay',
  },
  {
    path: 'lichhotro',
    label: 'Lịch hỗ trợ',
    icon: CalendarDays,
    description: 'Toàn bộ lịch hỗ trợ giảng dạy trong tuần',
  },
  {
    path: 'lophoc',
    label: 'Lớp được phân công',
    icon: BookOpen,
    description: 'Các lớp bạn đang hỗ trợ giảng dạy',
  },
  {
    path: 'diemdanh',
    label: 'Điểm danh hỗ trợ',
    icon: ClipboardCheck,
    description: 'Hỗ trợ điểm danh thủ công cho từng buổi học',
  },
  {
    path: 'chamdiem',
    label: 'Chấm điểm',
    icon: FilePenLine,
    description: 'Nhập điểm trong thời gian được giảng viên cấp quyền',
  },
];

const ADDITIONAL_PAGES = {
  '/assistant/thongtincanhan': {
    title: 'Thông tin cá nhân',
    description: 'Quản lý hồ sơ và bảo mật tài khoản',
  },
  '/assistant/thongbao': {
    title: 'Thông báo',
    description: 'Thông báo dành cho bạn từ trung tâm và giảng viên',
  },
  '/assistant/chamdiem/yeucau': {
    title: 'Yêu cầu của tôi',
    description: 'Yêu cầu nhập điểm và điểm đã gửi giảng viên duyệt',
  },
};

export function getPageInfo(path, classCount) {
  const activeItem = MENU_ITEMS.find((item) => path.startsWith(`/assistant/${item.path}`));
  const additionalPage = ADDITIONAL_PAGES[path];
  if (additionalPage) return { ...additionalPage, activeItem };

  return {
    activeItem,
    title: activeItem?.label ?? 'Trợ giảng',
    description:
      activeItem?.path === 'lophoc'
        ? `${classCount} lớp bạn đang hỗ trợ giảng dạy`
        : activeItem?.description,
  };
}
