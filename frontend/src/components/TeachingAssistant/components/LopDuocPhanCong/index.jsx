import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock3,
  Download,
  LockKeyhole,
  MapPin,
  Search,
  Users,
} from 'lucide-react';
import { Btn, Card, Chip, DataTable, SearchBox } from '../../../../common/ui';
import { downloadText } from '../../../../common/format.js';
import { assistantData } from '../../data/duLieuTroGiang';
import { useAssistant } from '../../layout/NguCanhTroGiang';
import {
  hasPermission,
  formatDate,
  filterByQuery,
  StudentIdentity,
  LoadingState,
  EmptyState,
  useAsyncData,
} from '../shared/DungChung';
import { formatWeekdays } from '../LichHoTro/hienThiLich';

function ClassCard({ classDetails, index, selected }) {
  const details = [
    { icon: Users, content: `${classDetails.size ?? 0} học viên` },
    { icon: MapPin, content: classDetails.room || 'Chưa xếp phòng' },
    {
      icon: CalendarDays,
      content: classDetails.days?.length ? formatWeekdays(classDetails.days) : 'Chưa xếp lịch',
    },
    { icon: Clock3, content: classDetails.time || 'Chưa xếp giờ' },
  ];
  const classPath = `/assistant/lophoc/${classDetails.id}`;
  const sessionClassName = [
    'ta-class-card',
    `ta-class-card--${index % 3}`,
    selected && 'is-selected',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Card className={sessionClassName}>
      <div className="ta-class-card__top">
        <span className="ta-class-card__icon">
          <BookOpen size={21} />
        </span>
        <Chip tone={classDetails.status === 'open' ? 'green' : 'blue'}>{classDetails.code}</Chip>
      </div>
      <h2>
        <Link to={classPath}>{classDetails.name}</Link>
      </h2>
      <p className="ta-class-teacher">Hỗ trợ {classDetails.teacher || 'giảng viên phụ trách'}</p>
      <div className="ta-class-meta">
        {details.map(({ icon: Icon, content }, position) => (
          <span key={position}>
            <Icon size={14} />
            {content}
          </span>
        ))}
      </div>
      <div className="ta-class-card__actions">
        <Btn size="sm" variant={selected ? 'soft' : 'ghost'} to={classPath}>
          {selected && <Check size={13} />}Danh sách lớp
        </Btn>
        {hasPermission(classDetails, 'attendance') && (
          <Btn
            size="sm"
            icon={ClipboardCheck}
            to={`/assistant/diemdanh?classId=${classDetails.id}`}
          >
            Điểm danh
          </Btn>
        )}
      </div>
    </Card>
  );
}

function createStudentCsv(items) {
  const rows = [
    ['Mã học viên', 'Họ và tên', 'Ngày sinh', 'Điện thoại'],
    ...items.map((student) => [
      student.code,
      student.name,
      formatDate(student.birth),
      student.phone,
    ]),
  ];
  const formatCsvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return rows.map((row) => row.map(formatCsvCell).join(',')).join('\r\n');
}

const STUDENT_COLUMNS = [
  {
    key: 'rowNumber',
    label: 'STT',
    width: 56,
    render: (student) => String(student.rowNumber).padStart(2, '0'),
  },
  {
    key: 'name',
    label: 'Học viên',
    render: (student) => <StudentIdentity name={student.name} code={student.code} />,
  },
  { key: 'birth', label: 'Ngày sinh', render: (student) => formatDate(student.birth) },
  { key: 'phone', label: 'Số điện thoại', render: (student) => student.phone || '—' },
  {
    key: 'rate',
    label: 'Chuyên cần',
    render: (student) =>
      student.rate == null ? (
        '—'
      ) : (
        <Chip tone={Number(student.rate) >= 80 ? 'green' : 'amber'}>{student.rate}%</Chip>
      ),
  },
];

