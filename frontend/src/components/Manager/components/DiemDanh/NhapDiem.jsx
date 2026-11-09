import { useEffect, useState } from "react";
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
import { xuatExcel } from '../../../Lecturer/components/lophoc/taidanhsach';
import { usePageHeader, useManager } from "../../layout/ManagerContext";
import { EXAMS, avg, grade } from "./data";
import { apiGiangVien } from '../../../../api/giangvien';
import { getClassGrades, saveClassGrades } from '../../../../api/grades';
import { DangTai, useDuLieu } from '../../../Lecturer/components/dungchung/dungchung';
import UploadScoreModal from "./UploadScoreModal";

function isValidScore(value) {
  return value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 9 && (Number(value) * 2) % 1 === 0;
}
const isInvalidScore = (value) => value !== "" && !isValidScore(value);
const isComplete = (student) => student.s.every(isValidScore);

export default function NhapDiem() {
  const navigate = useNavigate();
  const { notify } = useManager();
  const [params] = useSearchParams();
  const classesRequest = useDuLieu(() => apiGiangVien.classes());
  const [selectedName, setClassName] = useState(params.get('lop') || '');
  const selectedClass = classesRequest.data?.find(item => item.name === selectedName) ?? classesRequest.data?.[0];
  const className = selectedClass?.name ?? '';
  const [exam, setExam] = useState(params.get('test') || EXAMS[0]);
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upload, setUpload] = useState(false);
  const teacher = selectedClass?.teacher ?? '';
  const remote = useDuLieu(() => selectedClass ? getClassGrades(selectedClass.id, exam) : null, [selectedClass?.id, exam]);
  const readonly = remote.data?.status === 'published';
  useEffect(() => {
    setRows(remote.data?.rows.map(row => ({ ...row, id: row.studentId, s: row.scores })) ?? []);
    setDirty(false);
  }, [remote.data]);
  usePageHeader("Nhập điểm", `Nhập điểm thay giảng viên · ${className} · ${exam}`);

  function updateScore(rowIndex, skillIndex, value) {
    setDirty(true);
    setRows((students) => students.map((student, index) => {
      if (index !== rowIndex) return student;
      const scores = [...student.s];
      scores[skillIndex] = value;
      return { ...student, s: scores };
    }));
  }

  function updateNote(rowIndex, note) {
    setDirty(true);
    setRows((students) => students.map((student, index) => (
      index === rowIndex ? { ...student, note } : student
    )));
  }

  async function downloadTemplate() {
    try {
      await xuatExcel(`Mau-diem-${className}`, ['Mã học viên', 'Họ và tên', 'Nghe', 'Đọc', 'Nói', 'Viết'],
        rows.map(student => [student.id, student.name, '', '', '', '']));
      notify('Đã tải file mẫu');
    } catch (error) { notify(error.message); }
  }

  async function saveGrades(status = 'draft') {
    if (!selectedClass || !remote.data || readonly || saving) return;
    setSaving(true);
    try {
      const result = await saveClassGrades(selectedClass.id, { ...remote.data, test: exam, status,
        rows: rows.map(row => ({ studentId: row.id, scores: row.s, note: row.note })) });
      remote.setData(result); setDirty(false);
      notify(result.status === 'published' ? 'Đã lưu và công bố bảng điểm' : 'Đã lưu bảng điểm');
    } catch (error) { notify(error.message); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    if (!dirty || readonly || saving) return;
    const timer = setTimeout(() => saveGrades(), 30000);
    return () => clearTimeout(timer);
  }, [rows, dirty, readonly, saving]);

  const entered = rows.filter(isComplete).length;
  const hasError = rows.some((student) => student.s.some(isInvalidScore));

  if (!classesRequest.data || !remote.data) return <DangTai error={classesRequest.error || remote.error || (classesRequest.data?.length === 0 ? 'Chưa có lớp học' : '')} retry={() => { classesRequest.reload(); remote.reload(); }} />;

  return (
    <div className="u-page">
      <Card className="ds-entry">
        <div style={{ width: 210 }}>
          <SelectField
            small
            options={classesRequest.data.map(item => item.name)}
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          />
        </div>
        <div style={{ width: 190 }}>
          <SelectField
            small
            options={[...new Set([exam, ...EXAMS])]}
            value={exam}
            onChange={(e) => setExam(e.target.value)}
          />
        </div>
        <span className="ds-saved">
          <Check size={12} style={{ verticalAlign: -2 }} /> {dirty ? 'Có thay đổi chưa lưu' : remote.data.updatedAt ? `Đã lưu ${new Date(remote.data.updatedAt).toLocaleString('vi-VN')}` : 'Chưa lưu điểm'}
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
                          disabled={readonly || saving}
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
                        disabled={readonly || saving}
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
          {teacher} · {remote.data.updatedAt ? new Date(remote.data.updatedAt).toLocaleString('vi-VN') : '—'}
        </span>
        <div className="u-row">
          <Btn
            variant="ghost"
            size="md"
            icon={Lock}
            disabled={saving || readonly || entered !== rows.length || !rows.length}
            onClick={() => saveGrades('published')}
          >
            Khóa bảng điểm
          </Btn>
          <Btn
            variant="ghost"
            size="md"
            disabled={saving || readonly || hasError}
            onClick={() => saveGrades('draft')}
          >
            Lưu nháp
          </Btn>
          <Btn
            size="md"
            icon={Check}
            disabled={saving || readonly || hasError || entered !== rows.length || !rows.length}
            onClick={() => saveGrades('published')}
          >
            Lưu &amp; Công bố
          </Btn>
        </div>
      </div>

      {upload && (
        <UploadScoreModal
          classId={selectedClass.id}
          test={exam}
          onClose={() => setUpload(false)}
          onSubmit={(n) => {
            setUpload(false);
            remote.reload();
            notify(`Đã nhập ${n} dòng điểm từ file`);
          }}
        />
      )}
    </div>
  );
}
