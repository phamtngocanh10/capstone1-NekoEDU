import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { BackLink, Btn, Card, Chip } from '../../../../common/ui'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { CLASSES } from '../KhoaHoc/data'
import { MOCK_TODAY, SLOTS, TODAY_ISO, dayInfo, parseIso, periodOf } from './data'
import { cancelClass, useSchedule } from './store'
import CancelClassModal from './CancelClassModal'

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function timelineTicks(start, end) {
  const startMinutes = timeToMinutes(start)
  const duration = timeToMinutes(end) - startMinutes
  return [0, 0.25, 0.5, 0.75, 1].map((position) => {
    const time = startMinutes + position * duration
    const hours = String(Math.floor(time / 60)).padStart(2, '0')
    const minutes = String(time % 60).padStart(2, '0')
    return `${hours}:${minutes}`
  })
}
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

  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? parseIso(date) : MOCK_TODAY
  const day = dayInfo(selectedDate)
  const slot = SLOTS.includes(params.get('slot')) ? params.get('slot') : '17:00-19:00'
  const lessons = lessonsOf(selectedDate)[slot] ?? []
  const [start, end] = slot.split('-')
  const count = (status) => lessons.filter((lesson) => lesson.status === status).length
  const ticks = timelineTicks(start, end)
  const duration = timeToMinutes(end) - timeToMinutes(start)
  const rooms = new Set(lessons.map((lesson) => lesson.room)).size

  const viewClass = (lesson) => {
    const classInfo = CLASSES.find((classItem) => classItem.name === lesson.name)
    if (classInfo) navigate(`/khoahoc/${classInfo.courseId}/lop/${classInfo.id}`)
    else notify(`Lớp ${lesson.name} chưa có trong danh sách khóa học`)
  }

  function confirmCancellation({ reason }) {
    cancelClass(target.id, reason)
    setTarget(null)
    notify(`Đã hủy lớp ${target.name}`)
  }

  return (
    <div className="u-page">
      <BackLink to="/lichphancong">Lịch &amp; Phân công</BackLink>

      <Card className="slot-head">
        <div className="u-grow">
          <h2>{day.long}, {day.date}/{day.iso.slice(0, 4)}</h2>
          {day.iso === TODAY_ISO && <Chip tone="blue">Hôm nay</Chip>}
          <p>Khung giờ {start} – {end} · {periodOf(slot).toLowerCase().replace(/^b/, 'B')} · {lessons.length} lớp · {rooms} phòng</p>
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

      {lessons.length > 0 && (
        <Card>
          <CardTitle>Dòng thời gian · {start} – {end}</CardTitle>
          <div className="tl">
            <div className="tl__axis">{ticks.map((t) => <span key={t}>{t}</span>)}</div>
            {lessons.map((lesson) => {
              const [classStart, classEnd] = (lesson.time ?? slot).split('-')
              const left = ((timeToMinutes(classStart) - timeToMinutes(start)) / duration) * 100
              const width = ((timeToMinutes(classEnd) - timeToMinutes(classStart)) / duration) * 100
              return (
                <div key={lesson.id} className={`tl__bar is-${lesson.status}`} style={{ marginLeft: `${left}%`, width: `${width}%` }}>
                  {lesson.time ?? slot} · {lesson.name} · {lesson.room}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <h3 className="u-card__title">Danh sách lớp trong khung giờ ({lessons.length})</h3>
      {lessons.length === 0 && <Card className="u-faint">Khung giờ này đang trống.</Card>}
      {lessons.map((lesson) => {
        const [tone, label, sub] = STATUS[lesson.status]
        return (
          <div key={lesson.id} className={`slot-card is-${lesson.status}`} onClick={() => viewClass(lesson)}>
            <div>
              <div className="slot-card__time">{lesson.time ?? slot}</div>
              <h4>{lesson.name}</h4>
              <small>{lesson.room} · GV {lesson.teacher}</small>
            </div>
            <div><span className="lbl">Sĩ số</span><div className="val">{lesson.students} học viên</div></div>
            <div><span className="lbl">Trợ giảng</span><div className="val">{lesson.assistant}</div></div>
            <div className="slot-card__status">
              <Chip tone={tone}>{label}</Chip>
              <small>{lesson.status === 'attended' ? (lesson.attNote ?? `Có mặt ${lesson.att}`) : sub ?? lesson.reason}</small>
            </div>
            <div className="slot-card__actions" onClick={(e) => e.stopPropagation()}>
              {lesson.status === 'attended' && <Btn variant="soft" onClick={() => navigate(`/lichphancong/diemdanh/${encodeURIComponent(lesson.id)}`)}>Xem điểm danh</Btn>}
              {lesson.status === 'upcoming' && (
                <>
                  <Btn onClick={() => navigate(`/lichphancong/diemdanh/${encodeURIComponent(lesson.id)}`)}>Điểm danh</Btn>
                  <Btn variant="outline-danger" onClick={() => setTarget(lesson)}>Hủy lớp</Btn>
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
          onConfirm={confirmCancellation}
        />
      )}
    </div>
  )
}

function CardTitle({ children }) {
  return <h3 className="u-card__title" style={{ marginBottom: 12 }}>{children}</h3>
}
