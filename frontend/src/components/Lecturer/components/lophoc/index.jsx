import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpen, Download, Users } from 'lucide-react';
import { BackLink, Btn, Card, Chip, MiniStat } from '../../../../common/ui/index';
import { useTieuDeTrang } from '../../layout/ngucanh';
import { apiGiangVien } from '../../../../api/giangvien';
import { useLopGiangDay } from '../../layout/dulieulophoc';
import { DangTai, HocVien, TimKiem, BangDuLieu, khopTimKiem, useDuLieu } from '../dungchung/dungchung';
import { TaiDanhSach } from './taidanhsach';

const PAGE_SIZE = 10;

export default function LopHoc() {
  const { data, error, reload } = useDuLieu(() => apiGiangVien.classes());
  if (!data) return <DangTai error={error} retry={reload} />;
  return (
    <div className="lc-grid lc-grid--two">
      {data.map(classItem => (
        <Card className="lc-class" key={classItem.id}>
          <span className="lc-card-icon"><BookOpen size={22} /></span>
          <h2>{classItem.name}</h2>
          <p className="u-muted">{classItem.size} học viên · {classItem.room}</p>
          <p className="u-muted">{classItem.days.map(day => `T${day + 2}`).join('-')} · {classItem.time}</p>
          <div className="lc-class-rate"><strong>{classItem.rate}%</strong><span>điểm danh TB</span></div>
          <div className="lc-toolbar">
            <Btn to={`/lecturer/diemdanh?classId=${classItem.id}`}>Điểm danh</Btn>
            <Btn variant="soft" to={`/lecturer/lophoc/${classItem.id}`} icon={Users}>Danh sách</Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function DanhSachHocVien() {
  const classes = useLopGiangDay();
  const { classId } = useParams();
  const selectedClass = classes.find(classItem => classItem.id === classId);
  const subtitle = selectedClass
    ? `${selectedClass.name} · ${selectedClass.size} học viên · ${selectedClass.room}`
    : 'Không tìm thấy lớp';
  useTieuDeTrang('Danh sách học viên', subtitle);
  const remote = useDuLieu(() => apiGiangVien.roster(classId), [classId]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);

  function searchStudents(value) {
    setQuery(value);
    setPage(1);
  }

  if (!selectedClass) return <DangTai error="Không tìm thấy lớp học." />;
  if (!remote.data) return <DangTai error={remote.error} retry={remote.reload} />;
  const students = remote.data.filter(student => khopTimKiem(student, query));
  const pageStart = (page - 1) * PAGE_SIZE;
  const visibleStudents = students.slice(pageStart, pageStart + PAGE_SIZE);
  const pageNumbers = Array.from({ length: Math.ceil(students.length / PAGE_SIZE) }, (_, index) => index + 1);
  const warningCount = remote.data.filter(student => student.rate < 80).length;

  return (
    <div className="u-page lc-page">
      <BackLink to="/lecturer/lophoc">Lớp học của tôi</BackLink>
      <div className="lc-toolbar">
        <h2 className="u-grow">{selectedClass.name}</h2>
        <TimKiem value={query} onChange={searchStudents} />
        <Btn variant="soft" icon={Download} onClick={() => setExportOpen(true)}>Tải danh sách</Btn>
        <Btn to={`/lecturer/bangdiem/nhap?classId=${classId}`}>Nhập điểm lớp này</Btn>
      </div>
      <div className="lc-stats">
        <MiniStat label="Sĩ số" value={`${remote.data.length} học viên`} />
        <MiniStat label="Chuyên cần TB" value={`${selectedClass.rate}%`} />
        <MiniStat label="Lịch học" value={selectedClass.days.map(day => `T${day + 2}`).join(' · ')} />
        <MiniStat label="Cần lưu ý" value={warningCount} tone="warning" />
      </div>
      <Card pad={false}>
        <BangDuLieu headings={['STT', 'Học viên', 'Ngày sinh', 'SĐT phụ huynh', 'Chuyên cần', 'Trạng thái']}>
          {visibleStudents.map((student, index) => {
            const needsAttention = student.rate < 80;
            return (
              <tr key={student.id}>
                <td>{pageStart + index + 1}</td>
                <td><HocVien student={student} /></td>
                <td>{student.birth}</td>
                <td>{student.phone}</td>
                <td><strong className={needsAttention ? 'lc-warning' : ''}>{student.rate}%</strong></td>
                <td><Chip tone={needsAttention ? 'amber' : 'green'}>{needsAttention ? 'Cần lưu ý' : 'Đang học'}</Chip></td>
              </tr>
            );
          })}
        </BangDuLieu>
        {students.length === 0 && <p className="lc-empty">Không tìm thấy học viên.</p>}
        <div className="lc-toolbar lc-pad">
          <span className="u-grow u-muted">Hiển thị {Math.min(page * PAGE_SIZE, students.length)} / {students.length} học viên</span>
          {pageNumbers.map(pageNumber => (
            <Btn key={pageNumber} variant={page === pageNumber ? 'primary' : 'soft'} onClick={() => setPage(pageNumber)}>
              {pageNumber}
            </Btn>
          ))}
        </div>
      </Card>
      {exportOpen && <TaiDanhSach cls={selectedClass} roster={remote.data} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
