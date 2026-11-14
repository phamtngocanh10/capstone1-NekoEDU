import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ClipboardCheck,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Btn, Card, CardHead, Chip, StatCard } from '../../../../common/ui';
import { assistantData } from '../../data/duLieuTroGiang';
import { useAssistant } from '../../layout/NguCanhTroGiang';
import {
  hasPermission,
  addDays,
  formatDate,
  todayISO,
  startOfWeek,
  LoadingState,
  EmptyState,
  useAsyncData,
} from '../shared/DungChung';
import { formatWeekdays, getAttendancePath, getSessionTimes } from '../LichHoTro/hienThiLich';

function AttendanceButton({ session }) {
  if (session.status === 'attended') {
    return (
      <Chip tone="green" icon={CheckCheck}>
        Đã điểm danh
      </Chip>
    );
  }
  if (!hasPermission(session, 'attendance')) return <Chip>Chỉ xem</Chip>;

  return (
    <Btn to={getAttendancePath(session)} size="sm" variant="soft">
      Điểm danh <ArrowRight size={12} />
    </Btn>
  );
}

function SupportSession({ session }) {
  const sessionTimes = getSessionTimes(session);

  return (
    <div className="ta-session-row">
      <div className="ta-session-time">
        <strong>{sessionTimes.start}</strong>
        <small>{sessionTimes.end}</small>
      </div>
      <div className="ta-session-details">
        <Link to={`/assistant/lophoc/${session.classId}`}>{session.name}</Link>
        <p>Hỗ trợ {session.teacher || 'giảng viên phụ trách'}</p>
        <div className="ta-meta">
          <span>
            <MapPin size={12} />
            {session.room || 'Chưa xếp phòng'}
          </span>
          <span>
            <Users size={12} />
            {session.students ?? 0} học viên
          </span>
        </div>
      </div>
      <AttendanceButton session={session} />
    </div>
  );
}

function TodaySupportSchedule({ scheduleResource, sessions }) {
  if (scheduleResource.loading) {
    return (
      <div className="ta-inline-status" role="status">
        Đang tải lịch hỗ trợ…
      </div>
    );
  }
  if (scheduleResource.error) {
    return <LoadingState error={scheduleResource.error} onRetry={scheduleResource.reload} />;
  }
  if (!sessions.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Hôm nay bạn không có lịch hỗ trợ"
        description="Bạn có thể xem các buổi học được phân công trong lịch tuần."
      >
        <Btn to="/assistant/lichhotro" variant="soft" icon={CalendarDays}>
          Xem lịch hỗ trợ
        </Btn>
      </EmptyState>
    );
  }

  return (
    <div className="ta-session-list">
      {sessions.map((session) => (
        <SupportSession key={session.id} session={session} />
      ))}
    </div>
  );
}

function AccessPermissions({ gradeGrantCount }) {
  const grants = [
    { content: 'Xem lịch hỗ trợ và lớp được phân công' },
    { content: 'Xem danh sách học viên theo phân công' },
    { content: 'Hỗ trợ điểm danh khi được cấp quyền' },
    {
      content: gradeGrantCount
        ? `${gradeGrantCount} quyền nhập điểm đang mở`
        : 'Nhập điểm khi giảng viên mở quyền',
      limited: !gradeGrantCount,
    },
  ];

  return (
    <Card>
      <CardHead title="Quyền truy cập của bạn">
        <span className="ta-section-icon">
          <ShieldCheck size={17} />
        </span>
      </CardHead>
      <ul className="ta-permission-list">
        {grants.map((grant) => (
          <li key={grant.content} className={grant.limited ? 'is-limited' : ''}>
            {grant.limited ? <LockKeyhole size={14} /> : <Check size={15} />}
            <span>{grant.content}</span>
          </li>
        ))}
      </ul>
      <Link className="ta-card-link" to="/assistant/chamdiem">
        Xem quyền nhập điểm <ArrowRight size={13} />
      </Link>
    </Card>
  );
}

