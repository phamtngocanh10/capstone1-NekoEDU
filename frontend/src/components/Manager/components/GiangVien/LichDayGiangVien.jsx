import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { Avatar, BackLink, Card } from '../../../../common/ui'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { EmptyCell, LessonTile, WeekGrid, WeekLegend } from '../LichPhanCong/WeekGrid'
import { apiError } from '../KhoaHoc/data'
import { SCHEDULE, TEACHING, lecturerStore, loadLecturers } from './data'

// Figma 12.4 — Lịch dạy theo tuần của một giảng viên
export default function LichDayGiangVien() {
  const { lecturerId } = useParams()
  const navigate = useNavigate()
  const lecturers = lecturerStore.use()
  const { notify } = useManager()
  useEffect(() => { loadLecturers().catch((error) => notify(apiError(error))) }, [lecturerId])
  const lecturer = lecturers.find((item) => item.id === lecturerId) ?? { id: lecturerId, name: '', hours: 0 }
  const classCount = (TEACHING[lecturer.id] ?? []).length
  usePageHeader('Lịch dạy giảng viên', `Lịch dạy theo tuần · ${classCount} lớp · ${lecturer.hours} giờ mỗi tuần`)
  const plan = SCHEDULE[lecturer.id] ?? {}

  return (
    <div className="u-page">
      <BackLink to={`/giangvien/${lecturer.id}`}>{lecturer.name}</BackLink>
      <div className="wk-bar">
        <label className="gv-sel">
          <Avatar name={lecturer.name} initial="last" size={26} tone="soft" />
          <select value={lecturer.id} onChange={(e) => navigate(`/giangvien/${e.target.value}/lich`)} aria-label="Chọn giảng viên">
            {lecturers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <ChevronDown size={15} className="u-faint" />
        </label>
        <h2>Tuần {lecturer.weekStart} – {lecturer.weekEnd}</h2>
        <button type="button" className="u-pill is-active" onClick={() => loadLecturers().catch((error) => notify(apiError(error)))}>Tuần này</button>
        <WeekLegend />
      </div>
      <Card>
        <WeekGrid
          renderCell={(slot, dayIndex) => {
            const [start, end] = slot.split('-')
            const lessons = Object.entries(plan).filter(([range, days]) => days[dayIndex] && range.split('-')[0] >= start && range.split('-')[0] < end)
            return lessons.length ? lessons.map(([range, days]) => <LessonTile key={days[dayIndex].id} time={range} {...days[dayIndex]} />) : <EmptyCell slot={slot} />
          }}
        />
      </Card>
    </div>
  )
}
