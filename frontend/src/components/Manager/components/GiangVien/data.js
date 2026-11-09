import createStore from '../../../../common/createStore'
import { getLecturers } from '../../../../api/lecturers'
import { loadAcademic } from '../KhoaHoc/data'

export const STATUS = {
  teaching: { label: 'Đang dạy', tone: 'green' },
  free: { label: 'Đang rảnh', tone: 'gray' },
  none: { label: 'Chưa nhận lớp', tone: 'amber' },
  stopped: { label: 'Đã ngừng giảng dạy', tone: 'red' },
}
export const ROLE_LABEL = { lecturer: 'Giảng viên', assistant: 'Trợ giảng' }


export let LECTURERS = []
export let TEACHING = {}
export let SCHEDULE = {}
export let ASSIGNABLE = []
export const lecturerStore = createStore([])
export async function loadLecturers() {
  const [lecturers, academic] = await Promise.all([getLecturers(), loadAcademic()])
  LECTURERS = lecturers
  TEACHING = Object.fromEntries(lecturers.map((item) => [item.id, item.classes.map((cls) => ({ ...cls, days: cls.dayLabels }))]))
  SCHEDULE = Object.fromEntries(lecturers.map((item) => [item.id, item.plan]))
  ASSIGNABLE = academic.classes.filter((item) => item.status !== 'ended').map((item) => ({ id: item.id, value: `${item.name} · ${item.status === 'soon' ? 'Sắp khai giảng' : 'Đang mở'}`, days: item.dayLabels, slot: item.slot, room: item.room, start: item.start }))
  lecturerStore.set(lecturers)
  return lecturers
}
export const ASSIGN_SLOTS = ['07:00 – 09:00', '09:00 – 11:00', '13:00 – 15:00', '15:00 – 17:00', '17:00 – 19:00', '19:00 – 21:00']
export const SPECIALTIES = ['KINDY', 'KID', 'TEEN']
export const CONTRACTS = ['Toàn thời gian', 'Bán thời gian', 'Thời vụ']
export const RATES = [90000, 200000, 220000, 230000, 250000, 300000].map((value) => ({ value: String(value), label: `${value.toLocaleString('vi-VN')}đ / giờ` }))
export const money = (value) => value == null ? '—' : `${Number(value).toLocaleString('vi-VN')}đ / giờ`
