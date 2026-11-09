import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Pencil, Plus, Trash2, Upload, UserCheck, CirclePlus, TrendingUp } from 'lucide-react'
import { Avatar, Btn, Card, Chip, ConfirmDialog, DataTable, Pills, SearchBox, StatCard } from '../../../../common/ui'
import { norm } from '../../../../common/format'
import { getManagedStudents, saveManagedStudent, deleteStudent, importStudents } from '../../../../api/students'
import { academicStore, apiError, loadAcademic } from '../KhoaHoc/data'
import { useManager } from '../../layout/ManagerContext'
import { FILTERS } from './data'
import StudentFormModal from './StudentFormModal'
import ExportModal from './ExportModal'

export default function HocVien() {
  const navigate = useNavigate()
  const { notify } = useManager()
  const fileRef = useRef(null)
  const [students, setStudents] = useState([])
  const { catalog } = academicStore.use()
  const reload = async () => setStudents(await getManagedStudents())
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null) // { type: 'add' | 'edit' | 'delete' | 'export', student? }

  useEffect(() => {
    let active = true
    getManagedStudents().then((items) => { if (active) setStudents(items) }).catch((error) => notify(apiError(error)))
    loadAcademic().catch((error) => notify(apiError(error)))
    return () => { active = false }
  }, [])

  const searchText = norm(query)
  const rows = students.filter((student) => {
    let matchesFilter = student.status === filter
    if (filter === 'all') matchesFilter = true
    if (filter === 'overdue') matchesFilter = student.tuition === 'overdue'
    return matchesFilter && norm(`${student.name} ${student.studentCode ?? student.id} ${student.parentPhone}`).includes(searchText)
  })

  const closeModal = () => setModal(null)
  const saveStudent = async (values) => {
    if (saving) return
    setSaving(true)
    try {
      const saved = await saveManagedStudent(values, modal.type === 'edit' ? modal.student.backendId : undefined)
      await reload()
      closeModal()
      notify(saved.guardianStudents > 1 ? `Đã lưu hồ sơ. Thông tin phụ huynh dùng chung cho ${saved.guardianStudents} học viên.` : saved.enrollmentState === 'pending' ? 'Đã lưu hồ sơ. Học viên chưa xếp lớp.' : 'Đã lưu hồ sơ và ghi danh học viên')
    } catch (error) { notify(apiError(error)) }
    finally { setSaving(false) }
  }
  const removeStudent = async () => {
    try {
      await deleteStudent(modal.student.backendId)
      await reload()
      closeModal()
      notify('Đã ngừng học hồ sơ; lịch sử được giữ nguyên')
    } catch (error) { notify(apiError(error)) }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const result = await importStudents(file)
      await reload()
      notify(`Đã nhập ${result.count} học viên`)
    } catch (error) { notify(apiError(error)) }
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
          <div><strong>{student.name}</strong><small>{student.studentCode ?? student.id}</small></div>
        </div>
      ),
    },
    { key: 'className', label: 'Lớp đang học', width: '18%' },
    { key: 'joined', label: 'Ngày nhập học', width: '15%' },
    {
      key: 'tuition', label: 'Học phí', width: '15%',
      render: (student) => student.tuition === 'pending'
        ? <span>Chưa thanh toán</span>
        : <Chip tone={student.tuition === 'paid' ? 'green' : 'red'}>{student.tuition === 'paid' ? 'Đã thanh toán' : 'Quá hạn'}</Chip>,
    },
    { key: 'status', label: 'Trạng thái', width: '10%', render: (student) => <strong>{student.statusLabel ?? (student.status === 'studying' ? 'Đang học' : 'Ngừng học')}</strong> },
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
        <StatCard icon={UserCheck} label="Tổng học viên" value={String(students.length)} />
        <StatCard icon={CirclePlus} tone="green" accent="green" label={`Tuyển sinh mới (tháng ${new Date().getMonth() + 1})`} value={students.filter((item) => item.enrolledAt?.slice(0, 7) === new Date().toISOString().slice(0, 7)).length} deltaIcon={TrendingUp} />
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

      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <StudentFormModal
          student={modal.student}
          catalog={catalog}
          onSubmit={saveStudent}
          onClose={closeModal}
        />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Xóa hồ sơ học viên?"
          confirmLabel="Ngừng học"
          confirmIcon={Trash2}
          notice={{ title: 'Lưu trữ hồ sơ', text: 'Học viên ngừng học; điểm danh, điểm số và lịch sử học phí được giữ nguyên.' }}
          onConfirm={removeStudent}
          onClose={closeModal}
        >
          Bạn sắp ngừng học hồ sơ của <b>{modal.student.name} ({modal.student.id})</b>.
        </ConfirmDialog>
      )}
      {modal?.type === 'export' && (
        <ExportModal students={students} total={students.length} onClose={closeModal} onDone={handleExportDone} />
      )}
    </div>
  )
}
