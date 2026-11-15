import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FolderOpen,
  House,
  MessageSquare,
} from 'lucide-react';

export const MENU_ITEMS = [
  {
    path: 'trangchu',
    title: 'Trang chủ',
    icon: House,
    description: 'Cùng theo dõi hành trình học tập mỗi ngày',
  },
  {
    path: 'khoahoc',
    title: 'Khóa học của tôi',
    icon: BookOpen,
    description: 'Khóa học đang theo học và các khóa có thể đăng ký thêm',
  },
  {
    path: 'lichhoc',
    title: 'Lịch học',
    icon: CalendarDays,
    description: 'Theo dõi lịch học và các buổi học sắp tới',
  },
  {
    path: 'tailieu',
    title: 'Tài liệu',
    icon: FolderOpen,
    description: 'Thư viện tài liệu học tập được giảng viên chia sẻ',
  },
  {
    path: 'ketqua',
    title: 'Điểm danh & Kết quả',
    icon: ClipboardCheck,
    description: 'Chuyên cần, điểm số và nhận xét của giảng viên',
  },
  {
    path: 'hocphi',
    title: 'Học phí & Hóa đơn',
    icon: CreditCard,
    description: 'Theo dõi học phí, thời hạn và lịch sử hóa đơn',
  },
  {
    path: 'thongbao',
    title: 'Thông báo',
    icon: Bell,
    description: 'Thông tin mới từ trung tâm và giảng viên',
  },
  {
    path: 'danhgia',
    title: 'Phản hồi & Đánh giá',
    icon: MessageSquare,
    description: 'Chia sẻ trải nghiệm để mỗi buổi học tốt hơn',
  },
];

export function getPageInfo(pathname, student, account) {
  const pathSegments = pathname.split('/').filter(Boolean);
  const item = MENU_ITEMS.find((item) => item.path === pathSegments[1]);
  if (pathSegments[1] === 'thongtincanhan')
    return {
      title: 'Thông tin cá nhân',
      description: 'Quản lý hồ sơ và bảo mật tài khoản dùng chung',
    };
  if (pathSegments[1] === 'trangchu')
    return {
      title: 'Trang chủ',
      description: `Chào ${account.ten.split(' ').at(-1)} — cùng xem tình hình học tập của ${student.ten.split(' ').slice(-2).join(' ')} hôm nay`,
    };
  if (pathSegments.length > 2) {
    const pageTitle =
      pathSegments[3] === 'phanhoi'
        ? 'Phản hồi thông báo'
        : {
            khoahoc: 'Chi tiết khóa học',
            ketqua: 'Chi tiết bài kiểm tra',
            hocphi: 'Chi tiết hóa đơn',
            thongbao: 'Chi tiết thông báo',
          }[pathSegments[1]];
    if (pageTitle) return { title: pageTitle, description: item?.description };
  }
  return item ?? { title: 'NEKO EDU', description: 'Cổng thông tin Học viên / Phụ huynh' };
}
