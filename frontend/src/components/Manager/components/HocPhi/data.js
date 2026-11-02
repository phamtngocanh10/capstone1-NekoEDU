// Dữ liệu mẫu theo Figma (14.0–14.4) — thay bằng src/api/finance.js khi có backend.
export const FEE_ROWS = [
  { id: 'HV20260098', name: 'Trần Gia Bảo', className: 'KID TEEN 1B', fee: 3200000, paid: 0, due: '05/09/2026', status: 'overdue' },
  { id: 'HV20260033', name: 'Ngô Bảo Trâm', className: 'KID TEEN 1B', fee: 3200000, paid: 1000000, due: '05/09/2026', status: 'overdue' },
  { id: 'HV20260142b', name: 'Nguyễn Gia Bảo', className: 'KID TEEN 2A', fee: 2400000, paid: 0, due: '20/09/2026', status: 'soon' },
  { id: 'HV20260098b', name: 'Đỗ Minh Anh', className: 'KID TEEN 3B', fee: 2800000, paid: 0, due: '22/09/2026', status: 'soon' },
  { id: 'HV20260142', name: 'Nguyễn Minh Anh', className: 'KID TEEN 2A', fee: 2400000, paid: 2400000, due: '—', status: 'paid' },
]
export const STATUS = {
  overdue: { label: 'Quá hạn', tone: 'red' },
  soon: { label: 'Sắp đến hạn', tone: 'amber' },
  paid: { label: 'Đã thanh toán', tone: 'green' },
}
export const FILTERS = [
  { value: 'all', label: 'Tất cả' }, { value: 'overdue', label: 'Quá hạn' }, { value: 'soon', label: 'Sắp đến hạn' }, { value: 'paid', label: 'Đã thanh toán' },
]

export const RISKS = [
  { id: 'r1', name: 'Trần Gia Bảo', className: 'KID TEEN 1B', debt: 3200000, reason: 'Trễ hạn 2 kỳ liên tiếp' },
  { id: 'r2', name: 'Ngô Bảo Trâm', className: 'KID TEEN 1B', debt: 2200000, reason: 'Còn nợ kỳ trước + sắp trễ hạn' },
  { id: 'r3', name: 'Nguyễn Gia Bảo', className: 'KID TEEN 2A', debt: 2400000, reason: 'Sắp đến hạn, từng đóng muộn 1 lần' },
  { id: 'r4', name: 'Đỗ Minh Anh', className: 'KID TEEN 3B', debt: 2800000, reason: 'Sắp đến hạn, phụ huynh chưa phản hồi nhắc' },
  { id: 'r5', name: 'Lê Hoàng Phúc', className: 'KID TEEN 3B', debt: 4200000, reason: 'Trễ 1 kỳ, công nợ cộng dồn cao' },
]

export const INVOICES = [
  { id: 'HD-2608-0142', item: 'Học phí kỳ 1 · T8–T10/2026', amount: 2400000, due: '28/08/2026', paidAt: '21/08/2026', method: 'Chuyển khoản', status: 'paid' },
  { id: 'HD-2608-0142-TL', item: 'Phí tài liệu khóa học', amount: 300000, due: '28/08/2026', paidAt: '21/08/2026', method: 'Tiền mặt', status: 'paid' },
  { id: 'HD-2611-0142', item: 'Học phí kỳ 2 · T11/2026–T1/2027', amount: 2400000, due: '20/11/2026', paidAt: '—', method: '—', status: 'upcoming' },
]
export const NOTICE_TEXT = `Chào [Tên học viên/phụ huynh],

NEKO Edu xin thông báo học phí tháng 10/2026 của [Tên học viên] tại lớp [Tên lớp] là [Số tiền]đ, hạn thanh toán trước ngày 05/10/2026.

Quý phụ huynh vui lòng thanh toán qua ứng dụng hoặc tại quầy lễ tân trung tâm.
Trân trọng, NEKO Edu.`
