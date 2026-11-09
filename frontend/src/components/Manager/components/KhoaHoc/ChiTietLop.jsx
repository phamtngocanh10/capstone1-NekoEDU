import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, BackLink, Btn, Card, Chip, DataTable, Pager, Progress, SearchBox } from '../../../../common/ui'
import { downloadText, norm } from '../../../../common/format'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { academicStore, apiError, loadAcademic, STATUS } from './data'

import { getClass } from '../../../../api/courses'

const TODAY = { present: ['green', 'Có mặt'], late: ['amber', 'Đi muộn'], absent: ['red', 'Vắng'], pending: ['gray', 'Chưa điểm danh'] }

// Figma 10.2 — Chi tiết lớp học
export default function ChiTietLop() {
  const { courseId, classId } = useParams()
  const navigate = useNavigate()
  const { notify } = useManager()
  usePageHeader('Chi tiết lớp học', 'Giảng viên, điểm danh và danh sách học viên')
  const { courses } = academicStore.use()
  const course = courses.find((item) => item.id === courseId) ?? { id: courseId, name: '' }
  const [classInfo, setClassInfo] = useState(null)
  useEffect(() => {
    let active = true
    getClass(classId).then((item) => { if (active) setClassInfo(item) }).catch((error) => notify(apiError(error)))
    loadAcademic().catch((error) => notify(apiError(error)))
    return () => { active = false }
  }, [classId])
  const [query, setQuery] = useState('')
  const searchText = norm(query)
  const roster = classInfo?.roster ?? []
  const rows = roster.filter((student) => norm(`${student.name} ${student.id}`).includes(searchText))

  const exportList = () => {
    const header = 'Mã HV,Họ và tên,Chuyên cần,Điểm gần nhất'
    const studentRows = roster.map((student) => (
      `${student.id},${student.name},${student.rate},${student.score}`
    ))
    downloadText(`DS-${classInfo.id}.csv`, [header, ...studentRows].join('\n'))
    notify('Đã xuất danh sách học viên của lớp')
  }

  function viewStudent(student) {
    navigate(`/hocvien/${student.id}`, {
      state: {
        backTo: `/khoahoc/${course.id}/lop/${classInfo.id}`,
        backLabel: classInfo.name,
        student: { name: student.name, className: classInfo.name },
      },
    })
  }
  const columns = [
    {
      key: 'name', label: 'Học viên', width: '30%',
      render: (student) => (
        <div className="u-person">
          <Avatar name={student.name} initial="last" tone="soft" />
          <div><strong>{student.name}</strong><small>{student.id}</small></div>
        </div>
      ),
    },
    { key: 'today', label: 'Điểm danh hôm nay', width: '20%', render: (student) => <Chip tone={TODAY[student.today][0]}>{TODAY[student.today][1]}</Chip> },
    { key: 'rate', label: 'Chuyên cần', width: '16%' },
    { key: 'score', label: 'Điểm giữa kỳ', width: '14%' },
    { key: 'fee', label: 'Học phí', width: '14%', render: (student) => <Chip tone={student.fee === 'paid' ? 'green' : 'red'}>{student.fee === 'paid' ? 'Đã đóng' : student.fee === 'overdue' ? 'Quá hạn' : 'Chưa thanh toán'}</Chip> },
  ]

  if (!classInfo) return null

  return (
    <div className="u-page">
      <BackLink to={`/khoahoc/${course.id}`}>{course.name}</BackLink>

      <Card className="kh-head">
        <div className="u-grow">
          <h2>{classInfo.name}</h2>
          <Chip tone={STATUS[classInfo.status].tone}>{STATUS[classInfo.status].label}</Chip>
          <p>Khóa {course.name} · Phòng {classInfo.room} · {classInfo.days}, {classInfo.range}</p>
        </div>
        <Btn variant="soft" onClick={() => navigate(`/lichphancong/${new Date().toISOString().slice(0, 10)}?slot=${classInfo.range.replace('–', '-')}`)}>Xem điểm danh</Btn>
        <Btn onClick={() => navigate(`/diemdanh/lop/${classInfo.id}`)}>Xem bảng điểm</Btn>
      </Card>

      <div className="kh-info">
        <Card>
          <h4>Giảng viên &amp; trợ giảng</h4>
          <div className="kh-teacher"><Avatar name={classInfo.teacher} initial="last" size={34} /><div><strong>{classInfo.teacher}</strong><small>Giảng viên chính · {classInfo.teacherContact ?? '—'}</small></div></div>
          <div className="kh-teacher"><Avatar name={classInfo.assistant} initial="last" size={34} tone="green" /><div><strong>{classInfo.assistant}</strong><small>Trợ giảng · {classInfo.assistantContact ?? '—'}</small></div></div>
        </Card>
        <Card>
          <h4>Điểm danh hôm nay</h4>
          <Chip tone={classInfo.todayStatus === 'done' ? 'green' : 'gray'} size="lg">{classInfo.todayStatus === 'done' ? 'Đã điểm danh' : classInfo.todayStatus === 'none' ? 'Chưa có buổi học hôm nay' : 'Chưa điểm danh'}</Chip>
          <p className="kh-today">Buổi {classInfo.completed}/{classInfo.sessionCount} · {classInfo.range}</p>
          <Progress value={roster.filter((item) => ['present', 'late'].includes(item.today)).length} max={Math.max(roster.length, 1)} color="var(--success-fill)" large label="Tỉ lệ có mặt" />
          <p className="u-muted" style={{ marginTop: 8, fontSize: 11 }}>Có mặt {roster.filter((item) => item.today === 'present').length} · Muộn {roster.filter((item) => item.today === 'late').length} · Vắng {roster.filter((item) => item.today === 'absent').length}</p>
        </Card>
        <Card>
          <h4>Thông tin lớp</h4>
          <dl className="u-info">
            <div><dt>Sĩ số</dt><dd>{classInfo.size} / {classInfo.cap}</dd></div>
            <div><dt>Khai giảng</dt><dd>{classInfo.start}</dd></div>
            <div><dt>Đã học</dt><dd>{classInfo.completed} / {classInfo.sessionCount} buổi</dd></div>
            <div><dt>Học phí / 8 buổi</dt><dd>{classInfo.fee == null ? 'Chưa có chính sách' : `${classInfo.fee.toLocaleString('vi-VN')}đ`}</dd></div>
          </dl>
        </Card>
      </div>

      <Card>
        <div className="kh-roster-head">
          <h3>Danh sách học viên ({classInfo.size})</h3>
          <SearchBox small value={query} onChange={setQuery} placeholder="Tìm học viên..." />
          <Btn variant="ghost" size="md" onClick={exportList}>Xuất DS</Btn>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={viewStudent}
          maxHeight={420}
        />
        <Pager text={`Hiển thị ${rows.length} / ${classInfo.size} học viên`} pages={Math.ceil(classInfo.size / Math.max(roster.length, 1))} />
      </Card>
    </div>
  )
}
