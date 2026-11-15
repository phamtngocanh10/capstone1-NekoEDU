import { useState } from 'react';
import { Award, CalendarCheck, Download, Eye, TrendingUp } from 'lucide-react';
import { Btn, Card, Chip, DataTable, SelectField } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { SectionHeader, EmptyState } from '../shared/DungChung';
import { formatDate, todayISO, downloadPdfReport, getCourseName } from '../shared/tienIch';
import '../../styles/hoc-tap.css';

const ATTENDANCE_STATUSES = {
  coMat: { nhan: 'Có mặt', mau: 'green' },
  diTre: { nhan: 'Đi trễ', mau: 'amber' },
  vangCoPhep: { nhan: 'Vắng có phép', mau: 'blue' },
  vangKhongPhep: { nhan: 'Vắng không phép', mau: 'red' },
};

function AttendanceSummary({ sessions, month: selectedMonth }) {
  const presentCount = sessions.filter((session) =>
    ['coMat', 'diTre'].includes(session.trangThai)
  ).length;
  const lateCount = sessions.filter((session) => session.trangThai === 'diTre').length;
  const excusedCount = sessions.filter((session) => session.trangThai === 'vangCoPhep').length;
  const absentCount = sessions.filter((session) => session.trangThai === 'vangKhongPhep').length;
  const attendanceRate = sessions.length ? Math.round((presentCount / sessions.length) * 100) : 0;
  const circumference = 2 * Math.PI * 56;

  return (
    <Card className="sp-attendance-summary">
      <SectionHeader title={`Chuyên cần tháng ${Number(selectedMonth.slice(5))}`} />
      {sessions.length ? (
        <>
          <div
            className="sp-attendance-donut"
            role="img"
            aria-label={`Chuyên cần ${attendanceRate}%, có mặt ${presentCount} trên ${sessions.length} buổi`}
          >
            <svg viewBox="0 0 144 144" aria-hidden="true">
              <circle className="sp-attendance-donut__track" cx="72" cy="72" r="56" />
              <circle
                className="sp-attendance-donut__value"
                cx="72"
                cy="72"
                r="56"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - attendanceRate / 100)}
              />
            </svg>
            <div>
              <strong>{attendanceRate}%</strong>
              <span>
                {presentCount}/{sessions.length} buổi
              </span>
            </div>
          </div>
          <div className="sp-attendance-counts">
            <span>
              <i className="is-present" />
              Có mặt <strong>{presentCount}</strong>
            </span>
            <span>
              <i className="is-excused" />
              Vắng có phép <strong>{excusedCount}</strong>
            </span>
            <span>
              <i className="is-absent" />
              Vắng không phép <strong>{absentCount}</strong>
            </span>
          </div>
          {lateCount > 0 && (
            <p className="sp-muted sp-attendance-late">
              Có {lateCount} buổi đi trễ, được tính vào số buổi có mặt.
            </p>
          )}
        </>
      ) : (
        <EmptyState
          title="Chưa có điểm danh"
          description="Tháng này chưa có dữ liệu điểm danh cho lựa chọn hiện tại."
        />
      )}
    </Card>
  );
}

