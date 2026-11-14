import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Clock3 } from 'lucide-react';
import { Btn, Card, Chip, Dialog, InfoGrid } from '../../../../common/ui';
import { assistantData } from '../../data/duLieuTroGiang';
import { useAssistant } from '../../layout/NguCanhTroGiang';
import {
  hasPermission,
  addDays,
  formatDate,
  filterByQuery,
  todayISO,
  startOfWeek,
  LoadingState,
  useAsyncData,
} from '../shared/DungChung';
import { getAttendancePath, getSessionTimes, WEEKDAY_LABELS } from './hienThiLich';

const SESSION_STATUSES = {
  attended: { label: 'Đã điểm danh', tone: 'green' },
  cancelled: { label: 'Đã hủy', tone: 'red' },
  upcoming: { label: 'Lịch hỗ trợ', tone: 'blue' },
};

function SessionCard({ session, index, onSelectSession }) {
  const cancelled = session.status === 'cancelled';
  const hasStatus = session.status === 'attended' || cancelled;
  const status = SESSION_STATUSES[session.status] ?? SESSION_STATUSES.upcoming;
  const sessionTimes = getSessionTimes(session);
  const sessionClassName = [
    'ta-calendar-session',
    `ta-calendar-session--${index % 3}`,
    cancelled && 'is-cancelled',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={sessionClassName} onClick={() => onSelectSession(session)}>
      <span className="ta-calendar-session__time">
        <Clock3 size={12} />
        {sessionTimes.start}
      </span>
      <strong>{session.name}</strong>
      <span>{session.room || 'Chưa xếp phòng'}</span>
      <small>{session.teacher}</small>
      {hasStatus && <span className="ta-calendar-session__status">{status.label}</span>}
    </button>
  );
}

function WeekdayColumn({ date, weekdayLabel, sessions, onSelectSession }) {
  const isToday = date === todayISO();

  return (
    <div className={`ta-calendar-day ${isToday ? 'is-today' : ''}`}>
      <div className="ta-calendar-day__head">
        <span>{weekdayLabel}</span>
        <strong>{formatDate(date, { year: undefined })}</strong>
        {isToday && <small>Hôm nay</small>}
      </div>
      <div className="ta-calendar-day__body">
        {sessions.length ? (
          sessions.map((session, index) => (
            <SessionCard
              key={session.id}
              session={session}
              index={index}
              onSelectSession={onSelectSession}
            />
          ))
        ) : (
          <span className="ta-calendar-empty" aria-label="Không có buổi hỗ trợ">
            —
          </span>
        )}
      </div>
    </div>
  );
}

function SessionDetails({ session, onCloseDetails }) {
  const status = SESSION_STATUSES[session.status] ?? SESSION_STATUSES.upcoming;
  const canTakeAttendance = session.status !== 'cancelled' && hasPermission(session, 'attendance');
  const details = [
    { label: 'Ngày học', value: formatDate(session.iso, { weekday: 'long' }) },
    { label: 'Thời gian', value: session.time },
    { label: 'Giảng viên', value: session.teacher || 'Chưa phân công' },
    { label: 'Phòng học', value: session.room || 'Chưa xếp phòng' },
    { label: 'Sĩ số', value: `${session.students ?? 0} học viên` },
  ];

  return (
    <Dialog title={session.name} subtitle="Chi tiết buổi hỗ trợ" onClose={onCloseDetails}>
      <div className="ta-dialog-content">
        <div className="ta-toolbar">
          <Chip tone={status.tone}>{status.label}</Chip>
          <span className="ta-muted-note">{session.code}</span>
        </div>
        <InfoGrid items={details} />
      </div>
      <div className="ta-dialog-actions">
        <Btn variant="ghost" onClick={onCloseDetails}>
          Đóng
        </Btn>
        <Btn variant="soft" to={`/assistant/lophoc/${session.classId}`}>
          Danh sách lớp
        </Btn>
        {canTakeAttendance && (
          <Btn icon={ClipboardCheck} to={getAttendancePath(session)}>
            Điểm danh hỗ trợ
          </Btn>
        )}
      </div>
    </Dialog>
  );
}

function ScheduleLegend() {
  return (
    <div className="ta-calendar-legend">
      <span>
        <i />
        Lịch hỗ trợ
      </span>
      <span>
        <i className="is-done" />
        Đã điểm danh
      </span>
      <span>
        <i className="is-cancelled" />
        Đã hủy
      </span>
      <small>Bấm vào buổi học để xem chi tiết</small>
    </div>
  );
}

export default function SupportSchedule() {
  const { query } = useAssistant();
  const [weekStart, setWeekStart] = useState(() => startOfWeek());
  const [selectedSession, setSelectedSession] = useState(null);
  const weekEnd = addDays(weekStart, 6);
  const scheduleResource = useAsyncData(
    () => assistantData.getSupportSchedule(weekStart, weekEnd),
    [weekStart]
  );
  const sessions = filterByQuery(
    scheduleResource.data ?? [],
    query,
    (session) => `${session.name} ${session.code} ${session.teacher}`
  );
  const sessionsByDate = new Map();
  for (const session of sessions) {
    const dailySessions = sessionsByDate.get(session.iso) ?? [];
    dailySessions.push(session);
    sessionsByDate.set(session.iso, dailySessions);
  }

  function changeDate(event) {
    if (event.target.value) setWeekStart(startOfWeek(event.target.value));
  }

  return (
    <div className="u-page ta-schedule">
      <div className="ta-week-toolbar">
        <div className="ta-week-navigation">
          <button
            className="ta-icon-button"
            aria-label="Tuần trước"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft size={18} />
          </button>
          <h2>
            Tuần {formatDate(weekStart, { year: undefined })} – {formatDate(weekEnd)}
          </h2>
          <button
            className="ta-icon-button"
            aria-label="Tuần sau"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="ta-toolbar">
          <label className="ta-date-picker">
            <CalendarDays size={15} />
            <input
              aria-label="Chọn ngày trong tuần"
              type="date"
              value={weekStart}
              onChange={changeDate}
            />
          </label>
          <Btn variant="soft" onClick={() => setWeekStart(startOfWeek())}>
            Tuần này
          </Btn>
        </div>
      </div>

      {scheduleResource.loading || scheduleResource.error ? (
        <LoadingState error={scheduleResource.error} onRetry={scheduleResource.reload} />
      ) : (
        <>
          <Card pad={false} className="ta-calendar-card">
            <div className="ta-calendar-scroll">
              <div className="ta-week-grid">
                {WEEKDAY_LABELS.map((weekdayLabel, index) => {
                  const date = addDays(weekStart, index);
                  return (
                    <WeekdayColumn
                      key={date}
                      date={date}
                      weekdayLabel={weekdayLabel}
                      sessions={sessionsByDate.get(date) ?? []}
                      onSelectSession={setSelectedSession}
                    />
                  );
                })}
              </div>
            </div>
          </Card>
          {!sessions.length && (
            <div className="ta-calendar-footnote">
              <CalendarDays size={15} />
              {query
                ? 'Không có buổi học phù hợp với tìm kiếm trong tuần này.'
                : 'Tuần này chưa có buổi hỗ trợ được phân công. Bạn có thể chọn tuần khác để xem lịch.'}
            </div>
          )}
          <ScheduleLegend />
        </>
      )}

      {selectedSession && (
        <SessionDetails session={selectedSession} onCloseDetails={() => setSelectedSession(null)} />
      )}
    </div>
  );
}
