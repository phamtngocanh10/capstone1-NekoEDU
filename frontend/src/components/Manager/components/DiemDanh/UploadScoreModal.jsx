import { useState } from "react";
import {
  CircleCheck,
  CircleX,
  FileSpreadsheet,
  TriangleAlert,
  Download,
  Check,
} from "lucide-react";
import { Btn, CheckRow, DataTable, Dialog } from "../../../../common/ui";
import { UPLOAD_ROWS } from "./data";

const SHEETS = ["KID TEEN 2A (18)", "KID TEEN 3B (16)", "KINDY 1A (12)"];

export default function UploadScoreModal({ onSubmit, onClose }) {
  const [sheet, setSheet] = useState(0);
  const [file, setFile] = useState({
    name: "Bang-diem-giua-ky-toan-trung-tam.xlsx",
    meta: "XLSX · 118 KB · 3 sheet · 40 dòng dữ liệu",
  });
  const [overwrite, setOverwrite] = useState(true);
  const [skip, setSkip] = useState(true);
  const importable = 39;

  const scoreCell = (r, i) =>
    r.bad === i ? (
      <span className="bad">{r.s[i].toFixed(1)}</span>
    ) : (
      <strong>{r.s[i].toFixed(1)}</strong>
    );
  const columns = [
    { key: "line", label: "Dòng", width: "7%" },
    { key: "id", label: "Mã HV", width: "14%" },
    {
      key: "name",
      label: "Họ tên",
      width: "20%",
      render: (r) => <strong>{r.name}</strong>,
    },
    ...["Nghe", "Đọc", "Nói", "Viết"].map((label, i) => ({
      key: label,
      label,
      width: "8%",
      render: (r) => scoreCell(r, i),
    })),
    {
      key: "res",
      label: "Kết quả",
      width: "27%",
      render: (r) =>
        r.res === "ok" ? (
          <span className="u-good u-strong">
            <Check size={12} /> Hợp lệ
          </span>
        ) : r.res === "warn" ? (
          <span className="u-warn u-strong">
            <TriangleAlert size={12} /> {r.msg}
          </span>
        ) : (
          <span className="u-bad u-strong">
            <CircleX size={12} /> {r.msg}
          </span>
        ),
    },
  ];

  return (
    <Dialog
      title="Tải file điểm lên"
      subtitle="Nhập điểm hàng loạt cho nhiều lớp từ một file Excel"
      size="xl"
      onClose={onClose}
    >
      <div className="up-steps">
        <span className="is-done">
          <b>
            <Check size={12} />
          </b>
          Chọn file
        </span>
        <i />
        <span className="is-now">
          <b>2</b>Kiểm tra dữ liệu
        </span>
        <i />
        <span>
          <b>3</b>Nhập vào hệ thống
        </span>
      </div>

      <div className="up-file">
        <span className="exp-file__icon">
          <FileSpreadsheet size={16} />
        </span>
        <div className="u-grow">
          <strong>{file.name}</strong>
          <small>{file.meta}</small>
        </div>
        <label className="u-link" style={{ cursor: "pointer" }}>
          Đổi file
          <input
            type="file"
            hidden
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                setFile({
                  name: f.name,
                  meta: `${f.name.split(".").pop().toUpperCase()} · ${Math.max(1, Math.round(f.size / 1024))} KB`,
                });
            }}
          />
        </label>
      </div>

      <div className="u-row u-row--between" style={{ margin: "14px 0 0" }}>
        <div className="u-pills">
          {SHEETS.map((s, i) => (
            <button
              key={s}
              type="button"
              className={i === sheet ? "u-pill is-active" : "u-pill"}
              onClick={() => setSheet(i)}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="u-faint" style={{ fontSize: 11 }}>
          Tự nhận diện lớp theo tên sheet
        </span>
      </div>

      <div className="up-tiles">
        <div className="up-tile">
          <small>Đọc được</small>
          <b>40 dòng</b>
        </div>
        <div className="up-tile up-tile--green">
          <small>Hợp lệ</small>
          <b>37</b>
        </div>
        <div className="up-tile up-tile--amber">
          <small>Cảnh báo</small>
          <b>2</b>
        </div>
        <div className="up-tile up-tile--red">
          <small>Lỗi</small>
          <b>1</b>
        </div>
      </div>

      <div className="up-table">
        <DataTable
          columns={columns}
          rows={UPLOAD_ROWS}
          rowKey="line"
          chevron={false}
          rowClass={(r) =>
            r.res === "warn" ? "is-warn" : r.res === "err" ? "is-err" : ""
          }
        />
      </div>

      <div className="u-row" style={{ gap: 40, marginTop: 14 }}>
        <CheckRow checked={overwrite} onChange={setOverwrite}>
          Ghi đè điểm đã nhập trước đó
        </CheckRow>
        <CheckRow checked={skip} onChange={setSkip}>
          Bỏ qua dòng lỗi, chỉ nhập dòng hợp lệ
        </CheckRow>
      </div>

      <div className="u-modal__foot u-modal__foot--split">
        <button type="button" className="u-link">
          <Download size={13} style={{ verticalAlign: -2 }} /> Tải file lỗi
          (.xlsx)
        </button>
        <div className="u-row">
          <Btn variant="ghost" size="sq" onClick={onClose}>
            Hủy
          </Btn>
          <Btn
            size="sq"
            icon={CircleCheck}
            disabled={!skip}
            onClick={() => onSubmit(importable)}
          >
            Nhập {importable} dòng hợp lệ
          </Btn>
        </div>
      </div>
    </Dialog>
  );
}
