import { useMemo, useState } from 'react'
import { BookOpen, Calendar } from 'lucide-react'
import { Btn, DayToggles, Dialog, RadioChips, SelectField, TextField } from '../../../../common/ui'
import { ASSIGNABLE, ASSIGN_SLOTS, TEACHING } from './data'

const hoursOf = (slot) => { const [a, b] = slot.split(' – ').map((t) => parseInt(t, 10)); return b - a }

// Figma 12.5 — Phân công lớp học cho giảng viên, có kiểm tra trùng lịch & tổng giờ dạy.
export default function AssignClassModal({ lecturer, onSubmit, onClose }) {
  const [cls, setCls] = useState(ASSIGNABLE[0].value)
  const [role, setRole] = useState('lecturer')
  const [start, setStart] = useState('21/09/2026')
  const [days, setDays] = useState(ASSIGNABLE[0].days)
  const [slot, setSlot] = useState(ASSIGN_SLOTS[2])
  const meta = ASSIGNABLE.find((c) => c.value === cls)

  const pickClass = (value) => {
    const m = ASSIGNABLE.find((c) => c.value === value)
    setCls(value); setDays(m.days); setSlot(ASSIGN_SLOTS.find((s) => s === m.slot) ?? ASSIGN_SLOTS[0])
  }

  const slotLabel = slot.replace(' – ', '–')
  const { conflicts, total } = useMemo(() => {
    const busy = (TEACHING[lecturer.id] ?? []).filter((r) => r.days && r.slot === slot)
    const hit = busy.map((r) => ({ name: r.name, days: r.days.filter((d) => days.includes(d)) })).filter((r) => r.days.length)
    return { conflicts: hit, total: lecturer.hours + days.length * hoursOf(slot) }
  }, [lecturer, slot, days])

  const blocked = conflicts.length > 0 || days.length === 0

  return (
    <Dialog title="Phân công lớp học" subtitle={`Giảng viên: ${lecturer.name} · hiện dạy ${(TEACHING[lecturer.id] ?? []).length} lớp, ${lecturer.hours} giờ / tuần`} onClose={onClose}>
      <div className="u-form">
        <SelectField label="Lớp học" icon={BookOpen} full options={ASSIGNABLE.map((c) => c.value)} value={cls} onChange={(e) => pickClass(e.target.value)} />
        <RadioChips label="Vai trò" cols={2} value={role} onChange={setRole} options={[{ value: 'lecturer', label: 'Giảng viên' }, { value: 'assistant', label: 'Trợ giảng' }]} />
        <TextField label="Ngày bắt đầu" icon={Calendar} value={start} onChange={(e) => setStart(e.target.value)} />
        <DayToggles label="Lịch dạy trong tuần" shape="box" value={days} onChange={setDays} />
        <SelectField label="Khung giờ" icon={Calendar} full options={ASSIGN_SLOTS.map((s) => ({ value: s, label: `${s} · ${parseInt(s, 10) < 12 ? 'Sáng' : parseInt(s, 10) < 17 ? 'Chiều' : 'Tối'}` }))} value={slot} onChange={(e) => setSlot(e.target.value)} />
      </div>

      <div className="as-check">
        <h5>Kiểm tra lịch &amp; phòng</h5>
        <ul>
          <li className="is-ok"><i />Phòng {meta.room} còn trống khung {slotLabel}</li>
          {conflicts.map((c) => <li key={c.name} className="is-bad"><i />Trùng lịch {c.days.join(', ')} {slotLabel}: đang dạy {c.name}</li>)}
          <li className="is-ok"><i />Tổng giờ dạy sau phân công: {total} / 24 giờ mỗi tuần</li>
          {conflicts.length > 0 && <li className="is-tip">Gợi ý: Lê Anh Dũng đang rảnh {conflicts[0].days.join(', ')} {slotLabel}</li>}
        </ul>
      </div>

      <div className="u-modal__foot">
        <Btn variant="ghost" size="sq" onClick={onClose}>Hủy</Btn>
        <Btn size="sq" disabled={blocked} onClick={() => onSubmit({ cls, role, start, days, slot })}>Phân công</Btn>
      </div>
    </Dialog>
  )
}
