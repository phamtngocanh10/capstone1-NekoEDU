import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { BackLink, Btn, Card, Chip, DataTable, MiniStat, Pager, Pills } from '../../../../common/ui'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { FILTERS, STATUS, courseById, matchStatus, rowsOfCourse } from './data'
import ClassFormModal from './ClassFormModal'

const LATEST = { done: ['green', 'Đã điểm danh'], todo: ['amber', 'Chưa điểm danh'] }

// Figma 10.1 — Danh sách lớp của một khóa học
export default function DanhSachLop() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { notify } = useManager()
  const course = courseById(courseId)
  usePageHeader(course.name, `${course.classes} lớp · ${course.students} học viên · ${course.desc}`)
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const all = rowsOfCourse(course.id)
  const rows = useMemo(() => all.filter((c) => matchStatus(filter, c.status)), [all, filter])

  const columns = [
    { key: 'name', label: 'Lớp học', width: '20%', render: (c) => <strong>{c.name}</strong> },
    { key: 'teacher', label: 'Giảng viên', width: '16%' },
    { key: 'room', label: 'Phòng', width: '8%' },
    { key: 'schedule', label: 'Lịch học', width: '21%', render: (c) => `${c.days} · ${c.range}` },
    { key: 'size', label: 'Sĩ số', width: '8%', render: (c) => <strong>{c.size}/{c.cap}</strong> },
    {
      key: 'latest', label: 'Buổi gần nhất', width: '14%',
      render: (c) => (c.latest ? <Chip tone={LATEST[c.latest][0]}>{LATEST[c.latest][1]}</Chip> : '—'),
    },
    { key: 'status', label: 'Trạng thái', width: '13%', render: (c) => <Chip tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Chip> },
  ]

  return (
    <div className="u-page">
      <BackLink to="/khoahoc">Khóa học &amp; Lớp học</BackLink>
      <div className="u-grid u-grid--4">
        <MiniStat label="Tổng số lớp" value={course.classes} />
        <MiniStat label="Đang mở" value={course.open} />
        <MiniStat label="Sắp khai giảng" value={course.soon} />
        <MiniStat label="Sĩ số trung bình" value={course.avgSize} />
      </div>
      <div className="u-toolbar">
        <Pills items={FILTERS} value={filter} onChange={setFilter} />
        <span className="u-grow" />
        <Btn icon={Plus} onClick={() => setCreating(true)}>Tạo lớp mới</Btn>
      </div>
      <Card>
        <DataTable columns={columns} rows={rows} onRowClick={(c) => navigate(`/khoahoc/${course.id}/lop/${c.id}`)} maxHeight={480} />
        <Pager text={`Hiển thị ${rows.length} / ${course.classes} lớp`} pages={Math.ceil(course.classes / Math.max(all.length, 1))} />
      </Card>
      {creating && <ClassFormModal course={course} onSubmit={(v) => { setCreating(false); notify(`Đã tạo lớp ${v.name}`) }} onClose={() => setCreating(false)} />}
    </div>
  )
}
