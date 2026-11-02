import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Avatar, Btn, Card, Chip, DataTable, MiniStat, Pills } from '../../../../common/ui'
import { useManager } from '../../layout/ManagerContext'
import { ROLE_LABEL, STATUS, addLecturer, lecturerStore } from './data'
import LecturerFormModal from './LecturerFormModal'

const FILTERS = [{ value: 'all', label: 'Tất cả' }, { value: 'lecturer', label: 'Giảng viên' }, { value: 'assistant', label: 'Trợ giảng' }]

export default function GiangVien() {
  const navigate = useNavigate()
  const { notify } = useManager()
  const lecturers = lecturerStore.use()
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const rows = useMemo(() => lecturers.filter((l) => filter === 'all' || l.role === filter), [lecturers, filter])
  const count = (st) => lecturers.filter((l) => l.status === st).length

  const add = (v) => {
    addLecturer({
      id: `GV${Date.now() % 1000000}`, name: v.fullName, cert: v.specialty, role: v.role, summary: 'Chưa có lớp', hours: 0, cells: [0, 0, 0, 0, 0, 0], status: 'none',
      gender: v.gender, birth: v.birth, address: v.address, phone: v.phone, email: v.email, specialty: v.specialty, certificate: '—', contract: v.contract,
      rate: Number(v.rate), joined: v.joined, account: 'Đã kích hoạt', monthHours: 0, rating: '—', punctual: '—',
    })
    setAdding(false)
    notify(`Đã thêm ${v.fullName}`)
  }

  const columns = [
    { key: 'name', label: 'Giảng viên', width: '21%', render: (l) => <div className="u-person"><Avatar name={l.name} initial="last" size={34} tone="soft" /><div><strong>{l.name}</strong><small>{l.cert}</small></div></div> },
    { key: 'role', label: 'Vai trò', width: '12%', render: (l) => <Chip tone={l.role === 'lecturer' ? 'blue' : 'gray'}>{ROLE_LABEL[l.role]}</Chip> },
    { key: 'summary', label: 'Đang phụ trách', width: '23%', className: 'u-tight' },
    { key: 'hours', label: 'Giờ / tuần', width: '9%', render: (l) => <strong>{l.hours}h</strong> },
    { key: 'cells', label: 'Lịch hôm nay', width: '17%', render: (l) => <div className="gv-cells">{l.cells.map((on, i) => <i key={i} className={on ? 'on' : ''} />)}</div> },
    { key: 'status', label: 'Trạng thái', width: '14%', render: (l) => <Chip tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Chip> },
  ]

  return (
    <div className="u-page">
      <div className="u-grid u-grid--4">
        <MiniStat label="Tổng nhân sự" value={lecturers.length} lg />
        <MiniStat label="Đang dạy lúc này" value={count('teaching')} lg />
        <MiniStat label="Rảnh hôm nay" value={count('free')} lg />
        <MiniStat label="Chưa nhận lớp" value={count('none')} lg />
      </div>
      <div className="u-toolbar">
        <Pills items={FILTERS} value={filter} onChange={setFilter} />
        <span className="u-grow" />
        <Btn icon={Plus} onClick={() => setAdding(true)}>Thêm giảng viên</Btn>
      </div>
      <Card>
        <DataTable columns={columns} rows={rows} onRowClick={(l) => navigate(`/giangvien/${l.id}`)} />
        <p className="gv-note" style={{ marginTop: 12 }}>Mỗi ô nhỏ = 1 khung giờ trong ngày (07–09, 09–11, 13–15, 15–17, 17–19, 19–21)</p>
      </Card>
      {adding && <LecturerFormModal onSubmit={add} onClose={() => setAdding(false)} />}
    </div>
  )
}
