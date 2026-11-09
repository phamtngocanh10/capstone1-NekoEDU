import { DAYS, SECTIONS, TODAY_ISO } from './data'

const DOT = { upcoming: '', attended: 'green', cancelled: 'red' }
export function dotClass(status) {
  const color = DOT[status]
  return color ? `u-dot u-dot--${color}` : 'u-dot'
}

export function WeekLegend() {
  return (
    <div className="wk-legend">
      <span><i className="u-dot" />Sắp diễn ra</span>
      <span><i className="u-dot u-dot--green" />Đã điểm danh</span>
      <span><i className="u-dot u-dot--red" />Đã hủy lớp</span>
    </div>
  )
}

// Lưới tuần: 7 ngày × 3 buổi × 2 khung giờ. renderCell(slot, dayIndex) trả về nội dung từng ô.
export function WeekGrid({ renderCell, hint, days = DAYS }) {
  return (
    <div className="wk">
      <div className="wk-days">
        {days.map((day) => (
          <div key={day.iso} className={day.iso === TODAY_ISO ? 'wk-day is-today' : 'wk-day'}>
            <b>{day.key}</b>
            <span>{day.date}</span>
          </div>
        ))}
      </div>
      {SECTIONS.map((section, sectionIndex) => (
        <div key={section.key} className="wk">
          <div className="wk-section">
            <span>{section.label}</span>
            {sectionIndex === 0 && hint && <em>Nhấn vào khung giờ để mở rộng</em>}
          </div>
          {section.slots.map((slot) => (
            <div key={slot} className="wk-row">
              {days.map((day, i) => <div key={day.iso}>{renderCell(slot, i)}</div>)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// Ô một buổi dạy đơn lẻ (dùng cho Lịch dạy giảng viên – Figma 12.4)
export function LessonTile({ time, name, room, status }) {
  let stateClass = 'is-up'
  if (status === 'attended') stateClass = 'is-done'
  if (status === 'cancelled') stateClass = ''
  return (
    <div className={`wk-cell wk-tile is-${status} ${stateClass}`} style={{ position: 'relative' }}>
      <b>{time}</b>
      <strong>{name}</strong>
      <small>{room}</small>
    </div>
  )
}

export function EmptyCell({ slot }) {
  return (
    <div className="wk-cell is-empty">
      <b>{slot}</b>
      <small>Trống</small>
    </div>
  )
}
