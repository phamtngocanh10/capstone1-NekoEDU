import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus } from 'lucide-react'
import { Btn, Card, Chip, DataTable, Pills, SearchBox } from '../../../../common/ui'
import { norm } from '../../../../common/format'
import { useManager } from '../../layout/ManagerContext'
import { CLASSES, COURSES, FILTERS, STATUS, matchStatus } from './data'
import ClassFormModal from './ClassFormModal'

const courseName = (id) => COURSES.find((classItem) => classItem.id === id)?.name

export default function KhoaHoc() {
  const navigate = useNavigate()
  const { notify } = useManager()
  const [classes, setClasses] = useState(CLASSES)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)

  const searchText = norm(query)
  const rows = classes.filter((classItem) => (
    matchStatus(filter, classItem.status) &&
    norm(`${classItem.name} ${classItem.room} ${classItem.teacher}`).includes(searchText)
  ))

  const create = (values) => {
    const course = COURSES.find((classItem) => classItem.name === values.course) ?? COURSES[0]
    const id = `${values.name.toLowerCase().replace(/\W+/g, '-')}-${Date.now() % 1000}`
    setClasses((l) => [...l, {
      id, name: values.name, courseId: course.id, teacher: values.teacher || '—', room: values.room || '—', days: values.days.join('-') || '—',
      listTime: values.slot.slice(0, 5), range: values.slot.replace(' – ', '–'), size: 0, cap: Number(values.cap) || 20, status: 'soon', latest: null,
    }])
    setCreating(false)
    notify(`Đã tạo lớp ${values.name}`)
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
        {COURSES.map((classItem) => (
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
