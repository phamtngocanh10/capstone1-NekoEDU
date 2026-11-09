import { useState } from 'react';
import { Btn, Dialog } from '../../../../common/ui/index';
import { LoiDuLieu, taiTep } from '../dungchung/dungchung';

const FIELDS = [
  ['id', 'Mã học viên'],
  ['name', 'Họ và tên'],
  ['birth', 'Ngày sinh'],
  ['phone', 'SĐT phụ huynh'],
  ['rate', 'Chuyên cần (%)'],
];

function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, character => entities[character]);
}

function escapeCsv(value) {
  const text = String(value ?? '').replace(/"/g, '""').replace(/^[=+@-]/, "'$&");
  return '"' + text + '"';
}

function inBang(title, headers, rows) {
  const headingHtml = headers.map(header => `<th>${escapeHtml(header)}</th>`).join('');
  const rowsHtml = rows.map(row => {
    const cells = row.map(value => `<td>${escapeHtml(value)}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  frame.title = 'Bản in danh sách học viên';
  frame.srcdoc = `<!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)}</title>
        <style>
          body { font:12px Arial,sans-serif; color:#152233; padding:24px }
          h1 { font-size:20px }
          table { width:100%; border-collapse:collapse }
          th, td { padding:10px; border:1px solid #ddd; text-align:left }
          th { background:#eef6fc }
          @page { size:A4 landscape; margin:12mm }
        </style>
      </head>
      <body>
        <h1>NEKO EDU · ${escapeHtml(title)}</h1>
        <table><thead><tr>${headingHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>
      </body>
    </html>`;
  frame.onload = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };
  document.body.appendChild(frame);
}

export async function xuatExcel(name, headers, rows) {
  const { Workbook } = await import('exceljs');
  const book = new Workbook();
  const sheet = book.addWorksheet('Bảng điểm');
  sheet.addRow(headers);
  rows.forEach(row => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1490CF' } };
  sheet.columns.forEach((column, index) => { column.width = index === 1 ? 30 : 20; });
  const buffer = await book.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  taiTep(blob, name + '.xlsx');
}

export function TaiDanhSach({ cls, roster, onClose }) {
  const [template, setTemplate] = useState(false);
  const [fields, setFields] = useState(FIELDS.map(([key]) => key));
  const [format, setFormat] = useState('xlsx');
  const [sort, setSort] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  function toggleField(key, checked) {
    setFields(current => {
      if (checked) return [...current, key];
      return current.filter(field => field !== key);
    });
  }

  async function download() {
    setIsDownloading(true);
    setError('');
    try {
      const selectedFields = template ? FIELDS.slice(0, 2) : FIELDS.filter(([key]) => fields.includes(key));
      if (!selectedFields.length) throw new Error('Chọn ít nhất một cột để xuất.');
      const headers = selectedFields.map(([, label]) => label);
      if (template) headers.push('Nghe', 'Đọc', 'Nói', 'Viết');
      const students = sort ? [...roster].sort((first, second) => first.name.localeCompare(second.name, 'vi')) : roster;
      const rows = students.map(student => {
        const values = selectedFields.map(([key]) => student[key]);
        if (template) values.push('', '', '', '');
        return values;
      });

      if (format === 'pdf') {
        inBang(cls.name, headers, rows);
      } else if (format === 'csv') {
        const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        taiTep(blob, `${cls.name}.csv`);
      } else {
        const prefix = template ? 'Mau-diem' : 'Danh-sach';
        await xuatExcel(`${prefix}-${cls.name}`, headers, rows);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Dialog title="Tải danh sách học viên" subtitle={`${cls.name} · ${roster.length} học viên`} onClose={onClose}>
      <div className="lc-dialog-body">
        <h3>1. Chọn loại tệp</h3>
        <label className="lc-check"><input type="radio" checked={!template} onChange={() => setTemplate(false)} />Danh sách học viên</label>
        <label className="lc-check"><input type="radio" checked={template} onChange={() => setTemplate(true)} />Mẫu nhập điểm — điền sẵn danh sách lớp</label>
        <h3>2. Nội dung xuất</h3>
        <div className="lc-grid lc-grid--two">
          {FIELDS.map(([key, label]) => (
            <label key={key} className="lc-check">
              <input type="checkbox" checked={template ? ['id', 'name'].includes(key) : fields.includes(key)} disabled={template} onChange={event => toggleField(key, event.target.checked)} />
              {label}
            </label>
          ))}
        </div>
        <h3>3. Định dạng & phạm vi</h3>
        <select className="lc-select" value={format} onChange={event => setFormat(event.target.value)} aria-label="Định dạng xuất">
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="csv">CSV (.csv)</option>
          <option value="pdf">PDF (In / Lưu PDF)</option>
        </select>
        <p className="u-muted">Cả lớp ({roster.length} học viên)</p>
        <label className="lc-check"><input type="checkbox" checked={sort} onChange={event => setSort(event.target.checked)} />Sắp xếp họ tên A → Z</label>
        <LoiDuLieu>{error}</LoiDuLieu>
      </div>
      <div className="lc-dialog-footer">
        <Btn variant="ghost" onClick={onClose}>Hủy</Btn>
        <Btn disabled={isDownloading} onClick={download}>{isDownloading ? 'Đang tạo tệp…' : 'Tải xuống'}</Btn>
      </div>
    </Dialog>
  );
}
