import { useState } from 'react'
import { BookOpen, Calendar } from 'lucide-react'
import { Btn, DayToggles, Dialog, RadioChips, SelectField, TextField } from '../../../../common/ui'
import { ASSIGNABLE, ASSIGN_SLOTS, TEACHING } from './data'

function hoursOf(slot) {
  const [start, end] = slot.split(' – ').map((time) => { const [hour, minute] = time.split(':').map(Number); return hour + minute / 60 })
  return end - start
}

function slotLabel(slot) {
  const hour = parseInt(slot, 10)
  let period = 'Tối'
  if (hour < 12) period = 'Sáng'
  else if (hour < 17) period = 'Chiều'
  return `${slot} · ${period}`
}

// Figma 12.5 — Phân công lớp học cho giảng viên, có kiểm tra trùng lịch & tổng giờ dạy.
export default function AssignClassModal({ lecturer, onSubmit, onClose }) {
  const [cls, setCls] = useState(ASSIGNABLE[0]?.value ?? '')
  const [role, setRole] = useState(lecturer.role)
  const [start, setStart] = useState(() => { const first = ASSIGNABLE[0]?.start; const iso = first?.split('/').reverse().join('-'); return iso && iso > new Date().toISOString().slice(0, 10) ? first : new Date().toLocaleDateString('vi-VN') })
  const [days, setDays] = useState(ASSIGNABLE[0]?.days ?? [])
  const [slot, setSlot] = useState(ASSIGNABLE[0]?.slot ?? ASSIGN_SLOTS[2])
  const meta = ASSIGNABLE.find((c) => c.value === cls) ?? { room: '—' }

  const pickClass = (value) => {
    const classInfo = ASSIGNABLE.find((classItem) => classItem.value === value)
    setCls(value)
    const startDate = classInfo?.start?.split('/').reverse().join('-')
    if (startDate && startDate > new Date().toISOString().slice(0, 10)) setStart(classInfo.start)
    setDays(classInfo?.days ?? [])
    setSlot(classInfo?.slot ?? ASSIGN_SLOTS[0])
  }

  const timeLabel = slot.replace(' – ', '–')
  const teachingClasses = TEACHING[lecturer.id] ?? []
  const conflicts = teachingClasses
    .filter((classItem) => classItem.name !== cls.split(' · ')[0] && classItem.days && classItem.slot === slot)
    .map((classItem) => ({
      name: classItem.name,
      days: classItem.days.filter((day) => days.includes(day)),
    }))
    .filter((classItem) => classItem.days.length > 0)
  const total = lecturer.hours + days.length * hoursOf(slot)

  const blocked = conflicts.length > 0 || days.length === 0 || !cls

  return (
    <Dialog title="Phân công lớp học" subtitle={`Giảng viên: ${lecturer.name} · hiện dạy ${(TEACHING[lecturer.id] ?? []).length} lớp, ${lecturer.hours} giờ / tuần`} onClose={onClose}>
      <div className="u-form">
        <SelectField label="Lớp học" icon={BookOpen} full options={ASSIGNABLE.map((c) => c.value)} value={cls} onChange={(e) => pickClass(e.target.value)} />
        <RadioChips label="Vai trò" cols={2} value={role} onChange={setRole} options={[{ value: 'lecturer', label: 'Giảng viên' }, { value: 'assistant', label: 'Trợ giảng' }]} />
        <TextField label="Ngày bắt đầu" icon={Calendar} value={start} onChange={(e) => setStart(e.target.value)} />
        <DayToggles label="Lịch dạy trong tuần" shape="box" value={days} onChange={setDays} />
        <SelectField label="Khung giờ" icon={Calendar} full options={[...new Set([...ASSIGN_SLOTS, ...ASSIGNABLE.map((item) => item.slot)])].map((slot) => ({ value: slot, label: slotLabel(slot) }))} value={slot} onChange={(e) => setSlot(e.target.value)} />
      </div>

      <div className="as-check">
        <h5>Kiểm tra lịch &amp; phòng</h5>
        <ul>
          <li className="is-ok"><i />Phòng {meta.room} còn trống khung {timeLabel}</li>
          {conflicts.map((classItem) => <li key={classItem.name} className="is-bad"><i />Trùng lịch {classItem.days.join(', ')} {timeLabel}: đang dạy {classItem.name}</li>)}
          <li className="is-ok"><i />Tổng giờ dạy sau phân công: {total} giờ mỗi tuần</li>
          {conflicts.length > 0 && <li className="is-tip">Chọn khung giờ khác để tránh trùng lịch {conflicts[0].days.join(', ')} {timeLabel}</li>}
        </ul>
      </div>

      <div className="u-modal__foot">
        <Btn variant="ghost" size="sq" onClick={onClose}>Hủy</Btn>
        <Btn size="sq" disabled={blocked} onClick={() => onSubmit({ cls, role, start, days, slot })}>Phân công</Btn>
      </div>
    </Dialog>
  )
}
