import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { Avatar, Card, CardHead } from '../../../../common/ui'
import useClickOutside from '../../../../common/useClickOutside'
import { useManager } from '../../layout/ManagerContext'
import {
  MOCK_TODAY, SECTIONS, SLOTS, TODAY_ISO, WEEKDAYS, addDays, addMonths, dayInfo, dayLabel, lastWord,
  mondayOf, monthLabel, toIso, weekDays, weekLabel, weekdayIndex,
} from './data'
import { EmptyCell, WeekGrid, WeekLegend, dotClass } from './WeekGrid'
import { cancelClass, useSchedule } from './store'
import CancelClassModal from './CancelClassModal'

// Figma 11 (lưới tuần) + 11.1 (mở rộng khung giờ) + 11.3 (hủy lớp) — thêm chế độ xem Ngày / Tuần / Tháng.
const MODES = [
  { value: 'day', label: 'Ngày', current: 'Hôm nay' },
  { value: 'week', label: 'Tuần', current: 'Tuần này' },
  { value: 'month', label: 'Tháng', current: 'Tháng này' },
]

const isCurrent = (mode, anchor) => {
  if (mode === 'day') return toIso(anchor) === TODAY_ISO
  if (mode === 'week') return toIso(mondayOf(anchor)) === toIso(mondayOf(MOCK_TODAY))
  return anchor.getFullYear() === MOCK_TODAY.getFullYear() && anchor.getMonth() === MOCK_TODAY.getMonth()
}
function shift(mode, anchor, direction) {
  if (mode === 'day') return addDays(anchor, direction)
  if (mode === 'week') return addDays(anchor, 7 * direction)
  return addMonths(anchor, direction)
}

function titleOf(mode, anchor) {
  if (mode === 'day') return dayLabel(anchor)
  if (mode === 'week') return weekLabel(anchor)
  return monthLabel(anchor)
}

