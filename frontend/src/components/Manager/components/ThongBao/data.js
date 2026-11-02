import createStore from '../../../../common/createStore'

// Dữ liệu mẫu theo Figma (16.0–16.2) — thay bằng src/api/announcements.js khi có backend.
export const STATUS = {
  sent: { label: 'Đã gửi', tone: 'green' },
  scheduled: { label: 'Hẹn giờ', tone: 'amber' },
  draft: { label: 'Bản nháp', tone: 'gray' },
}
export const announceStore = createStore([
  { id: 'ann-1', title: 'Khai giảng lớp KID TEEN 3B khóa mới', meta: 'Tất cả học viên · Hẹn giờ 25/09/2026 08:00 · 1 tệp', status: 'scheduled', read: null, audience: 'Tất cả học viên' },
  { id: 'ann-2', title: 'Bảo trì hệ thống 23h00 – 24h00', meta: 'Tất cả tài khoản · 13/09/2026', status: 'sent', read: 46, audience: 'Tất cả tài khoản' },
  { id: 'ann-3', title: 'Lịch thi giữa kỳ KID TEEN 2A', meta: 'Lớp KID TEEN 2A · 12/09/2026 · 2 tệp', status: 'sent', read: 100, audience: 'Lớp KID TEEN 2A' },
  { id: 'ann-4', title: 'Nhắc học phí tháng 9 sắp đến hạn', meta: 'Học viên chưa đóng phí · 10/09/2026 · 1 tệp', status: 'sent', read: 83, audience: 'Học viên chưa đóng phí' },
  { id: 'ann-5', title: 'Nghỉ lễ Quốc khánh 2/9, học bù ngày 6/9', meta: 'Tất cả học viên · 02/09/2026 · 1 tệp', status: 'sent', read: 97, audience: 'Tất cả học viên' },
  { id: 'ann-6', title: 'Hướng dẫn thanh toán học phí online', meta: 'Học viên chưa đóng phí · Chưa gửi', status: 'draft', read: null, audience: 'Học viên chưa đóng phí' },
])
export const TEMPLATES = [
  { id: 't1', letter: 'H', title: 'Nhắc học phí tháng 9', desc: 'Gửi phụ huynh có học phí đến hạn', content: 'Kính gửi Quý phụ huynh, học phí tháng 9 của học viên sẽ đến hạn vào ngày 20/09/2026. Vui lòng thanh toán qua ứng dụng hoặc tại quầy lễ tân. Trân trọng, NEKO Edu.' },
  { id: 't2', letter: 'N', title: 'Thông báo nghỉ lễ', desc: 'Gửi tất cả học viên · kèm lịch học bù', content: 'Trung tâm thông báo lịch nghỉ lễ và lịch học bù như sau: ...' },
  { id: 't3', letter: 'L', title: 'Lịch thi giữa kỳ', desc: 'Gửi theo lớp · kèm tệp đính kèm', content: 'Kính gửi Quý phụ huynh và các bạn học viên, NEKO Edu thông báo lịch thi giữa kỳ như sau: ...' },
  { id: 't4', letter: 'T', title: 'Hướng dẫn thanh toán online', desc: 'Gửi học viên chưa đóng phí', content: 'Hướng dẫn thanh toán học phí online qua ứng dụng NEKO Edu: ...' },
]
export const TYPES = ['Lịch học', 'Học phí', 'Điểm số', 'Sự kiện', 'Hệ thống']
export const CLASS_TARGETS = [
  { name: 'KID TEEN 2A', n: 18 }, { name: 'KID TEEN 3B', n: 14 }, { name: 'KID TEEN 1B', n: 16 }, { name: 'KINDY 2A', n: 12 },
]

// Chi tiết thông báo "Nhắc học phí tháng 9 sắp đến hạn" (Figma 16.2)
export const RECIPIENTS = [
  { id: 1, name: 'Trần Gia Bảo', className: 'KID TEEN 1B', at: '08:12', read: true },
  { id: 2, name: 'Ngô Bảo Trâm', className: 'KID TEEN 1B', at: '08:30', read: true },
  { id: 3, name: 'Nguyễn Gia Bảo', className: 'KID TEEN 2A', at: '09:05', read: true },
  { id: 4, name: 'Đỗ Minh Anh', className: 'KID TEEN 3B', at: '—', read: false },
  { id: 5, name: 'Lê Hoàng Phúc', className: 'KID TEEN 3B', at: '10:41', read: true },
  { id: 6, name: 'Vũ Đăng Khoa', className: 'KID TEEN 2A', at: '—', read: false },
  { id: 7, name: 'Bùi Thanh Tùng', className: 'KID TEEN 2A', at: '11:20', read: true },
]
export const REPLIES = [
  { id: 1, name: 'Chị Trần Thị Mai', at: '09:20', text: 'Đã chuyển khoản sáng nay, nhờ trung tâm kiểm tra giúp.' },
  { id: 2, name: 'Anh Ngô Văn Hùng', at: '10:05', text: 'Cho tôi xin gia hạn đến 25/09 được không ạ?' },
  { id: 3, name: 'Chị Lê Thu Hà', at: '11:48', text: 'Cảm ơn trung tâm, tôi sẽ thanh toán trước hạn.' },
]
export const DETAIL_TEXT = 'Kính gửi Quý phụ huynh, học phí tháng 9 của học viên sẽ đến hạn vào ngày 20/09/2026. Vui lòng thanh toán qua ứng dụng hoặc tại quầy lễ tân. Trân trọng, NEKO Edu.'
