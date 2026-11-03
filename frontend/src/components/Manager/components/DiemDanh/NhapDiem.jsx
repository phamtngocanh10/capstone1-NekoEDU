import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Clock, Download, FileSpreadsheet, Lock } from "lucide-react";
import {
  Avatar,
  Btn,
  Card,
  Chip,
  Progress,
  SelectField,
} from "../../../../common/ui";
import { downloadText } from "../../../../common/format";
import { usePageHeader, useManager } from "../../layout/ManagerContext";
import { ENTRY_CLASSES, ENTRY_ROWS, EXAMS, avg, grade } from "./data";
import UploadScoreModal from "./UploadScoreModal";

function isValidScore(value) {
  return value !== "" && !Number.isNaN(Number(value)) && Number(value) >= 0 && Number(value) <= 9;
}
const isInvalidScore = (value) => value !== "" && !isValidScore(value);
const isComplete = (student) => student.s.every(isValidScore);
const TEACHERS = {
  "KID 2A": "Trần Minh Khôi",
  "KID 3B": "Trần Minh Khôi",
  "KID 1B": "Lê Anh Dũng",
  "KINDY 1A": "Phạm Thu Hà",
};

export default function NhapDiem() {
  const navigate = useNavigate();
  const { notify } = useManager();
  const [params] = useSearchParams();
  const initialClass = ENTRY_CLASSES.includes(params.get("lop"))
    ? params.get("lop")
    : ENTRY_CLASSES[0];
  const [className, setClassName] = useState(initialClass);
  const [exam, setExam] = useState(EXAMS[0]);
  const [rows, setRows] = useState(ENTRY_ROWS);
  const [upload, setUpload] = useState(false);
  const teacher = TEACHERS[className];
  usePageHeader("Nhập điểm", `Nhập điểm thay giảng viên · ${className} · ${exam}`);

  function updateScore(rowIndex, skillIndex, value) {
    setRows((students) => students.map((student, index) => {
      if (index !== rowIndex) return student;
      const scores = [...student.s];
      scores[skillIndex] = value;
      return { ...student, s: scores };
    }));
  }

  function updateNote(rowIndex, note) {
    setRows((students) => students.map((student, index) => (
      index === rowIndex ? { ...student, note } : student
    )));
  }

  function downloadTemplate() {
    const header = "STT,Họ tên,Nghe,Đọc,Nói,Viết";
    const names = rows.map((student, index) => `${index + 1},${student.name},,,,`);
    downloadText("Mau-nhap-diem.csv", [header, ...names].join("\n"));
    notify("Đã tải file mẫu");
  }

  function publishGrades() {
    notify("Đã lưu và công bố bảng điểm");
    navigate("/diemdanh");
  }

  const entered = rows.filter(isComplete).length;
  const hasError = rows.some((student) => student.s.some(isInvalidScore));

  return (
    <div className="u-page">
      <Card className="ds-entry">
        <div style={{ width: 210 }}>
          <SelectField
            small
            options={ENTRY_CLASSES}
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          />
        </div>
        <div style={{ width: 190 }}>
          <SelectField
            small
            options={EXAMS}
            value={exam}
            onChange={(e) => setExam(e.target.value)}
          />
        </div>
        <span className="ds-saved">
          <Check size={12} style={{ verticalAlign: -2 }} /> Đã tự lưu lúc 08:12
        </span>
        <span className="u-grow" />
        <Btn
          variant="ghost"
          size="md"
          icon={Download}
          onClick={downloadTemplate}
        >
          Tải mẫu / danh sách
        </Btn>
        <Btn
          variant="ghost"
          size="md"
          icon={FileSpreadsheet}
          onClick={() => setUpload(true)}
        >
          Tải file Excel lên
        </Btn>
      </Card>

      <div className="ds-banner">
        <span>
          Bạn đang nhập điểm thay giảng viên {teacher} · Mọi thay đổi được ghi
          vào nhật ký và báo cho giảng viên
        </span>
        <span className="ds-prog">
          Đã nhập <Progress value={entered} max={rows.length} />{" "}
          <b>
            {entered} / {rows.length}
          </b>
        </span>
      </div>

      <Card>
        <div className="u-table-wrap">
          <table className="u-table">
            <colgroup>
              <col style={{ width: 50 }} />
              <col style={{ width: "22%" }} />
              {[0, 1, 2, 3].map((i) => (
                <col key={i} style={{ width: 86 }} />
              ))}
              <col style={{ width: 70 }} />
              <col style={{ width: 90 }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>STT</th>
                <th>Học viên</th>
                <th>Nghe</th>
                <th>Đọc</th>
                <th>Nói</th>
                <th>Viết</th>
                <th>Tổng</th>
                <th>Xếp loại</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((student, rowIndex) => {
                const total = isComplete(student) ? avg(student.s) : null;
                const rank = grade(total);
                return (
                  <tr key={student.name}>
                    <td>{rowIndex + 1}</td>
                    <td>
                      <div className="u-person">
                        <Avatar
                          name={student.name}
                          initial="last"
                          size={28}
                          tone="soft"
                        />
                        <strong>{student.name}</strong>
                      </div>
                    </td>
                    {student.s.map((value, skillIndex) => (
                      <td key={skillIndex}>
                        <input
                          className={isInvalidScore(value) ? "ds-in is-error" : "ds-in"}
                          inputMode="decimal"
                          value={value}
                          placeholder="–"
                          aria-label={`${student.name} – điểm ${["nghe", "đọc", "nói", "viết"][skillIndex]}`}
                          title={
                            isInvalidScore(value) ? "Điểm phải từ 0 đến 9.0" : undefined
                          }
                          onChange={(e) =>
                            updateScore(rowIndex, skillIndex, e.target.value.replace(",", "."))
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <strong style={{ color: "var(--primary-2)" }}>
                        {total === null ? "–" : total.toFixed(1)}
                      </strong>
                    </td>
                    <td>{rank ? <Chip tone={rank[1]}>{rank[0]}</Chip> : "–"}</td>
                    <td>
                      <input
                        className="ds-note"
                        value={student.note}
                        placeholder="Thêm ghi chú..."
                        onChange={(e) => updateNote(rowIndex, e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="ds-foot">
        <span>
          <Clock size={12} style={{ verticalAlign: -2 }} /> Chỉnh sửa gần nhất:{" "}
          {teacher} · 08:12 hôm nay
        </span>
        <div className="u-row">
          <Btn
            variant="ghost"
            size="md"
            icon={Lock}
            onClick={() => notify("Đã khóa bảng điểm")}
          >
            Khóa bảng điểm
          </Btn>
          <Btn
            variant="ghost"
            size="md"
            onClick={() => notify("Đã lưu nháp bảng điểm")}
          >
            Lưu nháp
          </Btn>
          <Btn
            size="md"
            icon={Check}
            disabled={hasError || entered === 0}
            onClick={publishGrades}
          >
            Lưu &amp; Công bố
          </Btn>
        </div>
      </div>

      {upload && (
        <UploadScoreModal
          onClose={() => setUpload(false)}
          onSubmit={(n) => {
            setUpload(false);
            notify(`Đã nhập ${n} dòng điểm từ file`);
          }}
        />
      )}
    </div>
  );
}
