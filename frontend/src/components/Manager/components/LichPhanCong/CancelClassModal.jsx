import { useState } from 'react'
import { Btn, CheckRow, Dialog, RadioChips, TextAreaField } from '../../../../common/ui'
import { CANCEL_REASONS, dayInfo, lastWord, parseIso } from './data'

// Figma 11.3 / 11.2 (bản 2) — Hủy lớp học
export default function CancelClassModal({ cls, onConfirm, onClose }) {
  const [reason, setReason] = useState(CANCEL_REASONS[0])
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [makeup, setMakeup] = useState(false)
  const day = dayInfo(parseIso(cls.iso))

  return (
    <Dialog title="Hủy lớp học" tone="plain" onClose={onClose}>
      <div className="cm-fields">
        <div className="cm-info">
          <strong>{cls.name}</strong>
          <span>{day.long}, {day.date}/{cls.iso.slice(0, 4)} · {cls.time ?? cls.slot.replace('-', '–')} · {cls.room}</span>
          <span>GV {cls.teacher} · {cls.students} học viên</span>
        </div>
        <RadioChips label="Lý do hủy lớp" cols={1} value={reason} onChange={setReason} options={CANCEL_REASONS.map((r) => ({ value: r, label: r, danger: true }))} />
        <TextAreaField
          label="Ghi chú gửi học viên & phụ huynh"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={`Cô ${lastWord(cls.teacher)} bận việc đột xuất, lớp sẽ được xếp học bù...`}
        />
        <CheckRow checked={notify} onChange={setNotify} tone="danger">Gửi thông báo cho {cls.students} học viên &amp; phụ huynh</CheckRow>
        <CheckRow checked={makeup} onChange={setMakeup} tone="danger">Tạo buổi học bù (chọn lịch sau)</CheckRow>
      </div>
      <div className="u-modal__foot">
        <Btn variant="ghost" onClick={onClose}>Giữ lớp</Btn>
        <Btn variant="danger" onClick={() => onConfirm({ reason, note, notify, makeup })}>Xác nhận hủy</Btn>
      </div>
    </Dialog>
  )
}
