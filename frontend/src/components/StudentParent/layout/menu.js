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

export const cacmucmenu = [
  {
    duongDan: 'trangchu',
    ten: 'Trang chủ',
    bieuTuong: House,
    moTa: 'Cùng theo dõi hành trình học tập mỗi ngày',
  },
  {
    duongDan: 'khoahoc',
    ten: 'Khóa học của tôi',
    bieuTuong: BookOpen,
    moTa: 'Khóa học đang theo học và các khóa có thể đăng ký thêm',
  },
  {
    duongDan: 'lichhoc',
    ten: 'Lịch học',
    bieuTuong: CalendarDays,
    moTa: 'Theo dõi lịch học và các buổi học sắp tới',
  },
  {
    duongDan: 'tailieu',
    ten: 'Tài liệu',
    bieuTuong: FolderOpen,
    moTa: 'Thư viện tài liệu học tập được giảng viên chia sẻ',
  },
  {
    duongDan: 'ketqua',
    ten: 'Điểm danh & Kết quả',
    bieuTuong: ClipboardCheck,
    moTa: 'Chuyên cần, điểm số và nhận xét của giảng viên',
  },
  {
    duongDan: 'hocphi',
    ten: 'Học phí & Hóa đơn',
    bieuTuong: CreditCard,
    moTa: 'Theo dõi học phí, thời hạn và lịch sử hóa đơn',
  },
  {
    duongDan: 'thongbao',
    ten: 'Thông báo',
    bieuTuong: Bell,
    moTa: 'Thông tin mới từ trung tâm và giảng viên',
  },
  {
    duongDan: 'danhgia',
    ten: 'Phản hồi & Đánh giá',
    bieuTuong: MessageSquare,
    moTa: 'Chia sẻ trải nghiệm để mỗi buổi học tốt hơn',
  },
];

export function laytieudetrang(duongdan, hocvien, taikhoan) {
  const cacphan = duongdan.split('/').filter(Boolean);
  const muc = cacmucmenu.find((muc) => muc.duongDan === cacphan[1]);
  if (cacphan[1] === 'thongtincanhan')
    return { ten: 'Thông tin cá nhân', moTa: 'Quản lý hồ sơ và bảo mật tài khoản dùng chung' };
  if (cacphan[1] === 'trangchu')
    return {
      ten: 'Trang chủ',
      moTa: `Chào ${taikhoan.ten.split(' ').at(-1)} — cùng xem tình hình học tập của ${hocvien.ten.split(' ').slice(-2).join(' ')} hôm nay`,
    };
  if (cacphan.length > 2) {
    const tentrang =
      cacphan[3] === 'phanhoi'
        ? 'Phản hồi thông báo'
        : {
            khoahoc: 'Chi tiết khóa học',
            ketqua: 'Chi tiết bài kiểm tra',
            hocphi: 'Chi tiết hóa đơn',
            thongbao: 'Chi tiết thông báo',
          }[cacphan[1]];
    if (tentrang) return { ten: tentrang, moTa: muc?.moTa };
  }
  return muc ?? { ten: 'NEKO EDU', moTa: 'Cổng thông tin Học viên / Phụ huynh' };
}
