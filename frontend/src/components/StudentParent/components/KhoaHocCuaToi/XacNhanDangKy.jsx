import { useEffect, useState } from 'react';
import { CheckCircle2, GraduationCap } from 'lucide-react';
import { Btn, CheckRow, InfoGrid, RadioChips, SelectField } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { Dialog } from '../shared/DungChung';
import { formatDate, formatCurrency } from '../shared/tienIch';
import { formatCourseWeekdays } from './lichHocKhoa';

const PAYMENT_METHODS = [
  { value: 'chuyenKhoan', label: 'Chuyển khoản ngân hàng' },
  { value: 'viDienTu', label: 'Ví MoMo / ZaloPay' },
  { value: 'tienMat', label: 'Tiền mặt tại quầy' },
];

export default function RegistrationModal({ course: courseDetails, onClose }) {
  const { data, student, registerCourse, notify } = useStudentParent();
  const [studentId, setStudentId] = useState(student.ma);
  const [paymentMethod, setPaymentMethod] = useState('chuyenKhoan');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setStudentId(student.ma);
    setAcceptedPolicy(false);
    setError('');
  }, [student.ma, courseDetails.ma]);

  function submitRegistration(event) {
    event.preventDefault();
    if (!acceptedPolicy) {
      setError('Vui lòng đọc và đồng ý với chính sách học phí, quy định của trung tâm.');
      return;
    }
    try {
      registerCourse({ maKhoa: courseDetails.ma, maHocVien: studentId, phuongThuc: paymentMethod });
      notify(
        'Đã lưu đăng ký mẫu. Đăng ký đang chờ trung tâm xác nhận, chưa phát sinh thanh toán thật.'
      );
      onClose();
    } catch (registrationError) {
      setError(registrationError.message);
    }
  }

  return (
    <Dialog title="Xác nhận đăng ký" subtitle={courseDetails.moTa} onClose={onClose}>
      <form onSubmit={submitRegistration}>
        <div className="sp-dialog-body sp-stack">
          <div className="sp-course-confirm">
            <span className="sp-study-icon">
              <GraduationCap size={25} />
            </span>
            <div>
              <h3>{courseDetails.ten}</h3>
              <p>
                {courseDetails.soBuoi} buổi · {formatCourseWeekdays(courseDetails)}
              </p>
            </div>
            <strong>{formatCurrency(courseDetails.hocPhi)}</strong>
          </div>
          <InfoGrid
            items={[
              { label: 'Khai giảng dự kiến', value: formatDate(courseDetails.ngayKhaiGiang) },
              {
                label: 'Giờ học · Phòng',
                value: `${courseDetails.gioBatDau} – ${courseDetails.gioKetThuc} · ${courseDetails.phong}`,
              },
            ]}
          />
          <SelectField
            label="Học viên đăng ký"
            required
            value={studentId}
            onChange={(event) => {
              setStudentId(event.target.value);
              setError('');
            }}
            options={data.hocVien.map((studentDetails) => ({
              value: studentDetails.ma,
              label: `${studentDetails.ten} (${studentDetails.maSo})`,
            }))}
          />
          <RadioChips
            label="Hình thức thanh toán"
            options={PAYMENT_METHODS}
            value={paymentMethod}
            onChange={setPaymentMethod}
            cols={1}
          />
          <details className="sp-study-policy">
            <summary>Chính sách học phí và quy định của trung tâm</summary>
            <p>
              Học phí áp dụng cho khóa được chọn. Trung tâm cần xác nhận đăng ký và chỗ học trước
              khi hướng dẫn thanh toán. Thay đổi lịch hoặc bảo lưu cần được trung tâm xác nhận.
            </p>
            <p>
              Đây là chính sách minh họa của giao diện mẫu; thao tác đăng ký không thu tiền, không
              gửi thông tin đến trung tâm.
            </p>
          </details>
          <CheckRow checked={acceptedPolicy} onChange={setAcceptedPolicy}>
            Tôi đồng ý với chính sách học phí và quy định của trung tâm.
          </CheckRow>
          <p className="sp-note">
            Bản mẫu chỉ lưu yêu cầu trên trình duyệt. Hình thức thanh toán ở đây là lựa chọn dự
            kiến.
          </p>
          {error && (
            <p className="sp-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="sp-dialog-actions">
          <Btn variant="muted" onClick={onClose}>
            Hủy
          </Btn>
          <Btn type="submit" icon={CheckCircle2}>
            Đăng ký
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}
