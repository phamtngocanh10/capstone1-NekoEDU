import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { BackLink, Btn, Card, Chip } from '../../../../common/ui'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { CLASSES } from '../KhoaHoc/data'
import { MOCK_TODAY, SLOTS, TODAY_ISO, dayInfo, parseIso, periodOf } from './data'
import { cancelClass, markAttended, useSchedule } from './store'
import CancelClassModal from './CancelClassModal'

const mins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const STATUS = { upcoming: ['blue', 'Sắp diễn ra', 'Chưa điểm danh'], attended: ['green', 'Đã điểm danh'], cancelled: ['red', 'Đã hủy lớp'] }

// Figma 11.2 — Chi tiết khung giờ trong ngày
export default function ChiTietKhungGio() {
  const { date } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { notify } = useManager()
  const lessonsOf = useSchedule()
  const [target, setTarget] = useState(null)
  usePageHeader('Chi tiết khung giờ', 'Các lớp học trong khung giờ của ngày đã chọn')

  const dateObj = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? parseIso(date) : MOCK_TODAY
  const day = dayInfo(dateObj)
  const slot = SLOTS.includes(params.get('slot')) ? params.get('slot') : '17:00-19:00'
  const list = lessonsOf(dateObj)[slot] ?? []
  const [start, end] = slot.split('-')
  const count = (st) => list.filter((c) => c.status === st).length
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => { const t = mins(start) + p * (mins(end) - mins(start)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` })
  const span = mins(end) - mins(start)
  const rooms = new Set(list.map((c) => c.room)).size

  const viewClass = (c) => {
    const k = CLASSES.find((x) => x.name === c.name)
    if (k) navigate(`/khoahoc/${k.courseId}/lop/${k.id}`)
    else notify(`Lớp ${c.name} chưa có trong danh sách khóa học`)
  }

  return (
    <div className="u-page">
      <BackLink to="/lichphancong">Lịch &amp; Phân công</BackLink>

      <Card className="slot-head">
        <div className="u-grow">
          <h2>{day.long}, {day.date}/{day.iso.slice(0, 4)}</h2>
          {day.iso === TODAY_ISO && <Chip tone="blue">Hôm nay</Chip>}
          <p>Khung giờ {start} – {end} · {periodOf(slot).replace('Buổi ', 'Buổi ').toLowerCase().replace(/^b/, 'B')} · {list.length} lớp · {rooms} phòng</p>
        </div>
        <div className="u-row">
          <Chip tone="green" size="lg">{count('attended')} đã điểm danh</Chip>
          <Chip tone="blue" size="lg">{count('upcoming')} sắp diễn ra</Chip>
          <Chip tone="red" size="lg">{count('cancelled')} đã hủy lớp</Chip>
        </div>
      </Card>

      <div className="u-toolbar">
        <div className="u-pills">
          {SLOTS.map((s) => (
            <button key={s} type="button" className={s === slot ? 'u-pill is-active' : 'u-pill'} style={{ height: 36, padding: '0 24px', borderRadius: 18 }} onClick={() => setParams({ slot: s })}>{s}</button>
          ))}
        </div>
        <span className="u-grow" />
        <Btn variant="ghost" size="md" onClick={() => navigate('/lichphancong')}>‹ {day.key} · {day.date}</Btn>
      </div>

      {list.length > 0 && (
        <Card>
          <CardTitle>Dòng thời gian · {start} – {end}</CardTitle>
          <div className="tl">
            <div className="tl__axis">{ticks.map((t) => <span key={t}>{t}</span>)}</div>
            {list.map((c) => {
              const [cs, ce] = (c.time ?? slot).split('-')
              const left = ((mins(cs) - mins(start)) / span) * 100
              const width = ((mins(ce) - mins(cs)) / span) * 100
              return (
                <div key={c.id} className={`tl__bar is-${c.status}`} style={{ marginLeft: `${left}%`, width: `${width}%` }}>
                  {c.time ?? slot} · {c.name} · {c.room}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <h3 className="u-card__title">Danh sách lớp trong khung giờ ({list.length})</h3>
      {list.length === 0 && <Card className="u-faint">Khung giờ này đang trống.</Card>}
      {list.map((c) => {
        const [tone, label, sub] = STATUS[c.status]
        return (
          <div key={c.id} className={`slot-card is-${c.status}`} onClick={() => viewClass(c)}>
            <div>
              <div className="slot-card__time">{c.time ?? slot}</div>
              <h4>{c.name}</h4>
              <small>{c.room} · GV {c.teacher}</small>
            </div>
            <div><span className="lbl">Sĩ số</span><div className="val">{c.students} học viên</div></div>
            <div><span className="lbl">Trợ giảng</span><div className="val">{c.assistant}</div></div>
            <div className="slot-card__status">
              <Chip tone={tone}>{label}</Chip>
              <small>{c.status === 'attended' ? (c.attNote ?? `Có mặt ${c.att}`) : sub ?? c.reason}</small>
            </div>
            <div className="slot-card__actions" onClick={(e) => e.stopPropagation()}>
              {c.status === 'attended' && <Btn variant="soft" onClick={() => viewClass(c)}>Xem điểm danh</Btn>}
              {c.status === 'upcoming' && (
                <>
                  <Btn onClick={() => { markAttended(c.id, c.students); notify(`Đã mở điểm danh lớp ${c.name}`) }}>Điểm danh</Btn>
                  <Btn variant="outline-danger" onClick={() => setTarget(c)}>Hủy lớp</Btn>
                </>
              )}
            </div>
            <ChevronRight size={16} className="u-faint" />
          </div>
        )
      })}

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

function CardTitle({ children }) {
  return <h3 className="u-card__title" style={{ marginBottom: 12 }}>{children}</h3>
}