export default function LearningResults() {
  const { data, student, enrolledCourses } = useStudentParent();
  const [courseId, setCourseId] = useState('');
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [error, setError] = useState('');
  const courseIds = new Set(enrolledCourses.map((course) => course.ma));
  const validCourseId = courseIds.has(courseId) ? courseId : '';
  const studentAttendance = data.diemDanh.filter(
    (session) =>
      session.maHocVien === student.ma && (!validCourseId || session.maKhoa === validCourseId)
  );
  const months = [
    ...new Set([
      todayISO().slice(0, 7),
      ...studentAttendance.map((session) => session.ngay.slice(0, 7)),
    ]),
  ]
    .sort()
    .reverse();
  const validMonth = months.includes(month) ? month : months[0];
  const monthSessions = studentAttendance
    .filter((session) => session.ngay.startsWith(validMonth))
    .sort((previous, next) => next.ngay.localeCompare(previous.ngay));
  const results = data.ketQua
    .filter(
      (result) =>
        result.maHocVien === student.ma && (!validCourseId || result.maKhoa === validCourseId)
    )
    .sort((previous, next) => next.ngay.localeCompare(previous.ngay));
  const latestResult = results[0];

  function downloadGradeReport() {
    try {
      downloadPdfReport(`bang-diem-${student.maSo}.pdf`, 'BẢNG ĐIỂM HỌC TẬP — DỮ LIỆU MẪU', [
        `Học viên: ${student.ten} (${student.maSo})`,
        ...results.flatMap((result) => [
          `${formatDate(result.ngay)} | ${result.tieuDe} | ${getCourseName(data, result.maKhoa)}`,
          `Điểm tổng: ${Number(result.diemTong).toFixed(1)}/10`,
          ...result.kyNang.map((skill) => `${skill.ten}: ${Number(skill.diem).toFixed(1)}/10`),
          `Nhận xét: ${result.nhanXet}`,
          '',
        ]),
      ]);
      setError('');
    } catch (downloadError) {
      setError(downloadError.message || 'Chưa tải được bảng điểm.');
    }
  }

  const resultColumns = [
    {
      key: 'tieuDe',
      label: 'Bài kiểm tra',
      render: (result) => (
        <div className="sp-result-test">
          <strong>{result.tieuDe}</strong>
          <small>
            {formatDate(result.ngay)} · {getCourseName(data, result.maKhoa)}
          </small>
        </div>
      ),
    },
    {
      key: 'diemTong',
      label: 'Điểm tổng',
      width: '14%',
      render: (result) => (
        <span className="sp-score">
          {Number(result.diemTong).toFixed(1)}
          <small>/10</small>
        </span>
      ),
    },
    { key: 'nhanXet', label: 'Nhận xét của giảng viên', width: '37%' },
    {
      key: 'chiTiet',
      label: '',
      width: '16%',
      render: (result) => (
        <Btn size="sm" variant="soft" icon={Eye} to={`/student/ketqua/${result.ma}`}>
          Xem chi tiết
        </Btn>
      ),
    },
  ];

  return (
    <div className="sp-page sp-study-page">
      <div className="sp-toolbar sp-results-filters">
        <SelectField
          label="Khóa học"
          value={validCourseId}
          onChange={(event) => setCourseId(event.target.value)}
          options={[
            { value: '', label: 'Tất cả khóa học' },
            ...enrolledCourses.map((course) => ({ value: course.ma, label: course.ten })),
          ]}
        />
        <SelectField
          label="Tháng chuyên cần"
          value={validMonth}
          onChange={(event) => setMonth(event.target.value)}
          options={months.map((monthValue) => ({
            value: monthValue,
            label: `Tháng ${Number(monthValue.slice(5))}/${monthValue.slice(0, 4)}`,
          }))}
        />
      </div>
      <div className="sp-results-summary">
        <AttendanceSummary sessions={monthSessions} month={validMonth} />
        <Card className="sp-skills-overview">
          <SectionHeader
            title="Điểm số theo kỹ năng"
            description={
              latestResult
                ? `Kết quả gần nhất: ${latestResult.tieuDe} · ${formatDate(latestResult.ngay)}`
                : undefined
            }
          />
          {latestResult ? (
            <div className="sp-skills-bars">
              {latestResult.kyNang.map((skill, index) => (
                <div className="sp-skill-column" key={skill.ten}>
                  <strong>{Number(skill.diem).toFixed(1)}</strong>
                  <div className="sp-skill-column__track">
                    <span
                      style={{
                        height: `${Math.max(0, Math.min(10, skill.diem)) * 10}%`,
                        '--sp-skill-color': `var(--glass-${['ice', 'turquoise', 'peach', 'lavender'][index % 4]})`,
                      }}
                    />
                  </div>
                  <span>{skill.ten}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có kết quả học tập"
              description="Kết quả đã công bố của học viên sẽ xuất hiện tại đây."
            />
          )}
          <p className="sp-study-meta">
            <Award size={14} />
            Thang điểm 0–10 · Kết quả minh họa
          </p>
        </Card>
      </div>

      <Card className="sp-study-results-table">
        <SectionHeader
          title="Lịch sử kiểm tra & nhận xét"
          description={`Các bài kiểm tra đã công bố của ${student.ten}`}
        >
          <Btn
            variant="soft"
            size="sm"
            icon={Download}
            disabled={!results.length}
            onClick={downloadGradeReport}
          >
            Tải bảng điểm (PDF)
          </Btn>
        </SectionHeader>
        {error && (
          <p className="sp-error" role="alert">
            {error}
          </p>
        )}
        <DataTable
          columns={resultColumns}
          rows={results}
          rowKey="ma"
          empty="Chưa có bài kiểm tra đã công bố cho lựa chọn hiện tại."
        />
      </Card>

      <Card className="sp-stack">
        <SectionHeader
          title="Lịch sử điểm danh"
          description={`Tháng ${Number(validMonth.slice(5))}/${validMonth.slice(0, 4)}`}
        />
        {monthSessions.length ? (
          <details className="sp-attendance-history">
            <summary>
              <CalendarCheck size={16} />
              Xem điểm danh {monthSessions.length} buổi học
            </summary>
            <div className="sp-attendance-history__rows">
              {monthSessions.map((session) => (
                <div key={session.ma}>
                  <time>{formatDate(session.ngay)}</time>
                  <span>{getCourseName(data, session.maKhoa)}</span>
                  <Chip tone={ATTENDANCE_STATUSES[session.trangThai]?.mau}>
                    {ATTENDANCE_STATUSES[session.trangThai]?.nhan ?? session.trangThai}
                  </Chip>
                </div>
              ))}
            </div>
          </details>
        ) : (
          <p className="sp-muted">Chưa có buổi điểm danh trong tháng đã chọn.</p>
        )}
        <p className="sp-study-meta">
          <TrendingUp size={14} />
          Đi học đều và luyện tập hằng ngày giúp duy trì tiến bộ.
        </p>
      </Card>
    </div>
  );
}
