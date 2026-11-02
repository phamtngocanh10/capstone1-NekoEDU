import { useMemo, useState } from "react";
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

const valid = (v) =>
  v !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 9;
const wrong = (v) => v !== "" && !valid(v);
const TEACHERS = {
  "KID TEEN 2A": "Trần Minh Khôi",
  "KID TEEN 3B": "Trần Minh Khôi",
  "KID TEEN 1B": "Lê Anh Dũng",
  "KINDY 1A": "Phạm Thu Hà",
};

export default function NhapDiem() {
  const navigate = useNavigate();
  const { notify } = useManager();
  const [params] = useSearchParams();
  const initialClass = ENTRY_CLASSES.includes(params.get("lop"))
    ? params.get("lop")
    : ENTRY_CLASSES[0];
  const [cls, setCls] = useState(initialClass);
  const [exam, setExam] = useState(EXAMS[0]);
  const [rows, setRows] = useState(ENTRY_ROWS);
  const [upload, setUpload] = useState(false);
  const teacher = TEACHERS[cls];
  usePageHeader("Nhập điểm", `Nhập điểm thay giảng viên · ${cls} · ${exam}`);

  const set = (ri, si, v) =>
    setRows((l) =>
      l.map((r, i) =>
        i === ri ? { ...r, s: r.s.map((x, j) => (j === si ? v : x)) } : r,
      ),
    );
  const setNote = (ri, v) =>
    setRows((l) => l.map((r, i) => (i === ri ? { ...r, note: v } : r)));
  const done = (r) => r.s.every(valid);
  const entered = useMemo(() => rows.filter(done).length, [rows]);
  const hasError = rows.some((r) => r.s.some(wrong));

  return (
    <div className="u-page">
      <Card className="ds-entry">
        <div style={{ width: 210 }}>
          <SelectField
            small
            options={ENTRY_CLASSES}
            value={cls}
            onChange={(e) => setCls(e.target.value)}
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
          onClick={() => {
            downloadText(
              "Mau-nhap-diem.csv",
              `STT,Họ tên,Nghe,Đọc,Nói,Viết\n${rows.map((r, i) => `${i + 1},${r.name},,,,`).join("\n")}`,
            );
            notify("Đã tải file mẫu");
          }}
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
              {rows.map((r, ri) => {
                const total = done(r) ? avg(r.s) : null;
                const g = grade(total);
                return (
                  <tr key={r.name}>
                    <td>{ri + 1}</td>
                    <td>
                      <div className="u-person">
                        <Avatar
                          name={r.name}
                          initial="last"
                          size={28}
                          tone="soft"
                        />
                        <strong>{r.name}</strong>
                      </div>
                    </td>
                    {r.s.map((v, si) => (
                      <td key={si}>
                        <input
                          className={wrong(v) ? "ds-in is-error" : "ds-in"}
                          inputMode="decimal"
                          value={v}
                          placeholder="–"
                          aria-label={`${r.name} – điểm ${["nghe", "đọc", "nói", "viết"][si]}`}
                          title={
                            wrong(v) ? "Điểm phải từ 0 đến 9.0" : undefined
                          }
                          onChange={(e) =>
                            set(ri, si, e.target.value.replace(",", "."))
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <strong style={{ color: "var(--primary-2)" }}>
                        {total === null ? "–" : total.toFixed(1)}
                      </strong>
                    </td>
                    <td>{g ? <Chip tone={g[1]}>{g[0]}</Chip> : "–"}</td>
                    <td>
                      <input
                        className="ds-note"
                        value={r.note}
                        placeholder="Thêm ghi chú..."
                        onChange={(e) => setNote(ri, e.target.value)}
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
            onClick={() => {
              notify("Đã lưu và công bố bảng điểm");
              navigate("/diemdanh");
            }}
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
