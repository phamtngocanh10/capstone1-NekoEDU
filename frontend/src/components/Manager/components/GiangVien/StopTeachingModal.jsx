import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Btn, CheckRow, Dialog } from '../../../../common/ui'
import { LECTURERS, TEACHING } from './data'

// Figma 12.7 — Ngừng giảng dạy: bắt buộc chọn giảng viên thay thế cho từng lớp đang phụ trách.
export default function StopTeachingModal({ lecturer, onConfirm, onClose }) {
  const classes = TEACHING[lecturer.id] ?? []
  const options = LECTURERS.filter((candidate) => candidate.id !== lecturer.id && candidate.role === lecturer.role && candidate.status !== 'stopped')
  const [picks, setPicks] = useState(() => Object.fromEntries(classes.map((classItem, i) => [classItem.id, i === 1 ? '' : options[0]?.name ?? ''])))
  const [notify, setNotify] = useState(true)
  const ready = classes.every((classItem) => picks[classItem.id])

  function selectTeacher(classId, teacherName) {
    setPicks((currentPicks) => ({ ...currentPicks, [classId]: teacherName }))
  }

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
      {classes.map((classItem) => (
        <div key={classItem.id} className={picks[classItem.id] ? 'stop-row' : 'stop-row is-missing'}>
          <div><strong>{classItem.name}</strong><small>{classItem.schedule}</small></div>
          <div className="u-control">
            <select value={picks[classItem.id]} onChange={(e) => selectTeacher(classItem.id, e.target.value)} aria-label={`Giảng viên thay thế lớp ${classItem.name}`}>
              <option value="">Chọn giảng viên thay thế</option>
              {options.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
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
