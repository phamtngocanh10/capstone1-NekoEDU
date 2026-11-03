import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackLink, Btn, Card, Chip, DataTable, MiniStat, Pager } from '../../../../common/ui'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { PROGRESS_STATE, STATE, progressRows, scoreStore, updateCard } from './data'
import ThietLapModal from './ThietLapModal'

// Figma 13.1 — Điểm số của một khóa học, theo từng lớp
export default function DiemKhoaHoc() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { notify } = useManager()
  usePageHeader('Điểm số khóa học', 'Tiến độ nhập điểm giữa kỳ theo từng lớp')
  const course = scoreStore.use().find((item) => item.id === courseId) ?? scoreStore.get()[0]
  const rows = progressRows(course.id)
  const [setupOpen, setSetupOpen] = useState(false)
  const unfinishedCount = rows.filter((classItem) => classItem.state !== 'published').length

  function saveSettings(values) {
    const { id, ...settings } = values
    updateCard(id, settings)
    setSetupOpen(false)
    notify('Đã lưu thiết lập thời gian điểm số')
  }

  const columns = [
    { key: 'name', label: 'Lớp học', width: '20%', render: (classItem) => <strong>{classItem.name}</strong> },
    { key: 'teacher', label: 'Giảng viên', width: '17%' },
    { key: 'students', label: 'Học viên', width: '10%' },
    { key: 'state', label: 'Trạng thái', width: '17%', render: (classItem) => <Chip tone={PROGRESS_STATE[classItem.state].tone}>{PROGRESS_STATE[classItem.state].label}</Chip> },
    { key: 'at', label: 'Xác nhận lúc', width: '14%' },
    { key: 'avg', label: 'Điểm TB', width: '9%', render: (classItem) => <strong>{classItem.avg}</strong> },
    {
      key: 'act', label: '', width: '10%',
      render: (classItem) => classItem.state !== 'published' && (
        <span onClick={(event) => event.stopPropagation()}>
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => notify(`Đã nhắc ${classItem.teacher} nhập điểm lớp ${classItem.name}`)}
          >
            Nhắc
          </Btn>
        </span>
      ),
    },
  ]

  return (
    <div className="u-page">
      <BackLink to="/diemdanh">Điểm số</BackLink>
      <Card className="ds-head">
        <div className="u-grow">
          <h2>{course.name}</h2>
          <Chip tone={STATE[course.state].tone}>{STATE[course.state].label}</Chip>
          <p>{course.term} · Giảng viên nhập điểm: {course.window} · Công bố: {course.release.charAt(0).toLowerCase() + course.release.slice(1)}</p>
          <p className="ds-em ds-em--amber">{course.note}</p>
        </div>
        <Btn variant="soft" onClick={() => setSetupOpen(true)}>Thiết lập thời gian</Btn>
        <Btn disabled={unfinishedCount === 0} onClick={() => notify(`Đã nhắc giảng viên của ${unfinishedCount} lớp chưa xong`)}>Nhắc giảng viên chưa xong ({unfinishedCount} lớp)</Btn>
      </Card>
      <div className="u-grid u-grid--3">
        <MiniStat label="Đã công bố" value={`${course.published} / ${course.total} lớp`} lg />
        <MiniStat label="Điểm trung bình khóa" value={course.avg} lg />
        <MiniStat label="Thời gian còn lại" value={course.left} lg />
      </div>
      <Card>
        <DataTable columns={columns} rows={rows} onRowClick={(classItem) => navigate(`/diemdanh/lop/${classItem.id}`)} />
        <Pager text={`Hiển thị ${rows.length} / ${course.total} lớp · Nhấn vào lớp để xem bảng điểm`} pages={Math.ceil(course.total / rows.length)} />
      </Card>
      {setupOpen && (
        <ThietLapModal course={course} onClose={() => setSetupOpen(false)} onSubmit={saveSettings} />
      )}
    </div>
  )
}
