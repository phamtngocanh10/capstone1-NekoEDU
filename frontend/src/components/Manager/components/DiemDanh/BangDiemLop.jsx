import { useParams } from "react-router-dom";
import {
  Avatar,
  BackLink,
  Btn,
  Card,
  Chip,
  DataTable,
  Pager,
} from "../../../../common/ui";
import { downloadText } from "../../../../common/format";
import { usePageHeader, useManager } from "../../layout/ManagerContext";
import { findClass } from "../KhoaHoc/data";
import { SCORE_ROWS, avg, grade } from "./data";

const SKILL_NAMES = ["Nghe", "Nói", "Đọc", "Viết"];

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
    render: (student) => student.scores[index].toFixed(1),
  })),
  {
    key: "averageScore",
    label: "Trung bình",
    width: "12%",
    render: (student) => (
      <strong style={{ color: "var(--primary-2)", fontSize: 13.5 }}>
        {student.averageScore.toFixed(1)}
      </strong>
    ),
  },
  {
    key: "grade",
    label: "Xếp loại",
    width: "12%",
    render: (student) => {
      const [label, tone] = grade(student.averageScore);
      return <Chip tone={tone}>{label}</Chip>;
    },
  },
];

export default function BangDiemLop() {
  const { classId } = useParams();
  const { notify } = useManager();
  usePageHeader("Bảng điểm lớp", "Điểm từng học viên của lớp");

  const classInfo = findClass(classId);
  const students = SCORE_ROWS.map((student) => ({
    id: student.id,
    name: student.name,
    scores: student.s,
    averageScore: avg(student.s),
  }));
  const classAverage = avg(students.map((student) => student.averageScore));

  function exportCsv() {
    const header = ["Mã HV", "Họ tên", ...SKILL_NAMES, "Trung bình"].join(",");
    const scoreRows = students.map((student) =>
      [student.id, student.name, ...student.scores, student.averageScore].join(","),
    );
    const content = [header, ...scoreRows].join("\n");

    downloadText(`Bang-diem-${classInfo.id}.csv`, content);
    notify("Đã xuất bảng điểm (CSV — bản .xlsx do backend tạo)");
  }

  return (
    <div className="u-page">
      <BackLink to="/diemdanh">Điểm số</BackLink>
      <Card className="ds-head">
        <div className="u-grow">
          <h2>{classInfo.name} · Bảng điểm giữa kỳ</h2>
          <Chip tone="green">Đã công bố</Chip>
          <p>
            GV {classInfo.teacher} · 12 học viên · Xác nhận 11/09/2026, 16:00 ·
            Công bố 13/09/2026, 08:00
          </p>
          <p className="ds-em ds-em--blue">
            Điểm trung bình lớp {classAverage.toFixed(1)} / 10 · Thời gian nhập
            điểm đã đóng (12/09/2026 23:59)
          </p>
        </div>
        <Btn
          variant="soft"
          to={`/diemdanh/nhap-diem?lop=${encodeURIComponent(classInfo.name)}`}
        >
          Nhập hộ điểm
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => notify("Đã mở lại nhập điểm cho giảng viên")}
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
          text="Hiển thị 8 / 12 học viên · Điểm do giảng viên nhập và xác nhận; Manager chỉ đặt thời gian, nhập hộ khi cần"
          pages={2}
        />
      </Card>
    </div>
  );
}
