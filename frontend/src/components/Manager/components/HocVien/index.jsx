import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Pencil, Plus, Trash2, Upload, UserCheck, CirclePlus, TrendingUp } from 'lucide-react'
import { Avatar, Btn, Card, Chip, ConfirmDialog, DataTable, Pills, SearchBox, StatCard } from '../../../../common/ui'
import { norm } from '../../../../common/format'
import { useManager } from '../../layout/ManagerContext'
import { FILTERS, STUDENTS } from './data'
import StudentFormModal from './StudentFormModal'
import ExportModal from './ExportModal'

export default function HocVien() {
  const navigate = useNavigate()
  const { notify } = useManager()
  const fileRef = useRef(null)
  const [students, setStudents] = useState(STUDENTS)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null) // { type: 'add' | 'edit' | 'delete' | 'export', student? }

  const searchText = norm(query)
  const rows = students.filter((student) => {
    let matchesFilter = student.status === filter
    if (filter === 'all') matchesFilter = true
    if (filter === 'overdue') matchesFilter = student.tuition === 'overdue'
    return matchesFilter && norm(`${student.name} ${student.id}`).includes(searchText)
  })

  const closeModal = () => setModal(null)
  const saveStudent = (values) => {
    if (modal.type === 'edit') {
      setStudents((currentStudents) => currentStudents.map((student) => (
        student.id === modal.student.id
          ? { ...student, name: values.fullName, className: values.className }
          : student
      )))
      notify('Đã cập nhật hồ sơ học viên')
    } else {
      const id = `HV2026${String(Math.floor(Math.random() * 9000) + 1000)}`
      const newStudent = {
        id,
        name: values.fullName,
        className: values.className,
        joined: new Date().toLocaleDateString('vi-VN'),
        tuition: 'paid',
        status: 'studying',
      }
      setStudents((currentStudents) => [newStudent, ...currentStudents])
      notify('Đã thêm học viên mới')
    }
    closeModal()
  }
  const removeStudent = () => {
    setStudents((currentStudents) => currentStudents.filter((student) => student.id !== modal.student.id))
    notify('Đã xóa hồ sơ học viên')
    closeModal()
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    notify(`Đã chọn file ${file.name} — sẽ gửi lên backend khi kết nối API`)
    event.target.value = ''
  }

  function handleExportDone(fileName) {
    notify(`Đã tạo file ${fileName}`)
    closeModal()
  }

  const columns = [
    {
      key: 'name', label: 'Học viên', width: '23%',
      render: (student) => (
        <div className="u-person">
          <Avatar name={student.name} tone="soft" />
          <div><strong>{student.name}</strong><small>{student.id}</small></div>
        </div>
      ),
    },
    { key: 'className', label: 'Lớp đang học', width: '18%' },
    { key: 'joined', label: 'Ngày nhập học', width: '15%' },
    {
      key: 'tuition', label: 'Học phí', width: '15%',
      render: (student) => <Chip tone={student.tuition === 'paid' ? 'green' : 'red'}>{student.tuition === 'paid' ? 'Đã thanh toán' : 'Quá hạn'}</Chip>,
    },
    { key: 'status', label: 'Trạng thái', width: '10%', render: (student) => <strong>{student.status === 'studying' ? 'Đang học' : 'Ngừng học'}</strong> },
    {
      key: 'actions', label: 'Thao tác', width: '19%',
      render: (student) => (
        <div className="hv-actions" onClick={(e) => e.stopPropagation()}>
          <Btn variant="soft" size="sm" icon={Pencil} onClick={() => setModal({ type: 'edit', student: student })}>Sửa</Btn>
          <Btn variant="danger-soft" size="sm" icon={Trash2} onClick={() => setModal({ type: 'delete', student: student })}>Xóa</Btn>
        </div>
      ),
    },
  ]

  return (
    <div className="u-page">
      <div className="u-grid u-grid--2">
        <StatCard icon={UserCheck} label="Tổng học viên" value={String(428 + students.length - STUDENTS.length)} />
        <StatCard icon={CirclePlus} tone="green" accent="green" label="Tuyển sinh mới (tháng 9)" value="34" delta="+9" deltaIcon={TrendingUp} />
      </div>

      <div className="u-toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Tìm theo tên, mã học viên, SĐT..." />
        <Pills items={FILTERS} value={filter} onChange={setFilter} />
        <span className="u-grow" />
        <Btn variant="icon" aria-label="Xuất danh sách" onClick={() => setModal({ type: 'export' })} icon={Download} />
        <Btn variant="icon" aria-label="Nhập danh sách từ file" onClick={() => fileRef.current?.click()} icon={Upload} />
        <input ref={fileRef} type="file" accept=".xlsx,.csv" hidden onChange={handleFileChange} />
        <Btn icon={Plus} onClick={() => setModal({ type: 'add' })}>Thêm học viên</Btn>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(student) => navigate(`/hocvien/${student.id}`, { state: { backTo: '/hocvien', backLabel: 'Học viên' } })}
          empty="Không có học viên phù hợp"
        />
      </Card>

      {(modal?.type === 'add' || modal?.type === 'edit') && <StudentFormModal student={modal.student} onSubmit={saveStudent} onClose={closeModal} />}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Xóa hồ sơ học viên?"
          confirmLabel="Xóa vĩnh viễn"
          confirmIcon={Trash2}
          notice={{ title: 'Không thể hoàn tác', text: 'Toàn bộ điểm danh, điểm số và lịch sử học phí liên quan sẽ bị xóa theo.' }}
          onConfirm={removeStudent}
          onClose={closeModal}
        >
          Bạn sắp xóa vĩnh viễn hồ sơ của <b>{modal.student.name} ({modal.student.id})</b>.
        </ConfirmDialog>
      )}
      {modal?.type === 'export' && (
        <ExportModal students={students} total={428} onClose={closeModal} onDone={handleExportDone} />
      )}
    </div>
  )
}
