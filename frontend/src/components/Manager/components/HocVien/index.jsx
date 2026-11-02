import { useMemo, useRef, useState } from 'react'
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

  const rows = useMemo(() => students.filter((s) => {
    const okFilter = filter === 'all' || (filter === 'overdue' ? s.tuition === 'overdue' : s.status === filter)
    return okFilter && norm(`${s.name} ${s.id}`).includes(norm(query))
  }), [students, query, filter])

  const close = () => setModal(null)
  const save = (values) => {
    if (modal.type === 'edit') {
      setStudents((l) => l.map((s) => (s.id === modal.student.id ? { ...s, name: values.fullName, className: values.className } : s)))
      notify('Đã cập nhật hồ sơ học viên')
    } else {
      const id = `HV2026${String(Math.floor(Math.random() * 9000) + 1000)}`
      setStudents((l) => [{ id, name: values.fullName, className: values.className, joined: new Date().toLocaleDateString('vi-VN'), tuition: 'paid', status: 'studying' }, ...l])
      notify('Đã thêm học viên mới')
    }
    close()
  }
  const remove = () => {
    setStudents((l) => l.filter((s) => s.id !== modal.student.id))
    notify('Đã xóa hồ sơ học viên')
    close()
  }

  const columns = [
    {
      key: 'name', label: 'Học viên', width: '23%',
      render: (s) => <div className="u-person"><Avatar name={s.name} tone="soft" /><div><strong>{s.name}</strong><small>{s.id}</small></div></div>,
    },
    { key: 'className', label: 'Lớp đang học', width: '18%' },
    { key: 'joined', label: 'Ngày nhập học', width: '15%' },
    {
      key: 'tuition', label: 'Học phí', width: '15%',
      render: (s) => <Chip tone={s.tuition === 'paid' ? 'green' : 'red'}>{s.tuition === 'paid' ? 'Đã thanh toán' : 'Quá hạn'}</Chip>,
    },
    { key: 'status', label: 'Trạng thái', width: '10%', render: (s) => <strong>{s.status === 'studying' ? 'Đang học' : 'Ngừng học'}</strong> },
    {
      key: 'actions', label: 'Thao tác', width: '19%',
      render: (s) => (
        <div className="hv-actions" onClick={(e) => e.stopPropagation()}>
          <Btn variant="soft" size="sm" icon={Pencil} onClick={() => setModal({ type: 'edit', student: s })}>Sửa</Btn>
          <Btn variant="danger-soft" size="sm" icon={Trash2} onClick={() => setModal({ type: 'delete', student: s })}>Xóa</Btn>
        </div>
      ),
    },
  ]

  return (
    <div className="u-page">
      <div className="u-grid u-grid--2">
        <StatCard icon={UserCheck} label="Tổng học viên" value={students.length === STUDENTS.length ? '428' : String(428 + students.length - STUDENTS.length)} />
        <StatCard icon={CirclePlus} tone="green" accent="green" label="Tuyển sinh mới (tháng 9)" value="34" delta="+9" deltaIcon={TrendingUp} />
      </div>

      <div className="u-toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Tìm theo tên, mã học viên, SĐT..." />
        <Pills items={FILTERS} value={filter} onChange={setFilter} />
        <span className="u-grow" />
        <Btn variant="icon" aria-label="Xuất danh sách" onClick={() => setModal({ type: 'export' })} icon={Download} />
        <Btn variant="icon" aria-label="Nhập danh sách từ file" onClick={() => fileRef.current?.click()} icon={Upload} />
        <input ref={fileRef} type="file" accept=".xlsx,.csv" hidden onChange={(e) => { if (e.target.files?.length) { notify(`Đã chọn file ${e.target.files[0].name} — sẽ gửi lên backend khi kết nối API`); e.target.value = '' } }} />
        <Btn icon={Plus} onClick={() => setModal({ type: 'add' })}>Thêm học viên</Btn>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(s) => navigate(`/hocvien/${s.id}`, { state: { backTo: '/hocvien', backLabel: 'Học viên' } })}
          empty="Không có học viên phù hợp"
        />
      </Card>

      {(modal?.type === 'add' || modal?.type === 'edit') && <StudentFormModal student={modal.student} onSubmit={save} onClose={close} />}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Xóa hồ sơ học viên?"
          confirmLabel="Xóa vĩnh viễn"
          confirmIcon={Trash2}
          notice={{ title: 'Không thể hoàn tác', text: 'Toàn bộ điểm danh, điểm số và lịch sử học phí liên quan sẽ bị xóa theo.' }}
          onConfirm={remove}
          onClose={close}
        >
          Bạn sắp xóa vĩnh viễn hồ sơ của <b>{modal.student.name} ({modal.student.id})</b>.
        </ConfirmDialog>
      )}
      {modal?.type === 'export' && (
        <ExportModal students={students} total={428} onClose={close} onDone={(name) => { notify(`Đã tạo file ${name}`); close() }} />
      )}
    </div>
  )
}
