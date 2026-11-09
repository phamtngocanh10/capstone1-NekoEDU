import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { BackLink, Btn, Card, MiniStat } from '../../../../common/ui/index';
import { useGiangVien, useTieuDeTrang } from '../../layout/ngucanh';
import { markAttended } from '../../../Manager/components/LichPhanCong/store';
import { TODAY_ISO } from '../../../Manager/components/LichPhanCong/data';
import { apiGiangVien } from '../../../../api/giangvien';
import { useLopGiangDay } from '../../layout/dulieulophoc';
import {
  ChonLop,
  LoiDuLieu,
  DangTai,
  HocVien,
  TimKiem,
  BangDuLieu,
  khopTimKiem,
  useDuLieu,
  ngayHocKeTiep,
} from '../dungchung/dungchung';
import '../../../../styles/giangvien.css';

const ATTENDANCE_OPTIONS = [
  { value: 'present', label: 'Có mặt' },
  { value: 'late', label: 'Đi trễ' },
  { value: 'absent', label: 'Vắng' },
];

export default function DiemDanhGiangVien({ manager = false }) {
  useTieuDeTrang('Điểm danh', 'Đánh dấu điểm danh thủ công cho từng buổi học');
  const lecturerClasses = useLopGiangDay();
  const { sessionId } = useParams();
  const [params] = useSearchParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { notify } = useGiangVien();

  const [records, setRecords] = useState({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Manager mở buổi học từ lịch; giảng viên chọn lớp và ngày trên trang.
  const managerRequest = useDuLieu(async () => manager
    ? { lesson: await apiGiangVien.session(sessionId), classes: await apiGiangVien.classes() }
    : { lesson: null, classes: [] }, [manager, sessionId]);
  const managerLesson = managerRequest.data?.lesson;
  const lessonDate = managerLesson?.iso;
  const classId = manager ? managerLesson?.classId : params.get('classId') || lecturerClasses[0]?.id;
  const classes = manager ? managerRequest.data?.classes ?? [] : lecturerClasses;
  const selectedClass = classes.find(item => item.id === classId);
  const date = manager ? lessonDate : params.get('date') || selectedClass?.nextSessionDate || ngayHocKeTiep(selectedClass, TODAY_ISO);

  async function loadAttendance() {
    if (manager && !managerLesson) return null;
    let session = managerLesson;
    if (!manager) {
      const sessions = await apiGiangVien.sessions(date);
      session = sessions.find(item => item.classId === classId);
    }
    if (!session) {
      throw new Error('Lớp không có buổi học trong ngày đã chọn. Hãy quay lại lịch để chọn buổi học.');
    }
    const roster = await apiGiangVien.roster(classId, date);
    const saved = await apiGiangVien.attendance(session.id);
    return { session, roster, saved };
  }

  const remote = useDuLieu(loadAttendance, [classId, date, sessionId, manager, managerLesson]);
  const attendanceId = remote.data?.session.id;
  const lesson = managerLesson ?? remote.data?.session;

  useEffect(() => {
    if (!remote.data) return;
    const initialRecords = {};
    for (const student of remote.data.roster) {
      const savedRecord = remote.data.saved?.records.find(record => record.studentId === student.id);
      initialRecords[student.id] = savedRecord ?? { studentId: student.id, status: '', note: '' };
    }
    setRecords(initialRecords);
    setHasChanges(false);
    setError('');
  }, [remote.data]);

  useEffect(() => {
    function warnBeforeLeaving(event) {
      if (!hasChanges) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasChanges]);

  if (manager && !managerRequest.data) return <DangTai error={managerRequest.error} retry={managerRequest.reload} />;
  if (!selectedClass || (manager && !lesson)) {
    return <DangTai error="Không tìm thấy buổi học. Hãy quay lại lịch và chọn buổi học." />;
  }
  if (!remote.data) {
    return (
      <div className="u-page">
        <BackLink to={manager ? '/lichphancong' : '/lecturer/lichgiangday'}>
          Quay lại lịch giảng dạy
        </BackLink>
        <DangTai error={remote.error} retry={remote.reload} />
      </div>
    );
  }

  const { roster, saved } = remote.data;
  const filteredStudents = roster.filter(student => khopTimKiem(student, search));
  const isCancelled = lesson?.status === 'cancelled';
  const attendanceRecords = Object.values(records);
  const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
  const absentCount = attendanceRecords.filter(record => record.status === 'absent').length;
  const lateCount = attendanceRecords.filter(record => record.status === 'late').length;
  const unmarkedCount = roster.length - attendanceRecords.filter(record => record.status).length;

  let backTo = '/lecturer/lichgiangday';
  if (manager) {
    backTo = state?.backTo || `/lichphancong/${date}?slot=${encodeURIComponent(lesson.slot)}`;
  }
  let saveMessage = 'Chọn trạng thái cho từng học viên';
  if (hasChanges) saveMessage = 'Có thay đổi chưa lưu';
  else if (saved) saveMessage = 'Đã lưu điểm danh';

  function updateRecord(studentId, changes) {
    setRecords(currentRecords => ({
      ...currentRecords,
      [studentId]: { ...currentRecords[studentId], ...changes },
    }));
    setHasChanges(true);
  }

  function markAllPresent() {
    const nextRecords = {};
    for (const student of roster) {
      nextRecords[student.id] = { ...records[student.id], studentId: student.id, status: 'present' };
    }
    setRecords(nextRecords);
    setHasChanges(true);
  }

  function changeClass(nextClassId) {
    if (hasChanges && !window.confirm('Điểm danh chưa lưu. Bạn muốn đổi lớp?')) return;
    const nextClass = lecturerClasses.find(item => item.id === nextClassId);
    const nextDate = nextClass?.nextSessionDate || ngayHocKeTiep(nextClass, date);
    navigate(`/lecturer/diemdanh?classId=${nextClassId}&date=${nextDate}`);
  }

  function changeDate(event) {
    const nextDate = event.target.value;
    if (!nextDate) return;
    if (hasChanges && !window.confirm('Điểm danh chưa lưu. Bạn muốn đổi ngày?')) return;
    navigate(`/lecturer/diemdanh?classId=${classId}&date=${nextDate}`);
  }

  async function saveAttendance() {
    if (roster.some(student => !records[student.id]?.status)) {
      setError('Vui lòng điểm danh đầy đủ học viên trước khi lưu.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const result = await apiGiangVien.saveAttendance(attendanceId, {
        classId,
        date,
        records: roster.map(student => records[student.id]),
      });
      if (manager) await markAttended();
      setHasChanges(false);
      remote.setData({ ...remote.data, saved: result });
      notify('Đã lưu điểm danh');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="u-page lc-page">
      <BackLink to={backTo}>Quay lại lịch giảng dạy</BackLink>
      <Card>
        <div className="lc-toolbar">
          <div className="u-grow">
            <h2>{selectedClass.name}</h2>
            <p className="u-muted">
              {date.split('-').reverse().join('/')} · {lesson?.time ?? selectedClass.time ?? selectedClass.range}
              {' · '}{selectedClass.room} · {roster.length} học viên
            </p>
          </div>
          {!manager && (
            <>
              <ChonLop value={classId} onChange={changeClass} />
              <input
                aria-label="Ngày điểm danh"
                className="lc-select"
                type="date"
                value={date}
                onChange={changeDate}
              />
            </>
          )}
          <Btn icon={Save} disabled={isSaving || isCancelled} onClick={saveAttendance}>
            {isSaving ? 'Đang lưu…' : 'Lưu điểm danh'}
          </Btn>
        </div>
      </Card>
      <LoiDuLieu>{error}</LoiDuLieu>
      <div className="lc-stats">
        <MiniStat label="Có mặt" value={presentCount} tone="success" />
        <MiniStat label="Vắng" value={absentCount} tone="danger" />
        <MiniStat label="Đi trễ" value={lateCount} tone="warning" />
        <MiniStat label="Chưa điểm danh" value={unmarkedCount} />
      </div>
      <Card pad={false}>
        <div className="lc-toolbar lc-pad">
          <TimKiem value={search} onChange={setSearch} />
          <Btn variant="soft" disabled={isCancelled} onClick={markAllPresent}>
            Tất cả có mặt
          </Btn>
          <span className="u-muted">{saveMessage}</span>
        </div>
        <BangDuLieu headings={['Học viên', 'Trạng thái điểm danh', 'Ghi chú']}>
          {filteredStudents.map(student => (
            <tr key={student.id}>
              <td><HocVien student={student} /></td>
              <td>
                <div className="lc-attendance-options">
                  {ATTENDANCE_OPTIONS.map(option => {
                    const isSelected = records[student.id]?.status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={isCancelled}
                        aria-pressed={isSelected}
                        className={`lc-attendance-option is-${option.value} ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => updateRecord(student.id, { status: option.value })}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </td>
              <td>
                <input
                  className="lc-input"
                  aria-label={`Ghi chú ${student.name}`}
                  value={records[student.id]?.note ?? ''}
                  onChange={event => updateRecord(student.id, { note: event.target.value })}
                  disabled={isCancelled}
                  placeholder="Thêm ghi chú…"
                />
              </td>
            </tr>
          ))}
        </BangDuLieu>
        {filteredStudents.length === 0 && <p className="lc-empty">Không tìm thấy học viên.</p>}
      </Card>
    </div>
  );
}
