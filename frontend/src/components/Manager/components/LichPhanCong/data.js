

// Date labels and the existing calendar sections. Records load from schedule.js.

// ── Ngày tháng ──────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
export const WEEKDAYS = [
  { key: 'T2', long: 'Thứ Hai' }, { key: 'T3', long: 'Thứ Ba' }, { key: 'T4', long: 'Thứ Tư' }, { key: 'T5', long: 'Thứ Năm' },
  { key: 'T6', long: 'Thứ Sáu' }, { key: 'T7', long: 'Thứ Bảy' }, { key: 'CN', long: 'Chủ nhật' },
]
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export function parseIso(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1)
export const weekdayIndex = (d) => (d.getDay() + 6) % 7 // 0 = T2 … 6 = CN
export const mondayOf = (d) => addDays(d, -weekdayIndex(d))

// Kept the existing exported name so calendar consumers share the current date.
export const MOCK_TODAY = new Date()
export const TODAY_ISO = toIso(MOCK_TODAY)

export const dayInfo = (d) => {
  const i = weekdayIndex(d)
  return { key: WEEKDAYS[i].key, long: WEEKDAYS[i].long, date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, iso: toIso(d), d, index: i }
}
export const weekDays = (anchor) => Array.from({ length: 7 }, (_, i) => dayInfo(addDays(mondayOf(anchor), i)))
export const DAYS = weekDays(MOCK_TODAY)

export const weekLabel = (anchor) => {
  const start = mondayOf(anchor)
  const end = addDays(start, 6)
  const endLabel = `${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`
  if (start.getMonth() === end.getMonth()) return `Tuần ${start.getDate()} – ${endLabel}`
  return `Tuần ${pad(start.getDate())}/${pad(start.getMonth() + 1)} – ${endLabel}`
}
export const dayLabel = (d) => `${WEEKDAYS[weekdayIndex(d)].long}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
export const monthLabel = (d) => `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`

// ── Khung giờ ───────────────────────────────────────────────────────────────
export const SECTIONS = [
  { key: 'sang', label: 'SÁNG · 07:00 – 11:00', period: 'Buổi sáng', slots: ['07:00-09:00', '09:00-11:00'] },
  { key: 'chieu', label: 'CHIỀU · 13:00 – 17:00', period: 'Buổi chiều', slots: ['13:00-15:00', '15:00-17:00'] },
  { key: 'toi', label: 'TỐI · 17:00 – 21:00', period: 'Buổi tối', slots: ['17:00-19:00', '19:00-21:00'] },
]
export const SLOTS = SECTIONS.flatMap((s) => s.slots)
export const periodOf = (slot) => SECTIONS.find((s) => s.slots.includes(slot))?.period ?? ''

// ── Lớp học trong lịch ──────────────────────────────────────────────────────
// Sinh lịch trực tiếp từ danh sách lớp để Manager và Giảng viên luôn dùng cùng
// tên lớp, giảng viên, phòng học, sĩ số, ngày học và thời gian.
export const lessonsOn = () => Object.fromEntries(SLOTS.map(slot => [slot, []]))
export const FREE_STAFF = []
export const CANCEL_REASONS = ['Giảng viên báo nghỉ', 'Phòng học bảo trì', 'Số học viên quá ít', 'Lý do khác']
export const lastWord = (name) => name.trim().split(/\s+/).pop()
