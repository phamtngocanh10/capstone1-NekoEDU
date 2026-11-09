import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { cancelLesson, getScheduleRange } from '../../../../api/schedule'
import { SLOTS, toIso, addDays, mondayOf } from './data'

let state = { items: [], freeStaff: [], error: '', loading: false }
let currentRange = null
let requestId = 0
const listeners = new Set()
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener) }
function publish(changes) { state = { ...state, ...changes }; listeners.forEach(listener => listener()) }
export async function refreshSchedule(start, end) {
  if (start && end) currentRange = { start, end }
  if (!currentRange) return
  const request = ++requestId
  publish({ loading: true, error: '' })
  try {
    const data = await getScheduleRange(currentRange.start, currentRange.end)
    if (request === requestId) publish({ ...data, loading: false })
  } catch (error) {
    if (request === requestId) publish({ items: [], freeStaff: [], loading: false, error: error.message })
  }
}
function daySchedule(date, items) {
  const iso = toIso(date)
  return Object.fromEntries(SLOTS.map(slot => [slot, items.filter(item => item.iso === iso && item.slot === slot)]))
}
export function useSchedule(anchor = new Date()) {
  const snapshot = useSyncExternalStore(subscribe, () => state)
  const start = toIso(mondayOf(new Date(anchor.getFullYear(), anchor.getMonth(), 1)))
  const end = toIso(addDays(new Date(`${start}T12:00:00`), 41))
  useEffect(() => { refreshSchedule(start, end) }, [start, end])
  const lessonsOf = useCallback(date => daySchedule(date, snapshot.items), [snapshot.items])
  lessonsOf.freeStaff = snapshot.freeStaff
  lessonsOf.error = snapshot.error
  lessonsOf.loading = snapshot.loading
  return lessonsOf
}
export const getSchedule = date => daySchedule(date, state.items)
export async function cancelClass(id, body) {
  await cancelLesson(id, typeof body === 'string' ? { reason: body } : body)
  await refreshSchedule()
}
export const markAttended = () => refreshSchedule()
