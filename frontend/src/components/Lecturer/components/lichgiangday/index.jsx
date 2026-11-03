import { useState } from 'react';
import { Btn, Card, Chip } from '../../../../common/ui/index';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { TODAY_ISO, parseIso, addDays, mondayOf, toIso, weekLabel } from '../../../Manager/components/LichPhanCong/data';
import { apiGiangVien } from '../../../../api/giangvien';
import { LoiDuLieu, DangTai, useDuLieu } from '../dungchung/dungchung';
import { xuatExcel } from '../lophoc/taidanhsach';

export function lopTrongNgay(classes, date) {
  const weekday = (date.getDay() + 6) % 7;
  return classes.filter(classItem => classItem.days.includes(weekday));
}

export function DanhSachBuoiHoc({ classes, date }) {
  const iso = toIso(date);
  async function loadLessons() {
    const sessions = await apiGiangVien.sessions(iso);
    const activeSessions = sessions.filter(session => session.status !== 'cancelled');
    return Promise.all(activeSessions.map(async session => {
      const classItem = classes.find(item => item.id === session.classId);
      const saved = await apiGiangVien.attendance(session.id);
      return { ...classItem, time: session.time ?? session.slot, saved };
    }));
  }
  const remote = useDuLieu(loadLessons, [classes, iso]);
  if (!remote.data) return <DangTai error={remote.error} retry={remote.reload} />;
  return (
    <div className="lc-lessons">
      {remote.data.map(lesson => {
        const [start, end] = lesson.time.split('-');
        return (
          <div className="lc-lesson" key={lesson.id}>
            <span className="lc-lesson-time">{start}<small>{end}</small></span>
            <div className="u-grow"><strong>{lesson.name}</strong><p className="u-muted">{lesson.room} · {lesson.size} học viên</p></div>
            {lesson.saved && <Chip tone="green">Đã điểm danh</Chip>}
            <Btn variant={lesson.saved ? 'soft' : 'primary'} to={`/lecturer/diemdanh?classId=${lesson.id}&date=${iso}`}>
              {lesson.saved ? 'Xem điểm danh' : 'Điểm danh'}
            </Btn>
          </div>
        );
      })}
      {remote.data.length === 0 && <p className="lc-empty">Không có lịch giảng dạy trong ngày này.</p>}
    </div>
  );
}

export default function LichGiangDay() {
  const classesRequest = useDuLieu(() => apiGiangVien.classes());
  const [anchor, setAnchor] = useState(parseIso(TODAY_ISO));
  const [selectedDate, setSelectedDate] = useState(TODAY_ISO);
  const [error, setError] = useState('');
  const monday = mondayOf(anchor);
  const weekStart = toIso(monday);
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));

  async function loadWeek() {
    const dailySessions = await Promise.all(days.map(async date => {
      const sessions = await apiGiangVien.sessions(toIso(date));
      return sessions.filter(session => session.status !== 'cancelled');
    }));
    const schedule = {};
    days.forEach((date, index) => { schedule[toIso(date)] = dailySessions[index]; });
    return schedule;
  }
  const weekRequest = useDuLieu(loadWeek, [weekStart]);

  function reloadSchedule() {
    classesRequest.reload();
    weekRequest.reload();
  }

  function shiftWeek(dayCount) {
    const date = addDays(anchor, dayCount);
    setAnchor(date);
    setSelectedDate(toIso(date));
  }

  function showSampleWeek() {
    setAnchor(parseIso(TODAY_ISO));
    setSelectedDate(TODAY_ISO);
  }

  async function exportSchedule() {
    try {
      const rows = [];
      for (const date of days) {
        const iso = toIso(date);
        for (const lesson of weekRequest.data[iso] ?? []) {
          rows.push([iso, lesson.name, lesson.time, lesson.room]);
        }
      }
      await xuatExcel('Lich-giang-day', ['Ngày', 'Lớp', 'Giờ', 'Phòng'], rows);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!classesRequest.data || !weekRequest.data) {
    return <DangTai error={classesRequest.error || weekRequest.error} retry={reloadSchedule} />;
  }
  return (
    <div className="u-page lc-page">
      <div className="lc-toolbar">
        <Btn variant="soft" icon={ChevronLeft} aria-label="Tuần trước" onClick={() => shiftWeek(-7)} />
        <h2>{weekLabel(anchor)}</h2>
        <Btn variant="soft" icon={ChevronRight} aria-label="Tuần sau" onClick={() => shiftWeek(7)} />
        <Btn variant="ghost" onClick={showSampleWeek}>Tuần mẫu</Btn>
        <span className="u-grow" />
        <Btn variant="soft" icon={Download} onClick={exportSchedule}>Xuất lịch dạy</Btn>
      </div>
      <LoiDuLieu>{error}</LoiDuLieu>
      <Card pad={false}>
        <div className="lc-week">
          {days.map((date, index) => {
            const iso = toIso(date);
            const lessons = weekRequest.data[iso] ?? [];
            return (
              <div className={`lc-day ${iso === selectedDate ? 'is-selected' : ''}`} key={iso}>
                <button className="lc-day-heading" onClick={() => setSelectedDate(iso)}>
                  <strong>{index === 6 ? 'CN' : `T${index + 2}`}</strong>
                  <span>{date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>
                </button>
                <div className="lc-day-lessons">
                  {lessons.map(lesson => (
                    <button className="lc-week-lesson" key={lesson.id} onClick={() => setSelectedDate(iso)}>
                      <strong>{lesson.time.split('-')[0]}</strong><span>{lesson.name}</span><small>{lesson.room}</small>
                    </button>
                  ))}
                  {lessons.length === 0 && <span className="u-muted">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <h3 className="lc-section-title">Chi tiết ngày {selectedDate.split('-').reverse().join('/')}</h3>
        <DanhSachBuoiHoc classes={classesRequest.data} date={parseIso(selectedDate)} />
      </Card>
      <p className="u-muted">Dữ liệu mẫu theo thiết kế: tuần 14–20/09/2026.</p>
    </div>
  );
}
