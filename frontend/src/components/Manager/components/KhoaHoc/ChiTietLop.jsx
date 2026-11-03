import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, BackLink, Btn, Card, Chip, DataTable, Pager, Progress, SearchBox } from '../../../../common/ui'
import { downloadText, norm } from '../../../../common/format'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { ROSTER, STATUS, courseById, findClass } from './data'

const LECTURER_INFO = { 'Trần Minh Khôi': 'IELTS 7.5 · 0905 xxx 118', 'Lê Anh Dũng': 'TOEIC 900 · 0912 xxx 305', 'Phạm Thu Hà': 'CELTA · 0933 xxx 771', 'Đặng Quốc Bảo': 'IELTS 7.5 · 0968 xxx 412' }

const TODAY = { present: ['green', 'Có mặt'], late: ['amber', 'Đi muộn'] }

// Figma 10.2 — Chi tiết lớp học
export default function ChiTietLop() {
  const { courseId, classId } = useParams()
  const navigate = useNavigate()
  const { notify } = useManager()
  usePageHeader('Chi tiết lớp học', 'Giảng viên, điểm danh và danh sách học viên')
  const course = courseById(courseId)
  const classInfo = findClass(classId)
  const [query, setQuery] = useState('')
  const searchText = norm(query)
  const rows = ROSTER.filter((student) => norm(`${student.name} ${student.id}`).includes(searchText))

  const exportList = () => {
    const header = 'Mã HV,Họ và tên,Chuyên cần T9,Điểm giữa kỳ'
    const studentRows = ROSTER.map((student) => (
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
    { key: 'rate', label: 'Chuyên cần T9', width: '16%' },
    { key: 'score', label: 'Điểm giữa kỳ', width: '14%' },
    { key: 'fee', label: 'Học phí', width: '14%', render: (student) => <Chip tone={student.fee === 'paid' ? 'green' : 'red'}>{student.fee === 'paid' ? 'Đã đóng' : 'Quá hạn'}</Chip> },
  ]

  return (
    <div className="u-page">
      <BackLink to={`/khoahoc/${course.id}`}>{course.name}</BackLink>

      <Card className="kh-head">
        <div className="u-grow">
          <h2>{classInfo.name}</h2>
          <Chip tone={STATUS[classInfo.status].tone}>{STATUS[classInfo.status].label}</Chip>
          <p>Khóa {course.name} · Phòng {classInfo.room} · {classInfo.days}, {classInfo.range}</p>
        </div>
        <Btn variant="soft" onClick={() => navigate('/lichphancong/2026-09-14?slot=17:00-19:00')}>Xem điểm danh</Btn>
        <Btn onClick={() => navigate(`/diemdanh/lop/${classInfo.id}`)}>Xem bảng điểm</Btn>
      </Card>

      <div className="kh-info">
        <Card>
          <h4>Giảng viên &amp; trợ giảng</h4>
          <div className="kh-teacher"><Avatar name={classInfo.teacher} initial="last" size={34} /><div><strong>{classInfo.teacher}</strong><small>Giảng viên chính · {LECTURER_INFO[classInfo.teacher] ?? '—'}</small></div></div>
          <div className="kh-teacher"><Avatar name="Nguyễn Thảo Vy" initial="last" size={34} tone="green" /><div><strong>Nguyễn Thảo Vy</strong><small>Trợ giảng · 0987 xxx 204</small></div></div>
        </Card>
        <Card>
          <h4>Điểm danh hôm nay</h4>
          <Chip tone="green" size="lg">Đã điểm danh</Chip>
          <p className="kh-today">Buổi 11/36 · Thứ 2, 14/09 · {classInfo.range}</p>
          <Progress value={17} max={18} color="var(--success-fill)" large label="Tỉ lệ có mặt" />
          <p className="u-muted" style={{ marginTop: 8, fontSize: 11 }}>Có mặt 16 · Muộn 1 · Vắng 1 · lúc 17:08</p>
        </Card>
        <Card>
          <h4>Thông tin lớp</h4>
          <dl className="u-info">
            <div><dt>Sĩ số</dt><dd>{classInfo.size} / {classInfo.cap}</dd></div>
            <div><dt>Khai giảng</dt><dd>21/08/2026</dd></div>
            <div><dt>Đã học</dt><dd>11 / 36 buổi</dd></div>
            <div><dt>Học phí / khóa</dt><dd>7.200.000đ</dd></div>
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
        <Pager text={`Hiển thị ${rows.length} / ${classInfo.size} học viên`} pages={Math.ceil(classInfo.size / ROSTER.length)} />
      </Card>
    </div>
  )
}
