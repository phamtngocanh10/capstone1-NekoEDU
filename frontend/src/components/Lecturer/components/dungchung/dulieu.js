import { CLASSES as LOP_MANAGER, ROSTER as HOC_VIEN_MANAGER } from '../../../Manager/components/KhoaHoc/data';

export const GIANG_VIEN = {
  id: 'gv-khoi',
  name: 'Trần Minh Khôi',
  role: 'Lecturer',
  email: 'khoi.tran@neko.edu.vn',
  phone: '0901 234 567',
  address: '25 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
  joined: '03/2023',
};
// Lấy đúng các lớp được phân công cho giảng viên từ dữ liệu Manager.
export const DANH_SACH_LOP = LOP_MANAGER.filter(lop => lop.teacher === GIANG_VIEN.name).map((lop, i) => ({
  ...lop,
  days: lop.days.split('-').map(thu => thu === 'CN' ? 6 : Number(thu.slice(1)) - 2),
  time: lop.range.replace('–', '-'),
  rate: [96, 92, 100, 90][i] ?? 95,
}));
const HOC_VIEN_BO_SUNG = [
  ['HV20260142', 'Nguyễn Gia Bảo', '12/03/2009', '0912 345 142', 98],
  ['HV20260098', 'Đỗ Minh Anh', '05/07/2009', '0987 654 098', 94],
  ['HV20260201', 'Lê Thu Hà', '21/11/2008', '0903 120 201', 100],
  ['HV20260055', 'Trần Quốc Việt', '30/01/2009', '0934 555 055', 78],
  ['HV20259871', 'Phạm Thu Uyên', '17/09/2009', '0977 259 871', 96],
  ['HV20260177', 'Vũ Đăng Khoa', '08/04/2008', '0944 260 177', 92],
  ['HV20260033', 'Ngô Bảo Trâm', '25/12/2009', '0905 260 033', 88],
  ['HV20260210', 'Hoàng Kim Ngân', '14/06/2009', '0932 260 210', 95],
  ['HV20260144', 'Bùi Thanh Tú', '02/02/2009', '0918 260 144', 97],
  ['HV20260188', 'Đặng Hồng Nhung', '19/08/2009', '0966 260 188', 91],
  ['HV20260211', 'Nguyễn Minh Anh', '10/01/2009', '0901 260 211', 96],
  ['HV20260212', 'Trần Gia Huy', '11/02/2009', '0901 260 212', 94],
  ['HV20260213', 'Phạm Ngọc Mai', '12/03/2009', '0901 260 213', 90],
  ['HV20260214', 'Hoàng Gia Hân', '13/04/2009', '0901 260 214', 97],
  ['HV20260215', 'Vũ Ngọc Diệp', '14/05/2009', '0901 260 215', 93],
  ['HV20260216', 'Bùi Thanh Tùng', '15/06/2009', '0901 260 216', 98],
  ['HV20260217', 'Phạm Đức Anh', '16/07/2009', '0901 260 217', 95],
  ['HV20260218', 'Lê Bảo Ngọc', '17/08/2009', '0901 260 218', 76],
  ['HV20260219', 'Đỗ Quang Minh', '18/09/2009', '0901 260 219', 91],
  ['HV20260220', 'Trần Minh Đức', '19/10/2009', '0901 260 220', 92],
].map(([id, name, birth, phone, rate]) => ({ id, name, birth, phone, rate }));
export const HOC_VIEN = [
  ...HOC_VIEN_MANAGER.map((hocvien, index) => ({
    ...HOC_VIEN_BO_SUNG[index],
    id: hocvien.id,
    name: hocvien.name,
    rate: Number.parseInt(hocvien.rate, 10),
  })),
  ...HOC_VIEN_BO_SUNG.filter(hocvien => !HOC_VIEN_MANAGER.some(hv => hv.id === hocvien.id)),
];
export const BAI_KIEM_TRA = ['Kiểm tra giữa kỳ', 'Kiểm tra đầu vào', 'Bài luyện Speaking', 'Bài luyện Writing Task 2'];
export const KY_NANG = ['Nghe', 'Đọc', 'Nói', 'Viết'];
export const DIEM_MAU = [[7.5, 6.5, 6, 6.5], [6, 6.5, 5.5, 6], [7, 7.5, 6.5, 7], [5.5, 5, 5, 5.5], [8, 7.5, 7, 7.5], [6.5, 6, 6, 6.5]];
export const TRO_GIANG_MAU = [
  { id: 'ta-vy', name: 'Nguyễn Thảo Vy', email: 'vy.nguyen@neko.edu.vn', classId: 'kid-2a', open: true, request: false, pending: true, submissionTest: 'Bài luyện Writing Task 2', start: '2026-09-10T08:00', end: '2026-09-16T23:59', permissions: ['attendance', 'roster'] },
  { id: 'ta-quan', name: 'Lê Minh Quân', email: 'quan.le@neko.edu.vn', classId: 'kid-3b', open: false, request: true, pending: false, permissions: ['attendance', 'roster'] },
  { id: 'ta-trang', name: 'Hoàng Thu Trang', email: 'trang.hoang@neko.edu.vn', classId: 'kid-3a', open: false, request: true, pending: false, permissions: ['attendance', 'roster'] },
];
const NOI_DUNG_NHAN_XET = [
  'Tiến bộ rõ ở kỹ năng Speaking, cần luyện thêm phát âm âm cuối.',
  'Làm bài tập đầy đủ, nên chủ động hỏi khi chưa hiểu bài.',
  'Viết luận tốt, cần cải thiện quản lý thời gian khi làm bài thi thử.',
  'Vắng 2 buổi liên tiếp, cần trao đổi thêm với phụ huynh.',
  'Kỹ năng nghe cải thiện tốt sau 3 tuần luyện tập.',
];
export const NHAN_XET_MAU = HOC_VIEN.slice(0, 5).map((student, index) => ({
  id: `comment-${index}`,
  studentId: student.id,
  classId: 'kid-2a',
  date: '2026-09-12T08:00:00',
  text: NOI_DUNG_NHAN_XET[index],
}));
export const TAI_LIEU_MAU = [
  ['doc-1', 'Giáo trình Unit 5 - Speaking.pdf', 'kid-2a', '2.4 MB'],
  ['doc-2', 'Bài tập Listening Practice 3.pdf', 'kid-2a', '1.1 MB'],
  ['doc-3', 'Slide bài giảng Writing Task 2.pptx', 'kid-3b', '5.8 MB'],
  ['doc-4', 'Đề luyện thi thử số 4.docx', 'kid-3b', '890 KB'],
  ['doc-5', 'Flashcard từ vựng Unit 6.pdf', 'kindy-3b', '3.2 MB'],
  ['doc-6', 'Audio Practice - Part 2.mp3', 'kid-3a', '6.4 MB'],
].map(([id, name, classId, size]) => ({
  id,
  name,
  classIds: [classId],
  size,
  date: '2026-09-12',
  downloads: 0,
  events: ['Tài liệu mẫu theo thiết kế. Tải tệp thật lên để tải xuống.'],
}));
