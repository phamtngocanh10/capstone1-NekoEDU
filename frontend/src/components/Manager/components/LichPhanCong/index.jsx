import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { Avatar, Card, CardHead } from '../../../../common/ui'
import useClickOutside from '../../../../common/useClickOutside'
import { useManager } from '../../layout/ManagerContext'
import {
  FREE_STAFF, MOCK_TODAY, SECTIONS, SLOTS, TODAY_ISO, WEEKDAYS, addDays, addMonths, dayInfo, dayLabel, lastWord,
  mondayOf, monthLabel, toIso, weekDays, weekLabel, weekdayIndex,
} from './data'
import { EmptyCell, WeekGrid, WeekLegend, dotClass } from './WeekGrid'
import { cancelClass, markAttended, useSchedule } from './store'
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
const shift = (mode, anchor, dir) => (mode === 'day' ? addDays(anchor, dir) : mode === 'week' ? addDays(anchor, 7 * dir) : addMonths(anchor, dir))
const titleOf = (mode, anchor) => (mode === 'day' ? dayLabel(anchor) : mode === 'week' ? weekLabel(anchor) : monthLabel(anchor))

export default function LichPhanCong() {
  const navigate = useNavigate()
  const { notify } = useManager()
  const lessonsOf = useSchedule()
  const [mode, setMode] = useState('week')
  const [anchor, setAnchor] = useState(MOCK_TODAY)
  const [menu, setMenu] = useState(false)
  // Mỗi ô (ngày + khung giờ) mở / đóng riêng — mở ô nào chỉ ô đó mở.
  const [expanded, setExpanded] = useState(() => new Set())
  const [target, setTarget] = useState(null)
  const menuRef = useRef(null)
  useClickOutside(menuRef, () => setMenu(false), menu)

  const toggle = (key) => setExpanded((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  const open = (cls) => navigate(`/lichphancong/${cls.iso}?slot=${cls.slot}`)
  const pickMode = (m) => { setMode(m); setMenu(false) }
  const goDay = (d) => { setAnchor(d); setMode('day') }
  const current = MODES.find((m) => m.value === mode)

  const classRow = (c, slot, withCancel = true) => (
    <div key={c.id} className={`wk-class is-${c.status}`} onClick={() => open(c)}>
      <b>{c.time ?? slot}</b>
      <strong>{c.name}</strong>
      <small>{c.room} · {lastWord(c.teacher)}</small>
      {c.status === 'upcoming' && withCancel && (
        <button type="button" className="wk-cancel" onClick={(e) => { e.stopPropagation(); setTarget(c) }}>Hủy lớp</button>
      )}
      {c.status === 'attended' && <em>Đã điểm danh {c.att}</em>}
      {c.status === 'cancelled' && <em>Đã hủy lớp</em>}
    </div>
  )

  // ── Tuần ──
  const days = weekDays(anchor)
  const renderWeekCell = (slot, di) => {
    const list = lessonsOf(days[di].d)[slot] ?? []
    if (list.length === 0) return <EmptyCell slot={slot} />
    const key = `${days[di].iso}|${slot}`
    const isOpen = expanded.has(key)
    const done = list.every((c) => c.status === 'attended')
    return (
      <div className={`wk-cell ${done ? 'is-done' : 'is-up'}`}>
        <button type="button" className="wk-cell__head" aria-expanded={isOpen} onClick={() => toggle(key)}>
          <b>{slot}</b>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <small>{list.length} lớp</small>
          <span className="wk-dots">{list.map((c) => <i key={c.id} className={dotClass(c.status)} />)}</span>
        </button>
        {isOpen && list.map((c) => classRow(c, slot))}
      </div>
    )
  }

  // ── Ngày ──
  const dayLessons = lessonsOf(anchor)
  const renderDay = () => (
    <div className="dv">
      {SECTIONS.map((sec) => (
        <div key={sec.key} className="wk">
          <div className="wk-section"><span>{sec.label}</span></div>
          {sec.slots.map((slot) => {
            const list = dayLessons[slot] ?? []
            return (
              <div key={slot} className="dv-slot">
                <div className="dv-slot__time"><b>{slot}</b><small>{list.length ? `${list.length} lớp` : 'Trống'}</small></div>
                <div className="dv-slot__list">
                  {list.length === 0 && <div className="wk-cell is-empty"><small>Không có lớp trong khung giờ này</small></div>}
                  {list.map((c) => (
                    <div key={c.id} className={`dv-card is-${c.status}`} onClick={() => open(c)}>
                      <div className="dv-card__main">
                        <b>{c.time ?? slot}</b>
                        <strong>{c.name}</strong>
                        <small>{c.room} · GV {c.teacher} · {c.students} học viên</small>
                      </div>
                      <div className="dv-card__act" onClick={(e) => e.stopPropagation()}>
                        {c.status === 'attended' && <em>Đã điểm danh {c.att}</em>}
                        {c.status === 'cancelled' && <em className="is-danger">Đã hủy lớp</em>}
                        {c.status === 'upcoming' && (
                          <>
                            <button type="button" className="dv-btn" onClick={() => { markAttended(c.id, c.students); notify(`Đã mở điểm danh lớp ${c.name}`) }}>Điểm danh</button>
                            <button type="button" className="wk-cancel dv-btn" onClick={() => setTarget(c)}>Hủy lớp</button>
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
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = mondayOf(first)
  const weeks = Math.ceil((weekdayIndex(first) + new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()) / 7)
  const renderMonth = () => (
    <div className="mo">
      <div className="mo-head">{WEEKDAYS.map((w) => <b key={w.key}>{w.key}</b>)}</div>
      <div className="mo-grid">
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const d = addDays(gridStart, i)
          const info = dayInfo(d)
          const byslot = lessonsOf(d)
          const all = SLOTS.flatMap((s) => byslot[s].map((c) => ({ ...c, slot: s })))
          const out = d.getMonth() !== anchor.getMonth()
          return (
            <button key={info.iso} type="button" className={`mo-cell${out ? ' is-out' : ''}${info.iso === TODAY_ISO ? ' is-today' : ''}`} onClick={() => goDay(d)}>
              <span className="mo-cell__num">{d.getDate()}</span>
              {all.length > 0 && <span className="mo-cell__count">{all.length} lớp</span>}
              <span className="mo-cell__list">
                {all.slice(0, 3).map((c) => <i key={c.id} className={`mo-chip is-${c.status}`}>{c.slot.slice(0, 5)} {c.name}</i>)}
                {all.length > 3 && <i className="mo-more">+{all.length - 3} lớp nữa</i>}
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
              {MODES.map((m) => (
                <button key={m.value} type="button" role="menuitemradio" aria-checked={mode === m.value} className={mode === m.value ? 'is-active' : ''} onClick={() => pickMode(m.value)}>
                  {m.label}
                  {mode === m.value && <Check size={14} />}
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
          {FREE_STAFF.map((p) => (
            <div key={p.name} className="u-person">
              <Avatar name={p.name} size={32} />
              <div><strong>{p.name}</strong><small>{p.note}</small></div>
            </div>
          ))}
        </div>
      </Card>

      {target && (
        <CancelClassModal
          cls={target}
          onClose={() => setTarget(null)}
          onConfirm={({ reason }) => { cancelClass(target.id, reason); setTarget(null); notify(`Đã hủy lớp ${target.name}`) }}
        />
      )}
    </div>
  )
}
