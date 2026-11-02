import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { Avatar, BackLink, Card } from '../../../../common/ui'
import { usePageHeader } from '../../layout/ManagerContext'
import { EmptyCell, LessonTile, WeekGrid, WeekLegend } from '../LichPhanCong/WeekGrid'
import { LECTURERS, SCHEDULE, TEACHING, lecturerStore } from './data'

// Figma 12.4 — Lịch dạy theo tuần của một giảng viên
export default function LichDayGiangVien() {
  const { lecturerId } = useParams()
  const navigate = useNavigate()
  const lecturers = lecturerStore.use()
  const lecturer = lecturers.find((l) => l.id === lecturerId) ?? LECTURERS[0]
  const classes = (TEACHING[lecturer.id] ?? []).length
  usePageHeader('Lịch dạy giảng viên', `Lịch dạy theo tuần · ${classes} lớp · ${lecturer.hours} giờ mỗi tuần`)
  const plan = SCHEDULE[lecturer.id] ?? {}

  return (
    <div className="u-page">
      <BackLink to={`/giangvien/${lecturer.id}`}>{lecturer.name}</BackLink>
      <div className="wk-bar">
        <label className="gv-sel">
          <Avatar name={lecturer.name} initial="last" size={26} tone="soft" />
          <select value={lecturer.id} onChange={(e) => navigate(`/giangvien/${e.target.value}/lich`)} aria-label="Chọn giảng viên">
            {lecturers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <ChevronDown size={15} className="u-faint" />
        </label>
        <h2>Tuần 14 – 20/09/2026</h2>
        <button type="button" className="u-pill is-active">Tuần này</button>
        <WeekLegend />
      </div>
      <Card>
        <WeekGrid
          renderCell={(slot, di) => {
            const lesson = plan[slot]?.[di]
            return lesson ? <LessonTile time={slot} {...lesson} /> : <EmptyCell slot={slot} />
          }}
        />
      </Card>
    </div>
  )
}
