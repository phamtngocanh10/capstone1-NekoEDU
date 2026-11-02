import { useCallback, useSyncExternalStore } from 'react'
import { lessonsOn } from './data'

// Kho dữ liệu nhỏ dùng chung giữa trang Lịch và trang Chi tiết khung giờ (mock).
// Lịch gốc sinh từ data.js (lặp theo thứ); ở đây chỉ lưu các thay đổi của người dùng: hủy lớp / điểm danh.
// Khi có backend: thay bằng gọi API trong src/api/schedule.js và refetch sau khi hủy / điểm danh.
let overrides = {}
const listeners = new Set()
const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb) }
const patch = (id, change) => {
  overrides = { ...overrides, [id]: { ...overrides[id], ...change } }
  listeners.forEach((l) => l())
}

const withOverrides = (byslot, ov) => Object.fromEntries(Object.entries(byslot).map(([slot, list]) => [
  slot, list.map((cls) => (ov[cls.id] ? { ...cls, ...ov[cls.id] } : cls)),
]))

// useSchedule() → (date: Date) => { [slot]: Lesson[] }  (đã áp dụng hủy lớp / điểm danh)
export const useSchedule = () => {
  const ov = useSyncExternalStore(subscribe, () => overrides)
  return useCallback((date) => withOverrides(lessonsOn(date), ov), [ov])
}

export const cancelClass = (id, reason) => patch(id, { status: 'cancelled', reason })
export const markAttended = (id, students) => patch(id, { status: 'attended', att: `${students}/${students}`, attNote: undefined })
