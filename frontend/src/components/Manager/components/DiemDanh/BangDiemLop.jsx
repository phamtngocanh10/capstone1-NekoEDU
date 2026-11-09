import { useParams, useSearchParams } from "react-router-dom";
import {
  Avatar,
  BackLink,
  Btn,
  Card,
  Chip,
  DataTable,
  Pager,
} from "../../../../common/ui";
import { xuatExcel } from '../../../Lecturer/components/lophoc/taidanhsach';
import { usePageHeader, useManager } from "../../layout/ManagerContext";
import { avg, grade } from "./data";
import { apiGiangVien } from '../../../../api/giangvien';
import { getClassGrades, reopenClassGrades } from '../../../../api/grades';
import { DangTai, useDuLieu } from '../../../Lecturer/components/dungchung/dungchung';

const SKILL_NAMES = ["Nghe", "Đọc", "Nói", "Viết"];

const COLUMNS = [
  {
    key: "name",
    label: "Học viên",
    width: "28%",
    render: (student) => (
      <div className="u-person">
        <Avatar name={student.name} initial="first" tone="soft" />
        <div>
          <strong>{student.name}</strong>
          <small>{student.id}</small>
        </div>
      </div>
    ),
  },
  ...SKILL_NAMES.map((label, index) => ({
    key: label,
    label,
    width: "11%",
    render: (student) => student.scores[index] === '' ? '—' : Number(student.scores[index]).toFixed(1),
  })),
  {
    key: "averageScore",
    label: "Trung bình",
    width: "12%",
    render: (student) => (
      <strong style={{ color: "var(--primary-2)", fontSize: 13.5 }}>
        {student.averageScore === null ? '—' : student.averageScore.toFixed(1)}
      </strong>
    ),
  },
  {
    key: "grade",
    label: "Xếp loại",
    width: "12%",
    render: (student) => {
      const [label, tone] = grade(student.averageScore) ?? ['—', 'gray'];
      return <Chip tone={tone}>{label}</Chip>;
    },
  },
];

export default function BangDiemLop() {
  const { classId } = useParams();
  const [params] = useSearchParams();
  const test = params.get('test') || 'Kiểm tra giữa kỳ';
  const { notify } = useManager();
  usePageHeader("Bảng điểm lớp", "Điểm từng học viên của lớp");

  const remote = useDuLieu(async () => ({ classes: await apiGiangVien.classes(), grade: await getClassGrades(classId, test) }), [classId, test]);
  const classInfo = remote.data?.classes.find(item => item.id === classId);
  const students = (remote.data?.grade.rows ?? []).map(student => ({
    id: student.studentId, name: student.name, scores: student.scores,
    averageScore: student.scores.every(score => score !== '') ? avg(student.scores) : null,
  }));
  const classAverage = avg(students.map((student) => student.averageScore));

  async function reopen() {
    try { await reopenClassGrades(classId, remote.data.grade.test); remote.reload(); notify('Đã mở lại nhập điểm cho giảng viên'); }
    catch (error) { notify(error.message); }
  }

  if (!remote.data || !classInfo) return <DangTai error={remote.error || (remote.data ? 'Không tìm thấy lớp học' : '')} retry={remote.reload} />;

  async function exportCsv() {
    try {
      await xuatExcel(`Bang-diem-${classInfo.id}`, ["Mã HV", "Họ tên", ...SKILL_NAMES, "Trung bình"],
        students.map(student => [student.id, student.name, ...student.scores, student.averageScore]));
      notify('Đã xuất bảng điểm Excel');
    } catch (error) { notify(error.message); }
  }

  return (
    <div className="u-page">
      <BackLink to="/diemdanh">Điểm số</BackLink>
      <Card className="ds-head">
        <div className="u-grow">
          <h2>{classInfo.name} · {remote.data.grade.test}</h2>
          <Chip tone={remote.data.grade.status === 'published' ? 'green' : 'amber'}>{remote.data.grade.status === 'published' ? 'Đã công bố' : 'Chưa công bố'}</Chip>
          <p>
            GV {classInfo.teacher} · {students.length} học viên · Xác nhận {remote.data.grade.confirmedAt ? new Date(remote.data.grade.confirmedAt).toLocaleString('vi-VN') : '—'} ·
            Công bố {remote.data.grade.publishedAt ? new Date(remote.data.grade.publishedAt).toLocaleString('vi-VN') : '—'}
          </p>
          <p className="ds-em ds-em--blue">
            Điểm trung bình lớp {classAverage === null ? '—' : classAverage.toFixed(1)} / 9 · {remote.data.grade.test}
          </p>
        </div>
        <Btn
          variant="soft"
          to={`/diemdanh/nhap-diem?lop=${encodeURIComponent(classInfo.name)}&test=${encodeURIComponent(test)}`}
        >
          Nhập hộ điểm
        </Btn>
        <Btn
          variant="ghost"
          onClick={reopen}
        >
          Mở lại cho giảng viên
        </Btn>
        <Btn variant="ghost" onClick={exportCsv}>
          Xuất Excel
        </Btn>
      </Card>
      <Card>
        <DataTable columns={COLUMNS} rows={students} chevron={false} />
        <Pager
          text={`Hiển thị ${students.length} / ${students.length} học viên · Điểm do giảng viên nhập và xác nhận; Manager chỉ đặt thời gian, nhập hộ khi cần`}
          pages={1}
        />
      </Card>
    </div>
  );
}
