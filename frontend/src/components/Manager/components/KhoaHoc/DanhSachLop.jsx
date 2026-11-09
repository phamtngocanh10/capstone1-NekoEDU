import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { BackLink, Btn, Card, Chip, DataTable, MiniStat, Pager, Pills } from '../../../../common/ui'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { academicStore, apiError, loadAcademic, FILTERS, STATUS, matchStatus } from './data'
import { createClass as persistClass } from '../../../../api/courses'
import ClassFormModal from './ClassFormModal'

const LATEST = { done: ['green', 'Đã điểm danh'], todo: ['amber', 'Chưa điểm danh'] }

// Figma 10.1 — Danh sách lớp của một khóa học
export default function DanhSachLop() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { notify } = useManager()
  const { courses, classes } = academicStore.use()
  const course = courses.find((item) => item.id === courseId) ?? { id: courseId, name: '', classes: 0, students: 0, desc: '', open: 0, soon: 0, avgSize: '—' }
  useEffect(() => { loadAcademic().catch((error) => notify(apiError(error))) }, [courseId])
  usePageHeader(course.name, `${course.classes} lớp · ${course.students} học viên · ${course.desc}`)
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const allClasses = classes.filter((item) => item.courseId === course.id)
  const rows = allClasses.filter((classItem) => matchStatus(filter, classItem.status))

  async function createClass(values) {
    try {
      await persistClass(values)
      await loadAcademic()
      setCreating(false)
      notify(`Đã tạo lớp ${values.name}`)
    } catch (error) { notify(apiError(error)) }
  }

  const columns = [
    { key: 'name', label: 'Lớp học', width: '20%', render: (classItem) => <strong>{classItem.name}</strong> },
    { key: 'teacher', label: 'Giảng viên', width: '16%' },
    { key: 'room', label: 'Phòng', width: '8%' },
    { key: 'schedule', label: 'Lịch học', width: '21%', render: (classItem) => `${classItem.days} · ${classItem.range}` },
    { key: 'size', label: 'Sĩ số', width: '8%', render: (classItem) => <strong>{classItem.size}/{classItem.cap}</strong> },
    {
      key: 'latest', label: 'Buổi gần nhất', width: '14%',
      render: (classItem) => (classItem.latest ? <Chip tone={LATEST[classItem.latest][0]}>{LATEST[classItem.latest][1]}</Chip> : '—'),
    },
    { key: 'status', label: 'Trạng thái', width: '13%', render: (classItem) => <Chip tone={STATUS[classItem.status].tone}>{STATUS[classItem.status].label}</Chip> },
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
        <DataTable columns={columns} rows={rows} onRowClick={(classItem) => navigate(`/khoahoc/${course.id}/lop/${classItem.id}`)} maxHeight={480} />
        <Pager text={`Hiển thị ${rows.length} / ${course.classes} lớp`} pages={Math.ceil(course.classes / Math.max(allClasses.length, 1))} />
      </Card>
      {creating && <ClassFormModal course={course} onSubmit={createClass} onClose={() => setCreating(false)} />}
    </div>
  )
}
