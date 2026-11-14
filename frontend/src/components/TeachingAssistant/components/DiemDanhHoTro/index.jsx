import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock3,
  Info,
  MapPin,
  Save,
  Users,
} from 'lucide-react';
import {
  Btn,
  Card,
  Chip,
  MiniStat,
  SearchBox,
  SelectField,
  TextField,
} from '../../../../common/ui';
import { assistantData, getAttendanceSession } from '../../data/duLieuTroGiang';
import { useManager, usePageHeader } from '../../../Manager/layout/ManagerContext.jsx';
import { useAssistant } from '../../layout/NguCanhTroGiang';
import {
  hasPermission,
  formatDate,
  formatDateTime,
  getErrorMessage,
  filterByQuery,
  todayISO,
  StudentIdentity,
  LoadingState,
  EmptyState,
  useAsyncData,
} from '../shared/DungChung';
import useUnsavedChanges from '../shared/useBaoVeThayDoi';

const ATTENDANCE_OPTIONS = [
  { value: 'present', label: 'Có mặt', icon: Check },
  { value: 'late', label: 'Đi trễ', icon: Clock3 },
  { value: 'absent', label: 'Vắng', icon: Users },
];
const ATTENDANCE_STAT_GROUPS = { present: 'present', late: 'late', absent: 'absent' };

function countAttendance(items) {
  return items.reduce(
    (stats, student) => {
      const group = ATTENDANCE_STAT_GROUPS[student.status] || 'unmarked';
      stats[group] += 1;
      return stats;
    },
    { present: 0, late: 0, absent: 0, unmarked: 0 }
  );
}

function createAttendanceSnapshot(items) {
  return items.map(({ studentId, status, note }) => ({
    studentId,
    status,
    note,
  }));
}

function getReadOnlyReason(attendance, session) {
  if (attendance.status === 'CANCELLED') return 'Buổi học đã bị hủy. Bạn chỉ có thể xem điểm danh.';
  const start = session?.startTime
    ? new Date(`${attendance.date}T${session.startTime}:00+07:00`)
    : null;
  if (start && start > new Date())
    return 'Buổi học chưa bắt đầu. Bạn có thể điểm danh khi đến giờ hỗ trợ.';
  return 'Bạn chưa được cấp quyền sửa điểm danh cho buổi học này.';
}

