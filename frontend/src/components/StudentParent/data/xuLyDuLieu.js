import { todayISO, createId } from '../components/shared/tienIch.js';

const PAYMENT_METHODS = ['chuyenKhoan', 'viDienTu', 'tienMat'];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function getSelectedStudent(data) {
  return data.hocVien.find((student) => student.ma === data.maHocVien) ?? data.hocVien[0];
}

export function getEnrolledCourses(data, studentId) {
  const courseIds = new Set(
    data.ghiDanh
      .filter(
        (enrollment) => enrollment.maHocVien === studentId && enrollment.trangThai === 'dangHoc'
      )
      .map((enrollment) => enrollment.maKhoa)
  );
  return data.khoaHoc.filter((course) => courseIds.has(course.ma));
}

export function getInvoices(data, studentId) {
  return data.hoaDon.filter((invoice) => invoice.maHocVien === studentId);
}

export function getNotifications(data, studentId) {
  return data.thongBao.filter(
    (notification) => !notification.maHocVien || notification.maHocVien === studentId
  );
}

// Các thao tác chỉ sửa bản sao được truyền vào; provider lưu thành công rồi mới cập nhật giao diện.
export function selectStudent(data, id) {
  requireCondition(
    data.hocVien.some((student) => student.ma === id),
    'Không tìm thấy hồ sơ học viên.'
  );
  data.maHocVien = id;
}

export function registerCourse(
  data,
  { maKhoa: courseId, maHocVien: studentId, phuongThuc: paymentMethod }
) {
  const course = data.khoaHoc.find((course) => course.ma === courseId);
  requireCondition(
    course && data.hocVien.some((student) => student.ma === studentId),
    'Thông tin học viên hoặc khóa học chưa đúng.'
  );
  requireCondition(
    PAYMENT_METHODS.includes(paymentMethod),
    'Vui lòng chọn phương thức thanh toán.'
  );
  requireCondition(course.siSo < course.sucChua, 'Lớp học đã đủ sĩ số.');
  requireCondition(
    !data.ghiDanh.some(
      (enrollment) =>
        enrollment.maHocVien === studentId &&
        enrollment.maKhoa === courseId &&
        ['dangHoc', 'choXacNhan'].includes(enrollment.trangThai)
    ),
    'Học viên đã đăng ký hoặc đang theo học khóa này.'
  );
  const enrollment = {
    ma: createId('dangky'),
    maHocVien: studentId,
    maKhoa: courseId,
    phuongThuc: paymentMethod,
    trangThai: 'choXacNhan',
    ngayDangKy: new Date().toISOString(),
  };
  data.ghiDanh.unshift(enrollment);
  return enrollment;
}

export function payInvoice(data, invoiceId, paymentMethod) {
  const student = getSelectedStudent(data);
  const invoice = data.hoaDon.find(
    (invoice) => invoice.ma === invoiceId && invoice.maHocVien === student.ma
  );
  requireCondition(invoice, 'Không tìm thấy hóa đơn của học viên đang xem.');
  requireCondition(
    invoice.trangThai !== 'daThanhToan',
    'Hóa đơn này đã được thanh toán trong bản mẫu.'
  );
  requireCondition(PAYMENT_METHODS.includes(paymentMethod), 'Phương thức thanh toán chưa đúng.');
  Object.assign(invoice, {
    trangThai: 'daThanhToan',
    phuongThuc: paymentMethod,
    ngayThanhToan: todayISO(),
    maGiaoDich: createId('NEKO-MAU').toUpperCase(),
  });
  return invoice;
}

export function markNotificationRead(data, notificationId, isRead = true) {
  const student = getSelectedStudent(data);
  const notification = getNotifications(data, student.ma).find(
    (notification) => notification.ma === notificationId
  );
  requireCondition(notification, 'Không tìm thấy thông báo cho học viên đang xem.');
  notification.daDoc = Boolean(isRead);
  return notification;
}

export function markAllNotificationsRead(data) {
  const student = getSelectedStudent(data);
  getNotifications(data, student.ma).forEach((notification) => {
    notification.daDoc = true;
  });
}

export function sendNotificationFeedback(data, { maThongBao: notificationId, noiDung: content }) {
  const student = getSelectedStudent(data);
  requireCondition(
    getNotifications(data, student.ma).some((notification) => notification.ma === notificationId),
    'Thông báo không thuộc hồ sơ đang xem.'
  );
  const trimmedContent = String(content ?? '').trim();
  requireCondition(
    trimmedContent && trimmedContent.length <= 2000,
    'Nội dung phản hồi cần có từ 1 đến 2.000 ký tự.'
  );
  const feedback = {
    ma: createId('phanhoi'),
    maThongBao: notificationId,
    maHocVien: student.ma,
    noiDung: trimmedContent,
    ngayGui: new Date().toISOString(),
    trangThai: 'daGui',
  };
  data.phanHoiThongBao.unshift(feedback);
  return feedback;
}

export function submitCourseReview(data, payload) {
  const student = getSelectedStudent(data);
  requireCondition(
    getEnrolledCourses(data, student.ma).some((course) => course.ma === payload.maKhoa),
    'Chỉ có thể đánh giá khóa học đang theo học.'
  );
  const {
    chatLuongGiangDay: teachingQuality,
    coSoVatChat: facilities,
    hoTroTrungTam: centerSupport,
  } = payload;
  requireCondition(
    [teachingQuality, facilities, centerSupport].every(
      (score) => Number.isInteger(score) && score >= 1 && score <= 5
    ),
    'Vui lòng chọn từ 1 đến 5 sao cho cả ba tiêu chí.'
  );
  const comment = String(payload.nhanXet ?? '').trim();
  requireCondition(comment && comment.length <= 1000, 'Nhận xét cần có từ 1 đến 1.000 ký tự.');
  const review = {
    ma: createId('danhgia'),
    maHocVien: student.ma,
    maKhoa: payload.maKhoa,
    chatLuongGiangDay: teachingQuality,
    coSoVatChat: facilities,
    hoTroTrungTam: centerSupport,
    nhanXet: comment,
    ngayGui: new Date().toISOString(),
  };
  data.danhGia.unshift(review);
  return review;
}

export function saveProfile(data, profile) {
  const name = String(profile.ten ?? '').trim();
  const email = String(profile.email ?? '').trim();
  const phoneNumber = String(profile.dienThoai ?? '').trim();
  const address = String(profile.diaChi ?? '').trim();
  const avatarUrl = String(profile.anhDaiDien ?? '');
  requireCondition(name.length >= 2 && name.length <= 100, 'Họ tên cần có từ 2 đến 100 ký tự.');
  requireCondition(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255,
    'Email chưa hợp lệ.'
  );
  requireCondition(
    /^0\d{9}$/.test(phoneNumber.replace(/[\s.-]/g, '')),
    'Số điện thoại cần có 10 chữ số và bắt đầu bằng 0.'
  );
  requireCondition(address.length <= 255, 'Địa chỉ tối đa 255 ký tự.');
  requireCondition(
    !avatarUrl ||
      (avatarUrl.length <= 1500000 && /^data:image\/(png|jpeg|webp);base64,/.test(avatarUrl)),
    'Ảnh đại diện chưa hợp lệ hoặc vượt quá 1 MB.'
  );
  Object.assign(data.taiKhoan, {
    ten: name,
    email,
    dienThoai: phoneNumber,
    diaChi: address,
    anhDaiDien: avatarUrl,
  });
  return data.taiKhoan;
}
