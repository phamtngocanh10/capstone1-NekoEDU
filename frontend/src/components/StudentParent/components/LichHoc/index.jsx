import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  GraduationCap,
  MapPin,
} from 'lucide-react';
import { Btn, Card, Chip, InfoGrid, SelectField } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { Dialog, SectionHeader, EmptyState } from '../shared/DungChung';
import {
  addDays,
  startOfWeek,
  formatDate,
  todayISO,
  getCourseName,
  exportCalendar,
} from '../shared/tienIch';
import '../../styles/hoc-tap.css';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const SESSION_STATUSES = {
  sapHoc: { nhan: 'Sắp học', mau: 'blue' },
  daHoc: { nhan: 'Đã học', mau: 'green' },
  daHuy: { nhan: 'Đã hủy', mau: 'red' },
};

function CalendarSyncModal({ sessions, courses, onClose }) {
  const { notify } = useStudentParent();
  const [error, setError] = useState('');
  const exportableSessions = sessions.filter((session) => session.trangThai !== 'daHuy');

  function downloadSchedule() {
    try {
      exportCalendar(exportableSessions, courses);
      notify('Đã tạo tệp lịch .ics. Bạn có thể nhập tệp này vào Google Calendar.');
      onClose();
    } catch (downloadError) {
      setError(downloadError.message || 'Chưa tạo được tệp lịch. Vui lòng thử lại.');
    }
  }

  return (
    <Dialog
      title="Đồng bộ Google Calendar"
      subtitle="Thêm lịch học của tuần đang xem vào lịch cá nhân"
      onClose={onClose}
      size="sm"
    >
      <div className="sp-dialog-body sp-stack">
        <p className="sp-note">
          Giao diện mẫu xuất lịch thành tệp <strong>.ics</strong>, không kết nối hoặc thay đổi tài
          khoản Google của bạn.
        </p>
        <ol className="sp-calendar-instructions">
          <li>Tải tệp lịch của {exportableSessions.length} buổi học trong tuần đang xem.</li>
          <li>
            Mở Google Calendar trên máy tính, chọn <strong>Cài đặt → Nhập và xuất</strong>.
          </li>
          <li>
            Chọn tệp .ics vừa tải, chọn lịch nhận rồi nhấn <strong>Nhập</strong>.
          </li>
        </ol>
        {!exportableSessions.length && (
          <p className="sp-muted">
            Tuần này chưa có buổi học để xuất lịch. Hãy chọn một tuần khác.
          </p>
        )}
        {error && (
          <p className="sp-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="sp-dialog-actions">
        <Btn variant="muted" onClick={onClose}>
          Đóng
        </Btn>
        <Btn icon={Download} onClick={downloadSchedule} disabled={!exportableSessions.length}>
          Tải lịch (.ics)
        </Btn>
      </div>
    </Dialog>
  );
}

export default function ClassSchedule() {
  const { data, student, enrolledCourses } = useStudentParent();
  const [searchParams] = useSearchParams();
  const [selectedWeek, setSelectedWeek] = useState(() => startOfWeek());
  const [courseId, setCourseId] = useState(searchParams.get('khoa') ?? '');
  const [isCalendarSyncOpen, setIsCalendarSyncOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const validCourseId = enrolledCourses.some((course) => course.ma === courseId) ? courseId : '';
  const sessions = data.lichHoc.filter(
    (session) =>
      session.maHocVien === student.ma && (!validCourseId || session.maKhoa === validCourseId)
  );
  const weekEndDate = addDays(selectedWeek, 6);
  const weekDays = WEEKDAY_LABELS.map((weekday, index) => ({
    thu: weekday,
    ngay: addDays(selectedWeek, index),
  }));
  const weekSessions = sessions.filter(
    (session) => session.ngay >= selectedWeek && session.ngay <= weekEndDate
  );
  const today = todayISO();
  const now = Date.now();
  const upcomingSessions = sessions
    .filter((session) => {
      if (session.trangThai !== 'sapHoc') return false;
      const sessionEndTime = new Date(`${session.ngay}T${session.ketThuc}:00+07:00`).getTime();
      return sessionEndTime >= now;
    })
    .sort(
      (previous, next) =>
        previous.ngay.localeCompare(next.ngay) || previous.batDau.localeCompare(next.batDau)
    )
    .slice(0, 4);

  useEffect(() => {
    setSelectedSession(null);
    setIsCalendarSyncOpen(false);
  }, [student.ma]);

  return (
    <div className="sp-page sp-study-page">
      <div className="sp-toolbar">
        <div className="sp-week-navigation">
          <Btn
            variant="icon"
            aria-label="Tuần trước"
            onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}
          >
            <ChevronLeft size={18} />
          </Btn>
          <div>
            <h2>
              Tuần {formatDate(selectedWeek, { year: undefined })} – {formatDate(weekEndDate)}
            </h2>
            <p className="sp-muted">Lịch học của {student.ten}</p>
          </div>
          <Btn
            variant="icon"
            aria-label="Tuần sau"
            onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
          >
            <ChevronRight size={18} />
          </Btn>
          <Btn variant="soft" size="sm" onClick={() => setSelectedWeek(startOfWeek())}>
            Tuần này
          </Btn>
        </div>
        <Btn variant="soft" icon={CalendarPlus} onClick={() => setIsCalendarSyncOpen(true)}>
          Đồng bộ Google Calendar
        </Btn>
      </div>
      <div className="sp-study-filter">
        <SelectField
          label="Khóa học"
          value={validCourseId}
          onChange={(event) => setCourseId(event.target.value)}
          options={[
            { value: '', label: 'Tất cả khóa học' },
            ...enrolledCourses.map((course) => ({ value: course.ma, label: course.ten })),
          ]}
        />
      </div>

      <Card pad={false} className="sp-week-calendar">
        {weekDays.map(({ thu: weekday, ngay: date }) => {
          const daySessions = weekSessions
            .filter((session) => session.ngay === date)
            .sort((previous, next) => previous.batDau.localeCompare(next.batDau));
          return (
            <section
              key={date}
              className={`sp-week-day ${date === today ? 'is-today' : ''}`}
              aria-label={`${weekday}, ${formatDate(date)}`}
            >
              <header>
                <strong>{weekday}</strong>
                <span>{formatDate(date, { year: undefined })}</span>
                {date === today && <small>Hôm nay</small>}
              </header>
              <div className="sp-week-day__sessions">
                {daySessions.map((session) => (
                  <button
                    type="button"
                    key={session.ma}
                    className={`sp-calendar-session sp-calendar-session--${session.trangThai}`}
                    onClick={() => setSelectedSession(session)}
                  >
                    <span>
                      <Clock3 size={12} />
                      {session.batDau} – {session.ketThuc}
                    </span>
                    <strong>{getCourseName(data, session.maKhoa)}</strong>
                    <small>
                      <MapPin size={12} />
                      {session.phong}
                    </small>
                    <small>{session.giangVien}</small>
                    <em>{SESSION_STATUSES[session.trangThai]?.nhan ?? 'Buổi học'}</em>
                  </button>
                ))}
                {!daySessions.length && (
                  <span className="sp-week-day__empty" aria-label="Không có lịch học">
                    —
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </Card>
      <div className="sp-calendar-legend">
        <span>
          <i />
          Sắp học
        </span>
        <span>
          <i className="is-complete" />
          Đã học
        </span>
        <span>
          <i className="is-cancelled" />
          Đã hủy
        </span>
      </div>
      {!weekSessions.length && (
        <p className="sp-note" role="status">
          Không có buổi học trong tuần đang xem. Chọn <strong>Tuần này</strong> để quay về lịch hiện
          tại.
        </p>
      )}

      <Card className="sp-stack">
        <SectionHeader
          title="Buổi học sắp tới"
          description="Chuẩn bị sẵn sàng cho những buổi học tiếp theo"
        />
        {upcomingSessions.length ? (
          upcomingSessions.map((session) => (
            <button
              type="button"
              className="sp-upcoming-session"
              key={session.ma}
              onClick={() => setSelectedSession(session)}
            >
              <span className="sp-study-icon">
                <CalendarDays size={20} />
              </span>
              <span>
                <strong>{getCourseName(data, session.maKhoa)}</strong>
                <small>
                  {session.phong} · {session.giangVien}
                </small>
              </span>
              <time>
                {session.ngay === today ? 'Hôm nay' : formatDate(session.ngay)}
                <small>
                  {session.batDau} – {session.ketThuc}
                </small>
              </time>
              <ChevronRight size={17} />
            </button>
          ))
        ) : (
          <EmptyState
            title="Chưa có buổi học sắp tới"
            description="Lịch mẫu hiện chưa có thêm buổi học cho khóa đã chọn."
          />
        )}
      </Card>

      {isCalendarSyncOpen && (
        <CalendarSyncModal
          sessions={weekSessions}
          courses={data.khoaHoc}
          onClose={() => setIsCalendarSyncOpen(false)}
        />
      )}
      {selectedSession && (
        <Dialog
          title="Thông tin buổi học"
          subtitle={getCourseName(data, selectedSession.maKhoa)}
          onClose={() => setSelectedSession(null)}
          size="sm"
        >
          <div className="sp-dialog-body sp-stack">
            <Chip tone={SESSION_STATUSES[selectedSession.trangThai]?.mau}>
              {SESSION_STATUSES[selectedSession.trangThai]?.nhan}
            </Chip>
            <InfoGrid
              items={[
                { label: 'Ngày học', value: formatDate(selectedSession.ngay) },
                {
                  label: 'Thời gian',
                  value: `${selectedSession.batDau} – ${selectedSession.ketThuc}`,
                },
                { label: 'Phòng học', value: selectedSession.phong },
                { label: 'Giảng viên', value: selectedSession.giangVien },
              ]}
            />
            <p>{selectedSession.noiDung}</p>
          </div>
          <div className="sp-dialog-actions">
            <Btn variant="muted" onClick={() => setSelectedSession(null)}>
              Đóng
            </Btn>
            <Btn to={`/student/khoahoc/${selectedSession.maKhoa}`} icon={GraduationCap}>
              Xem khóa học
            </Btn>
          </div>
        </Dialog>
      )}
    </div>
  );
}
