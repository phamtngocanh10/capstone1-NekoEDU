export const STATE = {
  open: { label: 'Đang mở', tone: 'green', bar: 'var(--primary)' },
  closing: { label: 'Sắp đóng', tone: 'amber', bar: '#1a6fc9' },
  notopen: { label: 'Chưa mở', tone: 'gray', bar: 'var(--divider)' },
  closed: { label: 'Đã đóng', tone: 'blue', bar: 'var(--success-fill)' },
}
export const PROGRESS_STATE = {
  published: { label: 'Đã công bố', tone: 'green' },
  pending: { label: 'Chờ GV xác nhận', tone: 'amber' },
  empty: { label: 'Chưa nhập điểm', tone: 'gray' },
}
export function avg(list) {
  const scores = list.filter(value => value !== '' && value !== null && value !== undefined).map(Number).filter(Number.isFinite)
  return scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length * 10) / 10 : null
}
export function grade(score) {
  if (score === null) return null
  if (score >= 9) return ['Xuất sắc', 'green']
  if (score >= 8) return ['Giỏi', 'blue']
  if (score >= 7) return ['Giỏi', 'green']
  if (score >= 6) return ['Khá', 'blue']
  if (score >= 5) return ['TB', 'amber']
  return ['Yếu', 'red']
}
export const EXAMS = ['Kiểm tra giữa kỳ', 'Kiểm tra cuối kỳ', 'Bài kiểm tra 15 phút']
