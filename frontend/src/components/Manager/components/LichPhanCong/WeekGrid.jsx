import { DAYS, SECTIONS, TODAY_ISO } from './data'

const DOT = { upcoming: '', attended: 'green', cancelled: 'red' }
export const dotClass = (status) => `u-dot ${DOT[status] ? `u-dot--${DOT[status]}` : ''}`.trim()

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
        {days.map((d) => (
          <div key={d.iso} className={d.iso === TODAY_ISO ? 'wk-day is-today' : 'wk-day'}>
            <b>{d.key}</b>
            <span>{d.date}</span>
          </div>
        ))}
      </div>
      {SECTIONS.map((sec, si) => (
        <div key={sec.key} className="wk">
          <div className="wk-section">
            <span>{sec.label}</span>
            {si === 0 && hint && <em>Nhấn vào khung giờ để mở rộng</em>}
          </div>
          {sec.slots.map((slot) => (
            <div key={slot} className="wk-row">
              {days.map((d, i) => <div key={d.iso}>{renderCell(slot, i)}</div>)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// Ô một buổi dạy đơn lẻ (dùng cho Lịch dạy giảng viên – Figma 12.4)
export function LessonTile({ time, name, room, status }) {
  return (
    <div className={`wk-cell wk-tile is-${status} ${status === 'attended' ? 'is-done' : status === 'cancelled' ? '' : 'is-up'}`} style={{ position: 'relative' }}>
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
