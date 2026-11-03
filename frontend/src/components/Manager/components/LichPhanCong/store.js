import { useCallback, useSyncExternalStore } from 'react'
import { lessonsOn } from './data'

// Kho dữ liệu nhỏ dùng chung giữa trang Lịch và trang Chi tiết khung giờ (mock).
// Lịch gốc sinh từ data.js (lặp theo thứ); ở đây chỉ lưu các thay đổi của người dùng: hủy lớp / điểm danh.
// Khi có backend: thay bằng gọi API trong src/api/schedule.js và refetch sau khi hủy / điểm danh.
const loadOverrides = () => {
  try { return JSON.parse(localStorage.getItem('neko-schedule-overrides-v1')) ?? {} }
  catch { return {} }
}
let overrides = loadOverrides()
const listeners = new Set()
function subscribe(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}
const patch = (id, change) => {
  overrides = { ...overrides, [id]: { ...overrides[id], ...change } }
  try { localStorage.setItem('neko-schedule-overrides-v1', JSON.stringify(overrides)) }
  catch { /* API điểm danh đã lưu dữ liệu; bộ nhớ lịch chỉ là cache demo. */ }
  listeners.forEach((l) => l())
}

function withOverrides(lessonsBySlot, changes) {
  const schedule = {}
  for (const [slot, lessons] of Object.entries(lessonsBySlot)) {
    schedule[slot] = lessons.map((lesson) => (
      changes[lesson.id] ? { ...lesson, ...changes[lesson.id] } : lesson
    ))
  }
  return schedule
}

// useSchedule() → (date: Date) => { [slot]: Lesson[] }  (đã áp dụng hủy lớp / điểm danh)
export const useSchedule = () => {
  const changes = useSyncExternalStore(subscribe, () => overrides)
  return useCallback((date) => withOverrides(lessonsOn(date), changes), [changes])
}

export const getSchedule = (date) => withOverrides(lessonsOn(date), overrides)

export const cancelClass = (id, reason) => patch(id, { status: 'cancelled', reason })
export const markAttended = (id, students, present = students) => patch(id, { status: 'attended', att: `${present}/${students}`, attNote: undefined })
