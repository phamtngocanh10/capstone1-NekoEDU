import { useState } from 'react'
import { Download, FileSpreadsheet, Lock, Upload, Users } from 'lucide-react'
import { Btn, CheckRow, Dialog, SelectField, Switch } from '../../../../common/ui'
import { todayText } from '../../../../common/format'
import { exportStudentFile, studentImportHeaders } from '../../../../api/studentExports'
import { useManager } from '../../layout/ManagerContext'
import { apiError } from '../KhoaHoc/data'
import { EXPORT_FIELDS } from './data'

const TYPES = [
  { value: 'list', icon: Users, title: 'Danh sách học viên', desc: 'Hồ sơ, lớp đang học, học phí và trạng thái của học viên' },
  { value: 'template', icon: Upload, title: 'Mẫu nhập học viên hàng loạt', desc: 'File .xlsx mẫu để thêm nhiều học viên cùng lúc' },
]
const FORMATS = [['xlsx', 'Excel (.xlsx)'], ['csv', 'CSV (.csv)'], ['pdf', 'PDF']]
const TUITION = { paid: 'Đã thanh toán', overdue: 'Quá hạn', pending: 'Chưa thanh toán' }

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

function fieldValue(student, key) {
  if (key === 'tuition') return TUITION[student.tuition]
  if (key === 'status') return student.status === 'studying' ? 'Đang học' : 'Ngừng học'
  if (key === 'contact') return student.parentPhone ?? ''
  return student[key]
}

export default function ExportModal({ students, total, onDone, onClose }) {
  const { notify } = useManager()
  const [type, setType] = useState('list')
  const [selectedColumns, setSelectedColumns] = useState(() => new Set(EXPORT_FIELDS.filter((field) => field.key !== 'status').map((field) => field.key)))
  const [format, setFormat] = useState('xlsx')
  const [scope, setScope] = useState('all')
  const [sort, setSort] = useState('name')
  const [withLogo, setWithLogo] = useState(true)

  function toggleColumn(key, checked) {
    setSelectedColumns((currentColumns) => {
      const nextColumns = new Set(currentColumns)
      if (checked) nextColumns.add(key)
      else nextColumns.delete(key)
      return nextColumns
    })
  }
  const date = todayText().replace(/\//g, '-')
  const fileName = type === 'list' ? `DS-Hoc-vien-toan-trung-tam_${date}.${format}` : `Mau-nhap-hoc-vien.${format}`
  const selectedFields = EXPORT_FIELDS.filter((field) => selectedColumns.has(field.key))

  async function submit() {
    const rows = students.filter((student) => {
      if (scope === 'all') return true
      if (scope === 'studying') return student.status === 'studying'
      return student.tuition === 'overdue'
    })
    rows.sort((first, second) => {
      if (sort === 'name') return first.name.localeCompare(second.name, 'vi')
      const firstDate = first.joined.split('/').reverse().join()
      const secondDate = second.joined.split('/').reverse().join()
      return secondDate.localeCompare(firstDate)
    })

    try {
      const headers = type === 'template' ? studentImportHeaders : selectedFields.map((field) => field.label)
      const values = type === 'template' ? [] : rows.map((student) => selectedFields.map((field) => fieldValue(student, field.key)))
      await exportStudentFile({ name: fileName, format, headers, rows: values, withLogo: type === 'list' && withLogo })
      onDone(fileName)
    } catch (error) { notify(apiError(error)) }
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
        <button type="button" className="u-link" onClick={() => setSelectedColumns(new Set(EXPORT_FIELDS.map((field) => field.key)))}>Chọn tất cả</button>
      </div>
      <div className="exp-checks">
        {EXPORT_FIELDS.map((field) => (
          <CheckRow key={field.key} checked={selectedColumns.has(field.key)} disabled={field.locked} onChange={(on) => toggleColumn(field.key, on)}>
            {field.label}
            {field.locked && <Lock size={12} className="u-faint" style={{ marginLeft: 'auto' }} />}
          </CheckRow>
        ))}
      </div>

      <div className="exp-step"><b>3</b>Định dạng &amp; phạm vi</div>
      <div className="exp-opts">
        <div className="u-seg">
          {FORMATS.map(([value, label]) => <button key={value} type="button" className={format === value ? 'is-active' : ''} onClick={() => setFormat(value)}>{label}</button>)}
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