function AttendanceRow({ student, editable, onChange }) {
  return (
    <tr>
      <td>
        <StudentIdentity name={student.name} code={student.code} />
      </td>
      <td>
        <div
          className="ta-attendance-options"
          role="radiogroup"
          aria-label={`Điểm danh ${student.name}`}
        >
          {ATTENDANCE_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={student.status === value}
              disabled={!editable}
              className={`ta-attendance-option ta-attendance-option--${value} ${student.status === value ? 'is-selected' : ''}`}
              onClick={() => onChange(student.studentId, { status: value })}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </td>
      <td>
        <input
          className="ta-attendance-note"
          aria-label={`Ghi chú ${student.name}`}
          value={student.note}
          maxLength={245}
          placeholder="Thêm ghi chú…"
          disabled={!editable}
          onChange={(event) => onChange(student.studentId, { note: event.target.value })}
        />
      </td>
    </tr>
  );
}

export default function Attendance() {
  usePageHeader('Điểm danh hỗ trợ', 'Hỗ trợ điểm danh thủ công cho các buổi học được phân công');
  const { data, loading, loadError, reloadData } = useAssistant();
  const { notify } = useManager();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get('date') || todayISO();
  const classId = searchParams.get('classId') || '';
  const sessionId = searchParams.get('sessionId') || '';
  const [items, setItems] = useState([]);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const attendanceResource = useAsyncData(
    () => getAttendanceSession({ sessionId, classId, date }),
    [date, classId, sessionId]
  );

  useEffect(() => {
    const rows = attendanceResource.data?.attendance?.rows ?? [];
    setItems(rows.map((row) => ({ ...row })));
    setSavedSnapshot(JSON.stringify(createAttendanceSnapshot(rows)));
    setError('');
  }, [attendanceResource.data]);

  const hasUnsavedChanges =
    Boolean(attendanceResource.data?.attendance) &&
    JSON.stringify(createAttendanceSnapshot(items)) !== savedSnapshot;
  useUnsavedChanges(hasUnsavedChanges, {
    message: 'Điểm danh chưa được lưu. Rời trang và bỏ các thay đổi này?',
  });

  function changeSession(changes) {
    if (savingRef.current) return;
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('sessionId');
    for (const [paramName, value] of Object.entries(changes)) {
      if (value) nextSearchParams.set(paramName, value);
      else nextSearchParams.delete(paramName);
    }
    setSearchParams(nextSearchParams);
  }

  function changeAttendance(studentId, changes) {
    setItems((rows) =>
      rows.map((row) => (row.studentId === studentId ? { ...row, ...changes } : row))
    );
    setError('');
  }

  async function saveAttendance() {
    if (savingRef.current) return;
    if (items.some((student) => !student.status)) {
      setError('Vui lòng chọn trạng thái cho tất cả học viên trước khi lưu.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    const sessionIdToSave = attendanceResource.data.attendance.sessionId;
    try {
      const updatedAttendance = await assistantData.saveAttendance(sessionIdToSave, {
        records: createAttendanceSnapshot(items),
        reason: 'Cập nhật từ màn hình điểm danh hỗ trợ',
      });
      // Dùng ngay phản hồi lưu thành công, không tải lại cả lịch và danh sách.
      attendanceResource.setData((previousData) =>
        String(previousData?.attendance?.sessionId) === String(sessionIdToSave)
          ? { ...previousData, attendance: updatedAttendance }
          : previousData
      );
      notify('Đã lưu điểm danh hỗ trợ');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Chưa lưu được điểm danh. Vui lòng thử lại.'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (loadError) return <LoadingState error={loadError} onRetry={reloadData} />;
  if (loading && !data.classes.length) return <LoadingState />;

  const classes = data.classes.filter((classItem) => hasPermission(classItem, 'attendance'));
  const attendance = attendanceResource.data?.attendance;
  const selectedSession = attendanceResource.data?.selectedSession;
  const sessions = attendanceResource.data?.sessions ?? [];
  const editable = attendance?.editable && !saving;
  const filteredItems = filterByQuery(items, query, (student) => `${student.name} ${student.code}`);
  const stats = countAttendance(items);
  const className =
    selectedSession?.name ||
    data.classes.find((classItem) => String(classItem.id) === String(attendance?.classId))?.name;

  return (
    <div className="ta-workflow-page">
      <Card className="ta-attendance-selectors">
        <SelectField
          label="Lớp hỗ trợ"
          value={attendance?.classId ?? classId}
          onChange={(event) => changeSession({ classId: event.target.value })}
          options={[
            { value: '', label: 'Tất cả lớp được phân công' },
            ...classes.map((classItem) => ({ value: String(classItem.id), label: classItem.name })),
          ]}
        />
        <TextField
          label="Ngày hỗ trợ"
          type="date"
          icon={CalendarDays}
          value={attendance?.date ?? date}
          onChange={(event) => changeSession({ date: event.target.value })}
        />
        {sessions.length > 1 && (
          <SelectField
            label="Buổi học"
            value={selectedSession?.id ?? ''}
            options={[
              { value: '', label: 'Chọn buổi học' },
              ...sessions
                .filter((session) => hasPermission(session, 'attendance'))
                .map((session) => ({
                  value: String(session.id),
                  label: `${session.time} · ${session.name}`,
                })),
            ]}
            onChange={(event) =>
              changeSession({ sessionId: event.target.value, date: attendance?.date ?? date })
            }
          />
        )}
      </Card>

      {!attendanceResource.data ? (
        <LoadingState error={attendanceResource.error} onRetry={attendanceResource.reload} />
      ) : !attendance ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title={
              classes.length
                ? 'Không có buổi hỗ trợ trong ngày đã chọn'
                : 'Bạn chưa được cấp quyền điểm danh lớp nào'
            }
            description="Chọn ngày khác hoặc mở buổi học từ lịch hỗ trợ để điểm danh đúng lớp."
          >
            <Btn to="/assistant/lichhotro" variant="muted" icon={CalendarDays}>
              Xem lịch hỗ trợ
            </Btn>
          </EmptyState>
        </Card>
      ) : (
        <>
          <Card className="ta-attendance-card">
            <div className="ta-attendance-heading">
              <div>
                <h2>{className}</h2>
                <p>
                  {formatDate(attendance.date)}
                  {selectedSession && (
                    <>
                      {' '}
                      · {selectedSession.time} · <MapPin size={12} /> {selectedSession.room} · Hỗ
                      trợ {selectedSession.teacher}
                    </>
                  )}
                </p>
              </div>
              <Btn
                icon={Save}
                onClick={saveAttendance}
                disabled={!editable || !hasUnsavedChanges || stats.unmarked > 0 || !items.length}
              >
                {saving ? 'Đang lưu…' : 'Lưu điểm danh'}
              </Btn>
            </div>
            {!attendance.editable && (
              <div className="ta-attendance-readonly" role="status">
                <Info size={16} />
                {getReadOnlyReason(attendance, selectedSession)}
              </div>
            )}
            <div className="ta-attendance-stats">
              <MiniStat label="Có mặt" value={stats.present} />
              <MiniStat label="Đi trễ" value={stats.late} />
              <MiniStat label="Vắng" value={stats.absent} />
              <MiniStat label="Chưa điểm danh" value={stats.unmarked} />
            </div>
            <div className="ta-workflow-filters">
              <SearchBox
                value={query}
                onChange={setQuery}
                placeholder="Tìm học viên theo tên hoặc mã…"
              />
              <Btn
                variant="muted"
                size="sm"
                icon={Check}
                disabled={!editable || !items.length}
                onClick={() =>
                  setItems((rows) => rows.map((row) => ({ ...row, status: 'present' })))
                }
              >
                Tất cả có mặt
              </Btn>
            </div>
            <div className="ta-grade-table-wrap">
              <table className="ta-attendance-table">
                <thead>
                  <tr>
                    <th>HỌC VIÊN</th>
                    <th>TRẠNG THÁI ĐIỂM DANH</th>
                    <th>GHI CHÚ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((student) => (
                    <AttendanceRow
                      key={student.studentId}
                      student={student}
                      editable={editable}
                      onChange={changeAttendance}
                    />
                  ))}
                  {!filteredItems.length && (
                    <tr>
                      <td colSpan={3} className="ta-no-results">
                        {items.length
                          ? 'Không tìm thấy học viên phù hợp.'
                          : 'Buổi học chưa có học viên ghi danh.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="ta-attendance-footer">
              <span role="status">
                {hasUnsavedChanges ? (
                  <Chip tone="amber">Có thay đổi chưa lưu</Chip>
                ) : attendance.savedAt ? (
                  <>
                    <Check size={14} /> Đã lưu lúc {formatDateTime(attendance.savedAt)}
                  </>
                ) : (
                  'Chọn trạng thái cho từng học viên'
                )}
                {stats.unmarked > 0 && ` · Còn ${stats.unmarked} học viên chưa điểm danh`}
              </span>
              <span>{items.length} học viên</span>
            </div>
            {error && (
              <p className="ta-workflow-error" role="alert">
                {error}
              </p>
            )}
          </Card>
          <div className="ta-workflow-note">
            <Info size={16} />
            <p>
              Điểm danh được lưu theo từng buổi học. Quyền chấm điểm được giảng viên cấp riêng tại
              mục <strong>Chấm điểm</strong>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