export default function LichPhanCong() {
  const navigate = useNavigate()
  const { notify } = useManager()
  const [mode, setMode] = useState('week')
  const [anchor, setAnchor] = useState(MOCK_TODAY)
  const lessonsOf = useSchedule(anchor)
  useEffect(() => { if (lessonsOf.error) notify(lessonsOf.error) }, [lessonsOf.error, notify])
  const [menu, setMenu] = useState(false)
  // Mỗi ô (ngày + khung giờ) mở / đóng riêng — mở ô nào chỉ ô đó mở.
  const [expanded, setExpanded] = useState(() => new Set())
  const [target, setTarget] = useState(null)
  const menuRef = useRef(null)
  useClickOutside(menuRef, () => setMenu(false), menu)

  function toggleSlot(key) {
    setExpanded((currentKeys) => {
      const nextKeys = new Set(currentKeys)
      if (nextKeys.has(key)) nextKeys.delete(key)
      else nextKeys.add(key)
      return nextKeys
    })
  }
  const openSlot = (cls) => navigate(`/lichphancong/${cls.iso}?slot=${cls.slot}`)
  function pickMode(value) {
    setMode(value)
    setMenu(false)
  }
  function goDay(date) {
    setAnchor(date)
    setMode('day')
  }
  async function confirmCancellation(body) {
    await cancelClass(target.id, body)
    setTarget(null)
    notify(`Đã hủy lớp ${target.name}`)
  }
  const current = MODES.find((modeItem) => modeItem.value === mode)

  const renderClassRow = (lesson, slot, withCancel = true) => (
    <div key={lesson.id} className={`wk-class is-${lesson.status}`} onClick={() => openSlot(lesson)}>
      <b>{lesson.time ?? slot}</b>
      <strong>{lesson.name}</strong>
      <small>{lesson.room} · {lastWord(lesson.teacher)}</small>
      {lesson.status === 'upcoming' && withCancel && (
        <button type="button" className="wk-cancel" onClick={(e) => { e.stopPropagation(); setTarget(lesson) }}>Hủy lớp</button>
      )}
      {lesson.status === 'attended' && <em>Đã điểm danh {lesson.att}</em>}
      {lesson.status === 'cancelled' && <em>Đã hủy lớp</em>}
    </div>
  )

  // ── Tuần ──
  const days = weekDays(anchor)
  const renderWeekCell = (slot, dayIndex) => {
    const list = lessonsOf(days[dayIndex].d)[slot] ?? []
    if (list.length === 0) return <EmptyCell slot={slot} />
    const key = `${days[dayIndex].iso}|${slot}`
    const isOpen = expanded.has(key)
    const done = list.every((lesson) => lesson.status === 'attended')
    return (
      <div className={`wk-cell ${done ? 'is-done' : 'is-up'}`}>
        <button type="button" className="wk-cell__head" aria-expanded={isOpen} onClick={() => toggleSlot(key)}>
          <b>{slot}</b>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <small>{list.length} lớp</small>
          <span className="wk-dots">{list.map((lesson) => <i key={lesson.id} className={dotClass(lesson.status)} />)}</span>
        </button>
        {isOpen && list.map((lesson) => renderClassRow(lesson, slot))}
      </div>
    )
  }

  // ── Ngày ──
  const dayLessons = lessonsOf(anchor)
  const renderDay = () => (
    <div className="dv">
      {SECTIONS.map((section) => (
        <div key={section.key} className="wk">
          <div className="wk-section"><span>{section.label}</span></div>
          {section.slots.map((slot) => {
            const list = dayLessons[slot] ?? []
            return (
              <div key={slot} className="dv-slot">
                <div className="dv-slot__time"><b>{slot}</b><small>{list.length ? `${list.length} lớp` : 'Trống'}</small></div>
                <div className="dv-slot__list">
                  {list.length === 0 && <div className="wk-cell is-empty"><small>Không có lớp trong khung giờ này</small></div>}
                  {list.map((lesson) => (
                    <div key={lesson.id} className={`dv-card is-${lesson.status}`} onClick={() => openSlot(lesson)}>
                      <div className="dv-card__main">
                        <b>{lesson.time ?? slot}</b>
                        <strong>{lesson.name}</strong>
                        <small>{lesson.room} · GV {lesson.teacher} · {lesson.students} học viên</small>
                      </div>
                      <div className="dv-card__act" onClick={(e) => e.stopPropagation()}>
                        {lesson.status === 'attended' && <button type="button" className="dv-btn" onClick={() => navigate(`/lichphancong/diemdanh/${encodeURIComponent(lesson.id)}`)}>Xem điểm danh {lesson.att}</button>}
                        {lesson.status === 'cancelled' && <em className="is-danger">Đã hủy lớp</em>}
                        {lesson.status === 'upcoming' && (
                          <>
                            <button type="button" className="dv-btn" onClick={() => navigate(`/lichphancong/diemdanh/${encodeURIComponent(lesson.id)}`)}>Điểm danh</button>
                            <button type="button" className="wk-cancel dv-btn" onClick={() => setTarget(lesson)}>Hủy lớp</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )

  // ── Tháng ──
  const firstDayOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = mondayOf(firstDayOfMonth)
  const weekCount = Math.ceil((weekdayIndex(firstDayOfMonth) + new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()) / 7)
  const renderMonth = () => (
    <div className="mo">
      <div className="mo-head">{WEEKDAYS.map((w) => <b key={w.key}>{w.key}</b>)}</div>
      <div className="mo-grid">
        {Array.from({ length: weekCount * 7 }, (_, i) => {
          const d = addDays(gridStart, i)
          const info = dayInfo(d)
          const lessonsBySlot = lessonsOf(d)
          const lessons = SLOTS.flatMap((s) => lessonsBySlot[s].map((lesson) => ({ ...lesson, slot: s })))
          const outsideMonth = d.getMonth() !== anchor.getMonth()
          return (
            <button key={info.iso} type="button" className={`mo-cell${outsideMonth ? ' is-out' : ''}${info.iso === TODAY_ISO ? ' is-today' : ''}`} onClick={() => goDay(d)}>
              <span className="mo-cell__num">{d.getDate()}</span>
              {lessons.length > 0 && <span className="mo-cell__count">{lessons.length} lớp</span>}
              <span className="mo-cell__list">
                {lessons.slice(0, 3).map((lesson) => <i key={lesson.id} className={`mo-chip is-${lesson.status}`}>{lesson.slot.slice(0, 5)} {lesson.name}</i>)}
                {lessons.length > 3 && <i className="mo-more">+{lessons.length - 3} lớp nữa</i>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="u-page">
      <div className="wk-bar">
        <h2>{titleOf(mode, anchor)}</h2>

        <div className="wk-nav">
          <button type="button" aria-label="Kỳ trước" onClick={() => setAnchor((a) => shift(mode, a, -1))}><ChevronLeft size={16} /></button>
          <button type="button" aria-label="Kỳ sau" onClick={() => setAnchor((a) => shift(mode, a, 1))}><ChevronRight size={16} /></button>
        </div>

        <div className="wk-mode" ref={menuRef}>
          <button type="button" className="u-pill is-active wk-mode__btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            {isCurrent(mode, anchor) ? current.current : current.label}
            <ChevronDown size={14} />
          </button>
          {menu && (
            <div className="wk-mode__menu" role="menu">
              {MODES.map((modeItem) => (
                <button key={modeItem.value} type="button" role="menuitemradio" aria-checked={mode === modeItem.value} className={mode === modeItem.value ? 'is-active' : ''} onClick={() => pickMode(modeItem.value)}>
                  {modeItem.label}
                  {mode === modeItem.value && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {!isCurrent(mode, anchor) && (
          <button type="button" className="u-pill" onClick={() => setAnchor(MOCK_TODAY)}>Về hôm nay</button>
        )}
        <WeekLegend />
      </div>

      <Card>
        {mode === 'week' && <WeekGrid hint days={days} renderCell={renderWeekCell} />}
        {mode === 'day' && renderDay()}
        {mode === 'month' && renderMonth()}
      </Card>

      <Card>
        <CardHead title="Giảng viên / Trợ giảng rảnh" />
        <div className="wk-free">
          {lessonsOf.freeStaff.map((staff) => (
            <div key={staff.name} className="u-person">
              <Avatar name={staff.name} size={32} />
              <div><strong>{staff.name}</strong><small>{staff.note}</small></div>
            </div>
          ))}
        </div>
      </Card>

      {target && (
        <CancelClassModal
          cls={target}
          onClose={() => setTarget(null)}
          onConfirm={confirmCancellation}
        />
      )}
    </div>
  )
}
