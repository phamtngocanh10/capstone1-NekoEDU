import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Clock3, GraduationCap, MapPin, Users } from 'lucide-react';
import { Btn, Card, Chip, Progress, SearchBox } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { StatusBadge, SectionHeader, EmptyState } from '../shared/DungChung';
import { formatDate, formatCurrency, filterByQuery } from '../shared/tienIch';
import RegistrationModal from './XacNhanDangKy';
import { formatCourseWeekdays } from './lichHocKhoa';
import '../../styles/hoc-tap.css';

export default function MyCourses() {
  const { data, student, enrolledCourses } = useStudentParent();
  const [query, setQuery] = useState('');
  const [registrationCourse, setRegistrationCourse] = useState(null);
  const enrollments = data.ghiDanh.filter((enrollment) => enrollment.maHocVien === student.ma);
  const registeredCourseIds = new Set(
    enrollments
      .filter((enrollment) => ['dangHoc', 'choXacNhan'].includes(enrollment.trangThai))
      .map((enrollment) => enrollment.maKhoa)
  );
  const suggestedCourses = filterByQuery(
    data.khoaHoc.filter((course) => !registeredCourseIds.has(course.ma)),
    query,
    (course) => `${course.ten} ${course.moTa}`
  );
  const pendingRegistrations = enrollments.filter(
    (enrollment) => enrollment.trangThai === 'choXacNhan'
  );

  useEffect(() => {
    setRegistrationCourse(null);
    setQuery('');
  }, [student.ma]);

  return (
    <div className="sp-page sp-study-page">
      <section className="sp-stack">
        <SectionHeader title="Đang theo học" description={`Khóa học hiện tại của ${student.ten}`} />
        {enrolledCourses.length ? (
          enrolledCourses.map((courseDetails) => (
            <Card key={courseDetails.ma} className="sp-enrolled-course">
              <span className="sp-study-icon">
                <BookOpen size={26} />
              </span>
              <div className="sp-enrolled-course__content">
                <div className="sp-study-title-row">
                  <h2>{courseDetails.ten}</h2>
                  <StatusBadge status="dangHoc" />
                </div>
                <p className="sp-study-meta">
                  <GraduationCap size={14} />
                  {courseDetails.giangVien}
                  <MapPin size={14} />
                  {courseDetails.phong}
                </p>
                <p className="sp-study-meta">
                  <CalendarDays size={14} />
                  {formatCourseWeekdays(courseDetails)}
                  <Clock3 size={14} />
                  {courseDetails.gioBatDau} – {courseDetails.gioKetThuc}
                </p>
                <div className="sp-course-progress">
                  <span>
                    Tiến độ: Tuần {courseDetails.tuanHienTai}/{courseDetails.tongSoTuan}
                  </span>
                  <Progress
                    value={courseDetails.tuanHienTai}
                    max={courseDetails.tongSoTuan}
                    label={`Tiến độ ${courseDetails.ten}`}
                  />
                </div>
              </div>
              <Btn to={`/student/khoahoc/${courseDetails.ma}`} variant="soft">
                Xem chi tiết
              </Btn>
            </Card>
          ))
        ) : (
          <EmptyState
            title="Chưa có khóa học đang theo học"
            description="Chọn một khóa phù hợp ở bên dưới để gửi đăng ký mẫu."
          />
        )}
      </section>

      {pendingRegistrations.length > 0 && (
        <Card className="sp-stack">
          <SectionHeader title="Đăng ký đang chờ xác nhận" />
          {pendingRegistrations.map((enrollment) => (
            <div className="sp-study-title-row" key={enrollment.ma}>
              <div>
                <strong>
                  {data.khoaHoc.find((course) => course.ma === enrollment.maKhoa)?.ten ??
                    'Khóa học'}
                </strong>
                <p className="sp-muted">
                  Đăng ký ngày {formatDate(enrollment.ngayDangKy)} · Dữ liệu mẫu
                </p>
              </div>
              <StatusBadge status="choXacNhan" />
            </div>
          ))}
        </Card>
      )}

      <section className="sp-stack">
        <SectionHeader
          title="Khóa học có thể đăng ký thêm"
          description="Tiếp tục hành trình chinh phục tiếng Anh"
        >
          <SearchBox value={query} onChange={setQuery} placeholder="Tìm khóa học..." />
        </SectionHeader>
        {suggestedCourses.length ? (
          <div className="sp-grid-3 sp-course-grid">
            {suggestedCourses.map((courseDetails, index) => (
              <Card
                key={courseDetails.ma}
                className={`sp-course-card sp-course-card--${index % 3}`}
              >
                <div className="sp-course-card__visual">
                  <GraduationCap size={36} />
                  <Chip tone="blue">{courseDetails.nhom}</Chip>
                </div>
                <div className="sp-course-card__body">
                  <h3>{courseDetails.ten}</h3>
                  <p>{courseDetails.moTa}</p>
                  <div className="sp-study-meta">
                    <CalendarDays size={14} />
                    {courseDetails.soBuoi} buổi
                    <Users size={14} />
                    {courseDetails.siSo}/{courseDetails.sucChua} học viên
                  </div>
                  <div className="sp-course-card__foot">
                    <strong>{formatCurrency(courseDetails.hocPhi)}</strong>
                    <Btn size="sm" onClick={() => setRegistrationCourse(courseDetails)}>
                      Đăng ký
                    </Btn>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Không có khóa học phù hợp"
            description={
              query
                ? 'Thử tìm bằng từ khóa khác.'
                : 'Các đăng ký của học viên đã nằm trong danh sách đang học hoặc chờ xác nhận.'
            }
          />
        )}
      </section>
      {registrationCourse && (
        <RegistrationModal
          course={registrationCourse}
          onClose={() => setRegistrationCourse(null)}
        />
      )}
    </div>
  );
}
