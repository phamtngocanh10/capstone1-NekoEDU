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

const SHEETS = ["KID 2A (18)", "KID 3B (16)", "KINDY 1A (12)"];
const RESULT = {
  ok: { Icon: Check, className: "u-good u-strong" },
  warn: { Icon: TriangleAlert, className: "u-warn u-strong" },
  err: { Icon: CircleX, className: "u-bad u-strong" },
};

function renderResult(row) {
  const { Icon, className } = RESULT[row.res] ?? RESULT.err;
  return <span className={className}><Icon size={12} /> {row.res === "ok" ? "Hợp lệ" : row.msg}</span>;
}

export default function UploadScoreModal({ onSubmit, onClose }) {
  const [sheet, setSheet] = useState(0);
  const [file, setFile] = useState({
    name: "Bang-diem-giua-ky-toan-trung-tam.xlsx",
    meta: "XLSX · 118 KB · 3 sheet · 40 dòng dữ liệu",
  });
  const [overwrite, setOverwrite] = useState(true);
  const [skip, setSkip] = useState(true);
  const importable = 39;

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    const extension = selectedFile.name.split(".").pop().toUpperCase();
    const sizeInKb = Math.max(1, Math.round(selectedFile.size / 1024));
    setFile({ name: selectedFile.name, meta: `${extension} · ${sizeInKb} KB` });
  }

  const scoreCell = (row, index) =>
    row.bad === index ? (
      <span className="bad">{row.s[index].toFixed(1)}</span>
    ) : (
      <strong>{row.s[index].toFixed(1)}</strong>
    );
  const columns = [
    { key: "line", label: "Dòng", width: "7%" },
    { key: "id", label: "Mã HV", width: "14%" },
    {
      key: "name",
      label: "Họ tên",
      width: "20%",
      render: (row) => <strong>{row.name}</strong>,
    },
    ...["Nghe", "Đọc", "Nói", "Viết"].map((label, index) => ({
      key: label,
      label,
      width: "8%",
      render: (row) => scoreCell(row, index),
    })),
    {
      key: "res",
      label: "Kết quả",
      width: "27%",
      render: renderResult,
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
        <index />
        <span className="is-now">
          <b>2</b>Kiểm tra dữ liệu
        </span>
        <index />
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
            onChange={handleFileChange}
          />
        </label>
      </div>

      <div className="u-row u-row--between" style={{ margin: "14px 0 0" }}>
        <div className="u-pills">
          {SHEETS.map((s, index) => (
            <button
              key={s}
              type="button"
              className={index === sheet ? "u-pill is-active" : "u-pill"}
              onClick={() => setSheet(index)}
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
          rowClass={(row) => ({ warn: "is-warn", err: "is-err" })[row.res] ?? ""}
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
