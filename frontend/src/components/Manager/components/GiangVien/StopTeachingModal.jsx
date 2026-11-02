import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Btn, CheckRow, Dialog } from '../../../../common/ui'
import { LECTURERS, TEACHING } from './data'

// Figma 12.7 — Ngừng giảng dạy: bắt buộc chọn giảng viên thay thế cho từng lớp đang phụ trách.
export default function StopTeachingModal({ lecturer, onConfirm, onClose }) {
  const classes = TEACHING[lecturer.id] ?? []
  const options = LECTURERS.filter((l) => l.id !== lecturer.id && l.role === lecturer.role && l.status !== 'stopped')
  const [picks, setPicks] = useState(() => Object.fromEntries(classes.map((c, i) => [c.id, i === 1 ? '' : options[0]?.name ?? ''])))
  const [notify, setNotify] = useState(true)
  const ready = classes.every((c) => picks[c.id])

  return (
    <Dialog title="Ngừng giảng dạy" subtitle="Giảng viên sẽ không còn nhận lớp mới, hồ sơ được lưu trữ" onClose={onClose}>
      {classes.length > 0 && (
        <div className="stop-warn">
          <span className="stop-warn__icon">!</span>
          <div>
            <strong>{lecturer.name} đang phụ trách {classes.length} lớp</strong>
            <small>Cần phân công giảng viên thay thế trước khi ngừng giảng dạy.</small>
          </div>
        </div>
      )}
      {classes.map((c) => (
        <div key={c.id} className={picks[c.id] ? 'stop-row' : 'stop-row is-missing'}>
          <div><strong>{c.name}</strong><small>{c.schedule}</small></div>
          <div className="u-control">
            <select value={picks[c.id]} onChange={(e) => setPicks((p) => ({ ...p, [c.id]: e.target.value }))} aria-label={`Giảng viên thay thế lớp ${c.name}`}>
              <option value="">Chọn giảng viên thay thế</option>
              {options.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
            </select>
            <ChevronDown size={14} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 14 }}><CheckRow checked={notify} onChange={setNotify}>Gửi thông báo cho học viên &amp; phụ huynh</CheckRow></div>
      <div className="u-modal__foot">
        <Btn variant="ghost" size="sq" onClick={onClose}>Hủy</Btn>
        <Btn variant="danger" size="sq" disabled={!ready} onClick={() => onConfirm({ picks, notify })}>Xác nhận ngừng</Btn>
      </div>
    </Dialog>
  )
}
