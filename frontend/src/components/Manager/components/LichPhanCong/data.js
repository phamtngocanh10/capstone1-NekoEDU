// Dữ liệu mẫu theo Figma (11-manager-lich-phan-cong, 11.1, 11.2, 11.3) — thay bằng src/api/schedule.js khi có backend.

// ── Ngày tháng ──────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
export const WEEKDAYS = [
  { key: 'T2', long: 'Thứ Hai' }, { key: 'T3', long: 'Thứ Ba' }, { key: 'T4', long: 'Thứ Tư' }, { key: 'T5', long: 'Thứ Năm' },
  { key: 'T6', long: 'Thứ Sáu' }, { key: 'T7', long: 'Thứ Bảy' }, { key: 'CN', long: 'Chủ nhật' },
]
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
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
  const [a, b] = [mondayOf(anchor), addDays(mondayOf(anchor), 6)]
  const tail = `${pad(b.getDate())}/${pad(b.getMonth() + 1)}/${b.getFullYear()}`
  return a.getMonth() === b.getMonth() ? `Tuần ${a.getDate()} – ${tail}` : `Tuần ${pad(a.getDate())}/${pad(a.getMonth() + 1)} – ${tail}`
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
// Tên lớp khớp danh sách ở KhoaHoc/data.js: KINDY 1A…3B, KID TEEN 1A…3B.
// status: upcoming (sắp diễn ra) | attended (đã điểm danh) | cancelled (đã hủy lớp)
const c = (name, room, teacher, status, extra = {}) => ({ name, room, teacher, status, students: 12, assistant: '–', ...extra })
const K1A = (st, extra) => c('KINDY 1A', 'P.108', 'Phạm Thu Hà', st, { students: 12, ...extra })
const K1B = () => c('KINDY 1B', 'P.105', 'Phạm Thu Hà', 'upcoming', { students: 10 })
const K2A = (st, extra) => c('KINDY 2A', 'P.301', 'Lê Anh Dũng', st, { students: 12, ...extra })
const K2B = () => c('KINDY 2B', 'P.105', 'Phạm Thu Hà', 'upcoming', { students: 10 })
const K3A = () => c('KINDY 3A', 'P.301', 'Lê Anh Dũng', 'upcoming', { students: 9 })
const K3B = (st, extra) => c('KINDY 3B', 'P.202', 'Trần Minh Khôi', st, { students: 11, ...extra })
const T1A = () => c('KID TEEN 1A', 'P.301', 'Lê Anh Dũng', 'upcoming', { students: 20 })
const T1B = (st, extra) => c('KID TEEN 1B', 'P.301', 'Lê Anh Dũng', st, { students: 16, ...extra })
const T2A = (st, extra) => c('KID TEEN 2A', 'P.203', 'Trần Minh Khôi', st, { students: 18, assistant: 'Nguyễn Thảo Vy', ...extra })
const T2B = (st, extra) => c('KID TEEN 2B', 'P.105', 'Phạm Thu Hà', st, { students: 14, ...extra })
const T3A = () => c('KID TEEN 3A', 'P.202', 'Trần Minh Khôi', 'upcoming', { students: 5, soon: true }) // sắp khai giảng
const T3B = (st, extra) => c('KID TEEN 3B', 'P.203', 'Trần Minh Khôi', st, { students: 16, ...extra })

// Lịch lặp theo thứ: slot → chỉ số thứ (0 = T2) → danh sách lớp. Trạng thái ghi ở đây chỉ áp dụng cho tuần mẫu 14–20/09.
const SPEC = {
  '07:00-09:00': { 5: [K3A()], 6: [K2B()] },
  '09:00-11:00': {
    0: [K2A('attended', { att: '11/12' })], 1: [T1A(), K1B()], 2: [K2A('upcoming')], 3: [T1A(), K1B()], 4: [K2A('upcoming')],
  },
  '13:00-15:00': {
    0: [T3B('attended', { att: '16/16' }), T1B('attended', { att: '15/16' })],
    2: [T3B('upcoming')], 3: [T1B('upcoming')],
  },
  '15:00-17:00': {
    0: [K1A('attended', { att: '12/12' }), K3B('attended', { att: '11/11' })],
    1: [K1A('upcoming')], 3: [K1A('upcoming')], 4: [K1A('upcoming')],
  },
  '17:00-19:00': {
    0: [T2A('attended', { att: '17/18', attNote: 'Có mặt 16/18 · lúc 17:08' }), T2B('upcoming', { time: '17:30-19:00' })],
    1: [T3A()], 2: [T2A('upcoming'), T2B('cancelled')], 3: [T3A()], 4: [T2A('upcoming'), T2B('upcoming')], 5: [T3A()],
  },
  '19:00-21:00': {},
}

const DEMO_WEEK = new Set(DAYS.map((d) => d.iso))

// Các buổi học của một ngày: { [slot]: Lesson[] }. Tuần mẫu dùng trạng thái trong SPEC;
// các tuần khác lặp lại theo thứ — buổi đã qua = đã điểm danh, từ hôm nay trở đi = sắp diễn ra.
export const lessonsOn = (date) => {
  const iso = toIso(date)
  const di = weekdayIndex(date)
  const demo = DEMO_WEEK.has(iso)
  const past = date < MOCK_TODAY
  return Object.fromEntries(SLOTS.map((slot) => [
    slot,
    (SPEC[slot]?.[di] ?? [])
      .filter((cls) => demo || !(past && cls.soon))
      .map((cls, i) => {
        const base = { ...cls, id: `${iso}|${slot}|${i}`, slot, day: di, iso }
        if (demo) return base
        return past
          ? { ...base, status: 'attended', att: `${cls.students}/${cls.students}`, attNote: undefined }
          : { ...base, status: 'upcoming', att: undefined, attNote: undefined }
      }),
  ]))
}

export const FREE_STAFF = [
  { name: 'Nguyễn Thảo Vy', note: 'Trợ giảng · rảnh cả tuần' },
  { name: 'Đặng Quốc Bảo', note: 'Giảng viên mới · chưa nhận lớp' },
]
export const CANCEL_REASONS = ['Giảng viên báo nghỉ', 'Phòng học bảo trì', 'Số học viên quá ít', 'Lý do khác']
export const lastWord = (name) => name.trim().split(/\s+/).pop()
