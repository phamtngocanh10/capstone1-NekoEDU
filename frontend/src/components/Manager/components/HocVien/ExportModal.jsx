import { useState } from 'react'
import { Download, FileSpreadsheet, Lock, Upload, Users } from 'lucide-react'
import { Btn, CheckRow, Dialog, SelectField, Switch } from '../../../../common/ui'
import { downloadText, todayText } from '../../../../common/format'
import { EXPORT_FIELDS } from './data'

const TYPES = [
  { value: 'list', icon: Users, title: 'Danh sách học viên', desc: 'Hồ sơ, lớp đang học, học phí và trạng thái của học viên' },
  { value: 'template', icon: Upload, title: 'Mẫu nhập học viên hàng loạt', desc: 'File .xlsx mẫu để thêm nhiều học viên cùng lúc' },
]
const FORMATS = [['xlsx', 'Excel (.xlsx)'], ['csv', 'CSV (.csv)'], ['pdf', 'PDF']]
const TUITION = { paid: 'Đã thanh toán', overdue: 'Quá hạn' }

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

// Figma 09.2. Chưa có backend: bản tải về là CSV; .xlsx/.pdf thật sẽ do API exportStudents() trả về.
export default function ExportModal({ students, total, onDone, onClose }) {
  const [type, setType] = useState('list')
  const [cols, setCols] = useState(() => new Set(EXPORT_FIELDS.filter((f) => f.key !== 'status').map((f) => f.key)))
  const [format, setFormat] = useState('xlsx')
  const [scope, setScope] = useState('all')
  const [sort, setSort] = useState('name')
  const [withLogo, setWithLogo] = useState(true)

  const toggle = (key, on) => setCols((s) => { const n = new Set(s); on ? n.add(key) : n.delete(key); return n })
  const date = todayText().replace(/\//g, '-')
  const fileName = type === 'list' ? `DS-Hoc-vien-toan-trung-tam_${date}.${format}` : `Mau-nhap-hoc-vien.${format}`
  const selected = EXPORT_FIELDS.filter((f) => cols.has(f.key))

  const submit = () => {
    let rows = students.filter((s) => scope === 'all' || (scope === 'studying' ? s.status === 'studying' : s.tuition === 'overdue'))
    rows = [...rows].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'vi') : b.joined.split('/').reverse().join().localeCompare(a.joined.split('/').reverse().join())))
    const head = selected.map((f) => csvCell(f.label)).join(',')
    const body = type === 'template' ? '' : rows.map((s) => selected.map((f) => csvCell(
      f.key === 'tuition' ? TUITION[s.tuition] : f.key === 'status' ? (s.status === 'studying' ? 'Đang học' : 'Ngừng học') : f.key === 'contact' ? s.parentPhone ?? '' : s[f.key],
    )).join(',')).join('\n')
    downloadText(fileName.replace(/\.(xlsx|pdf)$/, '.csv'), `${head}\n${body}`)
    onDone(fileName)
  }

  return (
    <Dialog title="Xuất danh sách học viên" subtitle={`Toàn trung tâm · ${total} học viên`} size="lg" onClose={onClose}>
      <div className="exp-step"><b>1</b>Chọn loại tệp</div>
      <div className="exp-types">
        {TYPES.map(({ value, icon: Icon, title, desc }) => (
          <button key={value} type="button" className={type === value ? 'exp-type is-on' : 'exp-type'} onClick={() => setType(value)}>
            <span className="u-iconcircle" style={{ width: 34, height: 34 }}><Icon size={16} /></span>
            <div><strong>{title}</strong><small>{desc}</small></div>
            <span className="u-radio" />
          </button>
        ))}
      </div>

      <div className="exp-step">
        <b>2</b>Nội dung xuất
        <button type="button" className="u-link" onClick={() => setCols(new Set(EXPORT_FIELDS.map((f) => f.key)))}>Chọn tất cả</button>
      </div>
      <div className="exp-checks">
        {EXPORT_FIELDS.map((f) => (
          <CheckRow key={f.key} checked={cols.has(f.key)} disabled={f.locked} onChange={(on) => toggle(f.key, on)}>
            {f.label}
            {f.locked && <Lock size={12} className="u-faint" style={{ marginLeft: 'auto' }} />}
          </CheckRow>
        ))}
      </div>

      <div className="exp-step"><b>3</b>Định dạng &amp; phạm vi</div>
      <div className="exp-opts">
        <div className="u-seg">
          {FORMATS.map(([v, l]) => <button key={v} type="button" className={format === v ? 'is-active' : ''} onClick={() => setFormat(v)}>{l}</button>)}
        </div>
        <SelectField icon={Users} value={scope} onChange={(e) => setScope(e.target.value)} options={[
          { value: 'all', label: `Tất cả học viên (${total})` }, { value: 'studying', label: 'Chỉ học viên đang học' }, { value: 'overdue', label: 'Chỉ học viên quá hạn học phí' },
        ]} />
        <SelectField value={sort} onChange={(e) => setSort(e.target.value)} options={[
          { value: 'name', label: 'Sắp xếp: Họ tên A → Z' }, { value: 'joined', label: 'Sắp xếp: Ngày nhập học (mới nhất)' },
        ]} />
        <div className="u-row"><span style={{ flex: 1 }}>Kèm dòng tiêu đề &amp; logo trung tâm</span><Switch checked={withLogo} onChange={setWithLogo} label="Kèm dòng tiêu đề và logo" /></div>
      </div>

      <div className="exp-file">
        <span className="exp-file__icon"><FileSpreadsheet size={16} /></span>
        <div><strong>{fileName}</strong><small>Ước tính ~ 24 KB · Tạo lúc {todayText()} {new Date().toTimeString().slice(0, 5)}</small></div>
      </div>

      <div className="u-modal__foot u-modal__foot--split">
        <span className="u-faint" style={{ fontSize: 11 }}>File được tải về máy ngay sau khi tạo</span>
        <div className="u-row">
          <Btn variant="ghost" size="sq" onClick={onClose}>Hủy</Btn>
          <Btn size="sq" icon={Download} onClick={submit}>Tải xuống</Btn>
        </div>
      </div>
    </Dialog>
  )
}
