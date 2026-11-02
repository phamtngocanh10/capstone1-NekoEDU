import {
  ChartColumn,
  UserCheck,
  BookOpen,
  CalendarDays,
  Presentation,
  ClipboardCheck,
  CreditCard,
  Wallet,
  Bell,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

// Dùng chung cho Sidebar và tiêu đề Header. Path phải khớp route trong router/index.jsx.
// Tiêu đề/mô tả khớp Figma (CAP__2_.fig). Trang con đặt tiêu đề riêng bằng usePageHeader().
export const MENU = [
  { path: "/tongquan", label: "Tổng quan", icon: ChartColumn, subtitle: "Chào buổi sáng, đây là tình hình trung tâm hôm nay" },
  { path: "/hocvien", label: "Học viên", icon: UserCheck, subtitle: "Quản lý hồ sơ và thông tin học viên" },
  { path: "/khoahoc", label: "Khóa học & Lớp học", icon: BookOpen, subtitle: "Chương trình học, lớp học và sắp xếp phòng" },
  { path: "/lichphancong", label: "Lịch", icon: CalendarDays, subtitle: "Xếp lịch lớp học, phòng và phân công giảng viên / trợ giảng" },
  { path: "/giangvien", label: "Giảng viên", icon: Presentation, subtitle: "Danh sách giảng viên, trợ giảng và khối lượng giảng dạy" },
  { path: "/diemdanh", label: "Điểm số", icon: ClipboardCheck, subtitle: "Thiết lập thời gian nhập điểm và theo dõi tiến độ theo khóa học" },
  { path: "/hocphi", label: "Học phí", icon: CreditCard, subtitle: "Theo dõi thu học phí và các khoản công nợ còn tồn" },
  { path: "/thuchi", label: "Thu chi", icon: Wallet, subtitle: "Sổ quỹ trung tâm và bảng lương theo giờ dạy" },
  { path: "/thongbao", label: "Thông báo", icon: Bell, subtitle: "Soạn và gửi thông báo cho học viên và phụ huynh" },
  { path: "/tuyensinh", label: "Tuyển sinh", icon: Sparkles, subtitle: "Dự báo và đề xuất từ AI dựa trên dữ liệu thị trường và dữ liệu trung tâm" },
  { path: "/phanquyen", label: "Phân quyền & Cài đặt", icon: ShieldCheck, subtitle: "Ma trận quyền theo vai trò và quản lý tài khoản hệ thống" },
];

// Trang không nằm trên sidebar nhưng vẫn cần tiêu đề ở Header.
export const EXTRA_PAGES = [
  {
    path: "/thongtincanhan",
    label: "Thông tin cá nhân",
    subtitle: "Quản lý hồ sơ và bảo mật tài khoản của bạn",
  },
];
