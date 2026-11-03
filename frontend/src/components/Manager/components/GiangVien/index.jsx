import { useState } from 'react'
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
  const rows = lecturers.filter((lecturer) => filter === 'all' || lecturer.role === filter)
  const count = (status) => lecturers.filter((lecturer) => lecturer.status === status).length

  const addNewLecturer = (values) => {
    addLecturer({
      id: `GV${Date.now() % 1000000}`, name: values.fullName, cert: values.specialty, role: values.role, summary: 'Chưa có lớp', hours: 0, cells: [0, 0, 0, 0, 0, 0], status: 'none',
      gender: values.gender, birth: values.birth, address: values.address, phone: values.phone, email: values.email, specialty: values.specialty, certificate: '—', contract: values.contract,
      rate: Number(values.rate), joined: values.joined, account: 'Đã kích hoạt', monthHours: 0, rating: '—', punctual: '—',
    })
    setAdding(false)
    notify(`Đã thêm ${values.fullName}`)
  }

  const columns = [
    {
      key: 'name', label: 'Giảng viên', width: '21%',
      render: (lecturer) => (
        <div className="u-person">
          <Avatar name={lecturer.name} initial="last" size={34} tone="soft" />
          <div><strong>{lecturer.name}</strong><small>{lecturer.cert}</small></div>
        </div>
      ),
    },
    { key: 'role', label: 'Vai trò', width: '12%', render: (lecturer) => <Chip tone={lecturer.role === 'lecturer' ? 'blue' : 'gray'}>{ROLE_LABEL[lecturer.role]}</Chip> },
    { key: 'summary', label: 'Đang phụ trách', width: '23%', className: 'u-tight' },
    { key: 'hours', label: 'Giờ / tuần', width: '9%', render: (lecturer) => <strong>{lecturer.hours}h</strong> },
    {
      key: 'cells', label: 'Lịch hôm nay', width: '17%',
      render: (lecturer) => (
        <div className="gv-cells">
          {lecturer.cells.map((hasLesson, index) => <i key={index} className={hasLesson ? 'on' : ''} />)}
        </div>
      ),
    },
    { key: 'status', label: 'Trạng thái', width: '14%', render: (lecturer) => <Chip tone={STATUS[lecturer.status].tone}>{STATUS[lecturer.status].label}</Chip> },
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
        <DataTable columns={columns} rows={rows} onRowClick={(lecturer) => navigate(`/giangvien/${lecturer.id}`)} />
        <p className="gv-note" style={{ marginTop: 12 }}>Mỗi ô nhỏ = 1 khung giờ trong ngày (07–09, 09–11, 13–15, 15–17, 17–19, 19–21)</p>
      </Card>
      {adding && <LecturerFormModal onSubmit={addNewLecturer} onClose={() => setAdding(false)} />}
    </div>
  )
}