function AssignedClassList({ classList }) {
  return (
    <Card>
      <CardHead title="Lớp được phân công" action="Xem tất cả" to="/assistant/lophoc" />
      {classList.length ? (
        <div className="ta-assigned-list">
          {classList.slice(0, 4).map((classDetails) => (
            <Link key={classDetails.id} to={`/assistant/lophoc/${classDetails.id}`}>
              <span className="ta-assigned-icon">
                <BookOpen size={16} />
              </span>
              <span>
                <strong>{classDetails.name}</strong>
                <small>
                  {classDetails.teacher || 'Chưa có giảng viên'}
                  {classDetails.days?.length ? ` · ${formatWeekdays(classDetails.days)}` : ''}
                </small>
              </span>
              <ArrowRight size={13} />
            </Link>
          ))}
        </div>
      ) : (
        <p className="ta-muted-note">
          Bạn chưa được phân công lớp. Trung tâm sẽ cập nhật lịch hỗ trợ tại đây.
        </p>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { data, loading, loadError, reloadData } = useAssistant();
  const today = todayISO();
  const weekStart = startOfWeek(today);
  const scheduleResource = useAsyncData(
    () => assistantData.getSupportSchedule(weekStart, addDays(weekStart, 6)),
    [weekStart]
  );
  const sessions = scheduleResource.data ?? [];
  const todaySessions = sessions.filter(
    (session) => session.iso === today && session.status !== 'cancelled'
  );
  const pastSessions = sessions.filter(
    (session) => session.iso <= today && session.status !== 'cancelled'
  );
  const attendedSessionCount = pastSessions.filter(
    (session) => session.status === 'attended'
  ).length;
  const attendanceRate = pastSessions.length
    ? Math.round((attendedSessionCount * 100) / pastSessions.length)
    : null;
  const todayClassCount = new Set(todaySessions.map((session) => session.classId)).size;
  const studentCount = data.classes.reduce(
    (total, classDetails) => total + Number(classDetails.size || 0),
    0
  );
  const gradeGrantCount = data.grants.filter((grant) => grant.state === 'open').length;

  if (loading && !data.classes.length) return <LoadingState />;
  if (loadError) return <LoadingState error={loadError} onRetry={reloadData} />;

  return (
    <div className="u-page ta-overview">
      <div className="ta-day-label">
        <span className="ta-day-label__dot" />
        <CalendarDays size={14} />
        {formatDate(today, { weekday: 'long' })}
      </div>
      <div className="ta-overview-stats">
        <StatCard
          icon={BookOpen}
          label="Lớp hỗ trợ hôm nay"
          value={`${todayClassCount} lớp`}
          accent="brand"
          tone="brand"
        />
        <StatCard
          icon={Users}
          label="Học viên trong các lớp"
          value={studentCount}
          accent="blue"
          tone="blue"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Điểm danh tuần này"
          value={`${attendedSessionCount}/${pastSessions.length}`}
          accent="green"
          tone="green"
          badge={
            attendanceRate !== null ? (
              <Chip tone="green">{attendanceRate}%</Chip>
            ) : (
              <Chip>Chưa có buổi học</Chip>
            )
          }
        />
      </div>
      <div className="ta-overview-columns">
        <Card className="ta-today-card">
          <CardHead
            title="Lịch hỗ trợ hôm nay"
            sub={`${todayClassCount} lớp · ${formatDate(today)}`}
            action="Xem cả tuần"
            to="/assistant/lichhotro"
          />
          <TodaySupportSchedule scheduleResource={scheduleResource} sessions={todaySessions} />
        </Card>
        <div className="ta-overview-side">
          <AccessPermissions gradeGrantCount={gradeGrantCount} />
          <AssignedClassList classList={data.classes} />
        </div>
      </div>
    </div>
  );
}