function StudentRoster({ classDetails, initialQuery }) {
  const [query, setQuery] = useState(initialQuery);
  const canViewRoster = hasPermission(classDetails, 'roster');
  const studentResource = useAsyncData(
    () => (canViewRoster ? assistantData.getClassStudents(classDetails.id) : []),
    [classDetails.id, canViewRoster]
  );

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery, classDetails.id]);

  const allItems = (studentResource.data ?? []).map((student, position) => ({
    ...student,
    rowNumber: position + 1,
  }));
  const displayedStudents = filterByQuery(
    allItems,
    query,
    (student) => `${student.name} ${student.code}`
  );

  function exportRoster() {
    downloadText(
      `danh-sach-${classDetails.code || classDetails.id}.csv`,
      createStudentCsv(displayedStudents)
    );
  }

  function renderRosterContent() {
    if (!canViewRoster) {
      return (
        <EmptyState
          icon={LockKeyhole}
          title="Chưa có quyền xem danh sách"
          description="Giảng viên chưa cấp quyền xem danh sách học viên cho phân công này."
        />
      );
    }
    if (studentResource.loading) {
      return (
        <div className="ta-inline-status" role="status">
          Đang tải danh sách học viên…
        </div>
      );
    }
    if (studentResource.error) {
      return <LoadingState error={studentResource.error} onRetry={studentResource.reload} />;
    }

    return (
      <>
        <div className="ta-roster-toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Tìm tên hoặc mã học viên..." />
          <Btn
            variant="soft"
            icon={Download}
            disabled={!displayedStudents.length}
            onClick={exportRoster}
          >
            Xuất danh sách
          </Btn>
        </div>
        <DataTable
          columns={STUDENT_COLUMNS}
          rows={displayedStudents}
          empty={query ? 'Không tìm thấy học viên phù hợp.' : 'Lớp chưa có học viên.'}
        />
        <div className="ta-table-footer">
          Hiển thị {displayedStudents.length} / {allItems.length} học viên
        </div>
      </>
    );
  }

  return (
    <Card pad={false} className="ta-roster-card">
      <div className="ta-roster-heading">
        <div>
          <span className="ta-eyebrow">DANH SÁCH HỌC VIÊN</span>
          <h2>{classDetails.name}</h2>
          <p>
            {classDetails.teacher} · {classDetails.room || 'Chưa xếp phòng'}
          </p>
        </div>
        <span className="ta-roster-count">
          <Users size={15} />
          {studentResource.data?.length ?? classDetails.size ?? 0} học viên
        </span>
      </div>
      {renderRosterContent()}
    </Card>
  );
}

export default function AssignedClasses() {
  const { classId } = useParams();
  const [searchParams] = useSearchParams();
  const { data, loading, loadError, reloadData, query } = useAssistant();
  const displayedClasses = filterByQuery(
    data.classes,
    query,
    (classDetails) => `${classDetails.name} ${classDetails.code} ${classDetails.teacher}`
  );
  const selectedClass =
    data.classes.find((classDetails) => String(classDetails.id) === String(classId)) ??
    (!classId ? displayedClasses[0] : null);

  if (loading && !data.classes.length) return <LoadingState />;
  if (loadError) return <LoadingState error={loadError} onRetry={reloadData} />;
  if (!data.classes.length) {
    return (
      <Card>
        <EmptyState
          icon={BookOpen}
          title="Bạn chưa được phân công lớp"
          description="Danh sách lớp và học viên sẽ xuất hiện sau khi trung tâm hoặc giảng viên phân công cho bạn."
        />
      </Card>
    );
  }

  return (
    <div className="u-page ta-classes">
      <div className="ta-class-grid">
        {displayedClasses.map((classDetails, index) => (
          <ClassCard
            key={classDetails.id}
            classDetails={classDetails}
            index={index}
            selected={selectedClass?.id === classDetails.id}
          />
        ))}
      </div>
      {!displayedClasses.length && (
        <Card>
          <EmptyState
            icon={Search}
            title="Không tìm thấy lớp học"
            description="Thử tìm theo tên lớp, mã lớp hoặc giảng viên khác."
          />
        </Card>
      )}
      {!selectedClass && classId && (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Không tìm thấy lớp được phân công"
            description="Lớp này không tồn tại hoặc bạn không còn được phân công hỗ trợ."
          />
        </Card>
      )}
      {selectedClass && (
        <StudentRoster
          key={selectedClass.id}
          classDetails={selectedClass}
          initialQuery={searchParams.get('student') || ''}
        />
      )}
    </div>
  );
}
