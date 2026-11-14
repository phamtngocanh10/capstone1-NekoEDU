export const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function formatWeekdays(weekdays = []) {
  return weekdays.map((weekday) => WEEKDAY_LABELS[weekday] || weekday).join(' · ');
}

export function getSessionTimes(session) {
  const [startTime, endTime] = session.time?.split(/[–-]/) ?? [];
  return {
    start: session.startTime || startTime,
    end: session.endTime || endTime,
  };
}

export function getAttendancePath(session) {
  const searchParams = new URLSearchParams({
    sessionId: session.id,
    classId: session.classId,
  });
  return `/assistant/diemdanh?${searchParams}`;
}
