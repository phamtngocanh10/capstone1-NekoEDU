import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus } from 'lucide-react'
import { Btn, Card, Chip, DataTable, Pills, SearchBox } from '../../../../common/ui'
import { norm } from '../../../../common/format'
import { useManager } from '../../layout/ManagerContext'
import { CLASSES, COURSES, FILTERS, STATUS, matchStatus } from './data'
import ClassFormModal from './ClassFormModal'

const courseName = (id) => COURSES.find((c) => c.id === id)?.name

export default function KhoaHoc() {
  const navigate = useNavigate()
  const { notify } = useManager()
  const [classes, setClasses] = useState(CLASSES)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)

  const rows = useMemo(
    () => classes.filter((c) => matchStatus(filter, c.status) && norm(`${c.name} ${c.room} ${c.teacher}`).includes(norm(query))),
    [classes, filter, query],
  )

  const create = (v) => {
    const course = COURSES.find((c) => c.name === v.course) ?? COURSES[0]
    const id = `${v.name.toLowerCase().replace(/\W+/g, '-')}-${Date.now() % 1000}`
    setClasses((l) => [...l, {
      id, name: v.name, courseId: course.id, teacher: v.teacher || '—', room: v.room || '—', days: v.days.join('-') || '—',
      listTime: v.slot.slice(0, 5), range: v.slot.replace(' – ', '–'), size: 0, cap: Number(v.cap) || 20, status: 'soon', latest: null,
    }])
    setCreating(false)
    notify(`Đã tạo lớp ${v.name}`)
  }

  const columns = [
    { key: 'name', label: 'Lớp học', width: '19%', render: (c) => <strong>{c.name}</strong> },
    { key: 'course', label: 'Khóa học', width: '16%', render: (c) => courseName(c.courseId) },
    { key: 'teacher', label: 'Giảng viên', width: '17%' },
    { key: 'room', label: 'Phòng', width: '8%' },
    { key: 'schedule', label: 'Lịch học', width: '17%', render: (c) => `${c.days} · ${c.listTime}` },
    { key: 'size', label: 'Sĩ số', width: '8%', render: (c) => <strong>{c.size}/{c.cap}</strong> },
    { key: 'status', label: 'Trạng thái', width: '15%', render: (c) => <Chip tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Chip> },
  ]

  return (
    <div className="u-page">
      <div className="u-grid u-grid--2">
        {COURSES.map((c) => (
          <button key={c.id} type="button" className="kh-course" style={{ '--accent': c.accent }} onClick={() => navigate(`/khoahoc/${c.id}`)}>
            <span className="u-stat__icon"><BookOpen size={16} /></span>
            <strong>{c.name}</strong>
            <small>{c.desc}</small>
            <small>{c.classes} lớp · {c.students} học viên</small>
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
        <DataTable columns={columns} rows={rows} onRowClick={(c) => navigate(`/khoahoc/${c.courseId}/lop/${c.id}`)} empty="Không có lớp học phù hợp" maxHeight={480} />
      </Card>

      {creating && <ClassFormModal onSubmit={create} onClose={() => setCreating(false)} />}
    </div>
  )
}
