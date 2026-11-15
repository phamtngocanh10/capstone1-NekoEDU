import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock3,
  GraduationCap,
  MapPin,
  PlayCircle,
  Users,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { BackLink, Btn, Card, Chip, InfoGrid, Progress } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { StatusBadge, SectionHeader, EmptyState } from '../shared/DungChung';
import { formatDate, formatCurrency } from '../shared/tienIch';
import { formatCourseWeekdays } from './lichHocKhoa';
import '../../styles/hoc-tap.css';

const UNIT_STATUSES = {
  hoanThanh: { nhan: 'Hoàn thành', mau: 'green', bieuTuong: CheckCircle2 },
  dangHoc: { nhan: 'Đang học', mau: 'blue', bieuTuong: PlayCircle },
  sapToi: { nhan: 'Sắp tới', mau: 'gray', bieuTuong: CircleDashed },
};

export default function CourseDetails() {
  const { maKhoa: courseId } = useParams();
  const { data, student, enrolledCourses, invoices } = useStudentParent();
  const courseDetails = enrolledCourses.find((course) => course.ma === courseId);

  if (!courseDetails)
    return (
      <div className="sp-page">
        <BackLink to="/student/khoahoc">Khóa học của tôi</BackLink>
        <EmptyState
          title="Không tìm thấy khóa học đang theo học"
          description={`Khóa học này không thuộc danh sách đang học của ${student.ten}.`}
        >
          <Btn to="/student/khoahoc" variant="soft">
            Xem khóa học của tôi
          </Btn>
        </EmptyState>
      </div>
    );

  const completedSessionCount = data.lichHoc.filter(
    (session) =>
      session.maHocVien === student.ma &&
      session.maKhoa === courseId &&
      session.trangThai === 'daHoc'
  ).length;
  const invoice = invoices
    .filter((invoiceItem) => invoiceItem.maKhoa === courseId)
    .sort((previous, next) => next.hanThanhToan.localeCompare(previous.hanThanhToan))[0];

  return (
    <div className="sp-page sp-study-page">
      <BackLink to="/student/khoahoc">Khóa học của tôi</BackLink>
      <Card className="sp-stack">
        <div className="sp-study-title-row">
          <div>
            <h2>{courseDetails.ten}</h2>
            <p className="sp-muted">
              Thông tin chương trình, lịch học và tiến độ của {student.ten}
            </p>
          </div>
          <StatusBadge status="dangHoc" />
        </div>
        <p className="sp-study-meta">
          <GraduationCap size={16} />
          {courseDetails.giangVien}
          <MapPin size={16} />
          {courseDetails.phong}
          <Clock3 size={16} />
          {courseDetails.gioBatDau} – {courseDetails.gioKetThuc}
        </p>
        <div className="sp-course-progress">
          <span>
            Tiến độ khóa học: Tuần {courseDetails.tuanHienTai}/{courseDetails.tongSoTuan} · Đã học{' '}
            {completedSessionCount} buổi trong lịch mẫu
          </span>
          <Progress
            value={courseDetails.tuanHienTai}
            max={courseDetails.tongSoTuan}
            label="Tiến độ khóa học"
            large
          />
        </div>
        <InfoGrid
          cols={3}
          items={[
            { label: 'Giảng viên', value: courseDetails.giangVien },
            { label: 'Phòng học', value: courseDetails.phong },
            {
              label: 'Sĩ số lớp',
              value: `${courseDetails.siSo} / ${courseDetails.sucChua} học viên`,
            },
            {
              label: 'Lịch học',
              value: `${formatCourseWeekdays(courseDetails)} · ${courseDetails.gioBatDau} – ${courseDetails.gioKetThuc}`,
            },
            { label: 'Ngày khai giảng', value: formatDate(courseDetails.ngayKhaiGiang) },
            {
              label: 'Học phí',
              value: invoice ? (
                <span>
                  {formatCurrency(invoice.soTien)} ·{' '}
                  {invoice.trangThai === 'daThanhToan' ? 'Đã đóng' : 'Chưa thanh toán'}
                </span>
              ) : (
                formatCurrency(courseDetails.hocPhi)
              ),
            },
          ]}
        />
      </Card>

      <Card className="sp-stack">
        <SectionHeader title="Nội dung chương trình" description={courseDetails.mucTieu} />
        <div className="sp-course-units">
          {courseDetails.chuongTrinh.map((unit) => {
            const status = UNIT_STATUSES[unit.trangThai] ?? UNIT_STATUSES.sapToi;
            const Icon = status.bieuTuong;
            return (
              <div className="sp-course-unit" key={unit.donVi}>
                <span className={`sp-unit-icon sp-unit-icon--${unit.trangThai}`}>
                  <Icon size={19} />
                </span>
                <strong>{unit.donVi}</strong>
                <p>{unit.ten}</p>
                <Chip tone={status.mau}>{status.nhan}</Chip>
              </div>
            );
          })}
        </div>
      </Card>
      <div className="sp-study-quicklinks">
        <Btn to={`/student/lichhoc?khoa=${courseDetails.ma}`} variant="soft" icon={CalendarDays}>
          Xem lịch học
        </Btn>
        <Btn to={`/student/tailieu?khoa=${courseDetails.ma}`} variant="soft" icon={BookOpen}>
          Tài liệu khóa học
        </Btn>
        <Btn to="/student/ketqua" variant="ghost" icon={Users}>
          Điểm danh & kết quả
        </Btn>
      </div>
    </div>
  );
}
