import { CLASSES } from '../KhoaHoc/data'

// Dữ liệu mẫu theo Figma (11-manager-lich-phan-cong, 11.1, 11.2, 11.3) — thay bằng src/api/schedule.js khi có backend.

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

// "Hôm nay" của dữ liệu mẫu: Thứ Hai 14/09/2026 (khi có backend thì dùng new Date()).
export const MOCK_TODAY = new Date(2026, 8, 14)
export const TODAY_ISO = toIso(MOCK_TODAY)

export const dayInfo = (d) => {
  const i = weekdayIndex(d)
  return { key: WEEKDAYS[i].key, long: WEEKDAYS[i].long, date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, iso: toIso(d), d, index: i }
}
export const weekDays = (anchor) => Array.from({ length: 7 }, (_, i) => dayInfo(addDays(mondayOf(anchor), i)))
export const DAYS = weekDays(MOCK_TODAY) // tuần mẫu 14–20/09/2026

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
const DEMO_WEEK = new Set(DAYS.map((d) => d.iso))
const minutesOf = (time) => {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}
const daysOf = (cls) => cls.days.split('-').map((day) => day === 'CN' ? 6 : Number(day.slice(1)) - 2)
const timeOf = (cls) => cls.range.replace('–', '-')
const slotOf = (cls) => {
  const start = minutesOf(timeOf(cls).split('-')[0])
  return SLOTS.find((slot) => {
    const [from, to] = slot.split('-').map(minutesOf)
    return start >= from && start < to
  })
}

// Các buổi học của một ngày: { [slot]: Lesson[] }.
// Tuần mẫu 14–20/09 có trạng thái minh họa; tuần khác lặp theo lịch của lớp.
export const lessonsOn = (date) => {
  const iso = toIso(date)
  const di = weekdayIndex(date)
  const demo = DEMO_WEEK.has(iso)
  const past = date < MOCK_TODAY
  const classes = CLASSES.filter((cls) => daysOf(cls).includes(di) && !(past && cls.status === 'soon'))
  return Object.fromEntries(SLOTS.map((slot) => [
    slot,
    classes.filter((cls) => slotOf(cls) === slot).map((cls) => {
      const attended = past || (demo && di === 0 && (minutesOf(cls.listTime) < 17 * 60 || cls.id === 'kid-2a'))
      const cancelled = demo && di === 2 && cls.id === 'kid-2b'
      let status = 'upcoming'
      if (attended) status = 'attended'
      if (cancelled) status = 'cancelled'
      const hasAbsence = ['kindy-2a', 'kid-1b', 'kid-2a'].includes(cls.id)
      const present = cls.size - (hasAbsence ? 1 : 0)
      return {
        id: `${iso}|${slot}|${cls.id}`,
        classId: cls.id,
        name: cls.name,
        room: cls.room,
        teacher: cls.teacher,
        students: cls.size,
        assistant: cls.id === 'kid-2a' ? 'Nguyễn Thảo Vy' : '–',
        slot,
        time: timeOf(cls),
        day: di,
        iso,
        status,
        soon: cls.status === 'soon',
        att: attended ? `${present}/${cls.size}` : undefined,
        attNote: undefined,
        reason: cancelled ? 'Giảng viên báo nghỉ' : undefined,
      }
    }),
  ]))
}
export const FREE_STAFF = [
  { name: 'Nguyễn Thảo Vy', note: 'Trợ giảng · rảnh cả tuần' },
  { name: 'Đặng Quốc Bảo', note: 'Giảng viên · xem lịch trước khi phân công' },
]
export const CANCEL_REASONS = ['Giảng viên báo nghỉ', 'Phòng học bảo trì', 'Số học viên quá ít', 'Lý do khác']
export const lastWord = (name) => name.trim().split(/\s+/).pop()
