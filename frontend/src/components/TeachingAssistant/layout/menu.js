import { BookOpen, CalendarDays, ClipboardCheck, FilePenLine, LayoutDashboard } from 'lucide-react';

export const CAC_MUC_MENU = [
  { duongDan: 'tongquan', nhan: 'Tổng quan', bieuTuong: LayoutDashboard, moTa: 'Lịch hỗ trợ và công việc hôm nay' },
  { duongDan: 'lichhotro', nhan: 'Lịch hỗ trợ', bieuTuong: CalendarDays, moTa: 'Toàn bộ lịch hỗ trợ giảng dạy trong tuần' },
  { duongDan: 'lophoc', nhan: 'Lớp được phân công', bieuTuong: BookOpen, moTa: 'Các lớp bạn đang hỗ trợ giảng dạy' },
  { duongDan: 'diemdanh', nhan: 'Điểm danh hỗ trợ', bieuTuong: ClipboardCheck, moTa: 'Hỗ trợ điểm danh thủ công cho từng buổi học' },
  { duongDan: 'chamdiem', nhan: 'Chấm điểm', bieuTuong: FilePenLine, moTa: 'Nhập điểm trong thời gian được giảng viên cấp quyền' },
];

const TRANG_BO_SUNG = {
  '/assistant/thongtincanhan': {
    tieuDe: 'Thông tin cá nhân',
    moTa: 'Quản lý hồ sơ và bảo mật tài khoản',
  },
  '/assistant/thongbao': {
    tieuDe: 'Thông báo',
    moTa: 'Thông báo dành cho bạn từ trung tâm và giảng viên',
  },
  '/assistant/chamdiem/yeucau': {
    tieuDe: 'Yêu cầu của tôi',
    moTa: 'Yêu cầu nhập điểm và điểm đã gửi giảng viên duyệt',
  },
};

export function layThongTinTrang(duongDan, soLop) {
  const mucHienTai = CAC_MUC_MENU.find(muc => duongDan.startsWith(`/assistant/${muc.duongDan}`));
  const trangBoSung = TRANG_BO_SUNG[duongDan];
  if (trangBoSung) return { ...trangBoSung, mucHienTai };

  return {
    mucHienTai,
    tieuDe: mucHienTai?.nhan ?? 'Trợ giảng',
    moTa: mucHienTai?.duongDan === 'lophoc'
      ? `${soLop} lớp bạn đang hỗ trợ giảng dạy`
      : mucHienTai?.moTa,
  };
}
