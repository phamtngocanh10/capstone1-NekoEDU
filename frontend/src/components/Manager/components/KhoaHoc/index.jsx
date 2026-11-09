import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus } from 'lucide-react'
import { Btn, Card, Chip, DataTable, Pills, SearchBox } from '../../../../common/ui'
import { norm } from '../../../../common/format'
import { useManager } from '../../layout/ManagerContext'
import { academicStore, apiError, loadAcademic, FILTERS, STATUS, matchStatus } from './data'
import { createClass } from '../../../../api/courses'
import ClassFormModal from './ClassFormModal'


export default function KhoaHoc() {
  const navigate = useNavigate()
  const { notify } = useManager()
  const { classes, courses } = academicStore.use()
  const courseName = (id) => courses.find((item) => item.id === id)?.name
  useEffect(() => { loadAcademic().catch((error) => notify(apiError(error))) }, [])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)

  const searchText = norm(query)
  const rows = classes.filter((classItem) => (
    matchStatus(filter, classItem.status) &&
    norm(`${classItem.name} ${classItem.room} ${classItem.teacher}`).includes(searchText)
  ))

  const create = async (values) => {
    try {
      await createClass(values)
      await loadAcademic()
      setCreating(false)
      notify(`Đã tạo lớp ${values.name}`)
    } catch (error) { notify(apiError(error)) }
  }

  const columns = [
    { key: 'name', label: 'Lớp học', width: '19%', render: (classItem) => <strong>{classItem.name}</strong> },
    { key: 'course', label: 'Khóa học', width: '16%', render: (classItem) => courseName(classItem.courseId) },
    { key: 'teacher', label: 'Giảng viên', width: '17%' },
    { key: 'room', label: 'Phòng', width: '8%' },
    { key: 'schedule', label: 'Lịch học', width: '17%', render: (classItem) => `${classItem.days} · ${classItem.listTime}` },
    { key: 'size', label: 'Sĩ số', width: '8%', render: (classItem) => <strong>{classItem.size}/{classItem.cap}</strong> },
    { key: 'status', label: 'Trạng thái', width: '15%', render: (classItem) => <Chip tone={STATUS[classItem.status].tone}>{STATUS[classItem.status].label}</Chip> },
  ]

  return (
    <div className="u-page">
      <div className="u-grid u-grid--2">
        {courses.map((classItem) => (
          <button key={classItem.id} type="button" className="kh-course" style={{ '--accent': classItem.accent }} onClick={() => navigate(`/khoahoc/${classItem.id}`)}>
            <span className="u-stat__icon"><BookOpen size={16} /></span>
            <strong>{classItem.name}</strong>
            <small>{classItem.desc}</small>
            <small>{classItem.classes} lớp · {classItem.students} học viên</small>
          </button>
        ))}
      </div>

      <div className="u-toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Tìm lớp học, phòng, giảng viên..." />
        <Pills items={FILTERS} value={filter} onChange={setFilter} />
        <span className="u-grow" />
        <Btn icon={Plus} onClick={() => setCreating(true)}>Tạo lớp mới</Btn>
      </div>

      <Card>
        <DataTable columns={columns} rows={rows} onRowClick={(classItem) => navigate(`/khoahoc/${classItem.courseId}/lop/${classItem.id}`)} empty="Không có lớp học phù hợp" maxHeight={480} />
      </Card>

      {creating && <ClassFormModal onSubmit={create} onClose={() => setCreating(false)} />}
    </div>
  )
}
