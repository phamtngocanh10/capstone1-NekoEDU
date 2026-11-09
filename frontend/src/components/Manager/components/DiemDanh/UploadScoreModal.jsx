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
import { importGrades, confirmGradesImport } from '../../../../api/grades';
import { xuatExcel } from '../../../Lecturer/components/lophoc/taidanhsach';

const RESULT = {
  ok: { Icon: Check, className: "u-good u-strong" },
  warn: { Icon: TriangleAlert, className: "u-warn u-strong" },
  err: { Icon: CircleX, className: "u-bad u-strong" },
};

function renderResult(row) {
  const { Icon, className } = RESULT[row.res] ?? RESULT.err;
  return <span className={className}><Icon size={12} /> {row.res === "ok" ? "Hợp lệ" : row.msg}</span>;
}

export default function UploadScoreModal({ onSubmit, onClose, classId, test }) {
  const [sheet, setSheet] = useState(0);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [overwrite, setOverwrite] = useState(true);
  const [skip, setSkip] = useState(true);
  const sheets = preview?.sheets ?? [];
  const allRows = sheets.flatMap(item => item.rows);
  const selectedRows = sheets[sheet]?.rows ?? [];
  const importable = allRows.filter(row => row.res !== 'err').length;

  async function handleFileChange(event) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    const extension = selectedFile.name.split(".").pop().toUpperCase();
    const sizeInKb = Math.max(1, Math.round(selectedFile.size / 1024));
    setFile({ name: selectedFile.name, meta: `${extension} · ${sizeInKb} KB` });
    setPreview(null); setBusy(true); setSheet(0);
    try { setPreview(await importGrades(selectedFile, { classId, test })); }
    catch (error) { window.alert(error.message); }
    finally { setBusy(false); }
  }

  async function importScores() {
    setBusy(true);
    try {
      const result = await confirmGradesImport({ overwrite,
        sheets: sheets.map(item => ({ classId: item.classId, test: item.test,
          rows: item.rows.filter(row => row.res !== 'err').map(row => ({ studentId: row.studentId, scores: row.scores, note: row.note || '' })) })) });
      onSubmit(result.imported);
    } catch (error) { window.alert(error.message); }
    finally { setBusy(false); }
  }

  async function downloadErrors() {
    try { await xuatExcel('Loi-nhap-diem', ['Sheet', 'Dòng', 'Mã HV', 'Lỗi'], sheets.flatMap(item => item.rows.filter(row => row.res === 'err').map(row => [item.name, row.line, row.id, row.msg]))); }
    catch (error) { window.alert(error.message); }
  }

  const scoreCell = (row, index) =>
    row.bad === index ? (
      <span className="bad">{row.s[index]}</span>
    ) : (
      <strong>{row.s[index] === '' ? '—' : row.s[index]}</strong>
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
          <strong>{file?.name || 'Chọn tệp điểm .xlsx'}</strong>
          <small>{busy ? 'Đang xử lý…' : file?.meta || 'Tối đa 5 MB'}</small>
        </div>
        <label className="u-link" style={{ cursor: "pointer" }}>
          Đổi file
          <input
            type="file"
            hidden
            accept=".xlsx"
            disabled={busy}
            onChange={handleFileChange}
          />
        </label>
      </div>

      <div className="u-row u-row--between" style={{ margin: "14px 0 0" }}>
        <div className="u-pills">
          {sheets.map((s, index) => (
            <button
              key={s.name}
              type="button"
              className={index === sheet ? "u-pill is-active" : "u-pill"}
              onClick={() => setSheet(index)}
            >
              {s.name} ({s.rows.length})
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
          <b>{allRows.length} dòng</b>
        </div>
        <div className="up-tile up-tile--green">
          <small>Hợp lệ</small>
          <b>{allRows.filter(row => row.res === 'ok').length}</b>
        </div>
        <div className="up-tile up-tile--amber">
          <small>Cảnh báo</small>
          <b>{allRows.filter(row => row.res === 'warn').length}</b>
        </div>
        <div className="up-tile up-tile--red">
          <small>Lỗi</small>
          <b>{allRows.filter(row => row.res === 'err').length}</b>
        </div>
      </div>

      <div className="up-table">
        <DataTable
          columns={columns}
          rows={selectedRows}
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
        <button type="button" className="u-link" onClick={downloadErrors} disabled={!allRows.some(row => row.res === 'err')}>
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
            disabled={busy || !importable || (!skip && allRows.some(row => row.res === 'err'))}
            onClick={importScores}
          >
            Nhập {importable} dòng hợp lệ
          </Btn>
        </div>
      </div>
    </Dialog>
  );
}
