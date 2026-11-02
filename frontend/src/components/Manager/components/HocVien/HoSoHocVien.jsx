import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { Avatar, BackLink, Btn, Card, CardHead, Chip, InfoGrid, MiniStat } from '../../../../common/ui'
import { usePageHeader } from '../../layout/ManagerContext'
import { ATTENDANCE, findStudent } from './data'

// Figma 09.3 — Hồ sơ học viên. Khi có backend: gọi getStudent(studentId) trong src/api/students.js.
export default function HoSoHocVien() {
  const { studentId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  usePageHeader('Hồ sơ học viên', 'Thông tin cá nhân, liên hệ và tiến độ học tập')
  const s = findStudent(studentId, state?.student)
  const backTo = state?.backTo ?? '/hocvien'

  return (
    <div className="u-page">
      <BackLink to={backTo}>{state?.backLabel ?? 'Học viên'}</BackLink>

      <Card className="hv-profile">
        <Avatar name={s.name} size={56} tone="soft" />
        <div className="u-grow">
          <h2>{s.name}</h2>
          <p>Mã HV: {s.id} · Lớp {s.className}</p>
          <Chip tone={s.status === 'studying' ? 'green' : 'gray'}>{s.status === 'studying' ? 'Đang học' : 'Ngừng học'}</Chip>
        </div>
        <Btn variant="soft" onClick={() => navigate('/hocphi/lich-su', { state: { student: s } })}>Xem lịch sử thanh toán</Btn>
      </Card>

      <div className="u-grid u-grid--2">
        <Card>
          <CardHead title="Thông tin cá nhân" />
          <InfoGrid items={[
            { label: 'Họ và tên', value: s.name }, { label: 'Ngày sinh', value: s.birth || '—' },
            { label: 'Giới tính', value: s.gender }, { label: 'Ngày nhập học', value: s.joined },
            { label: 'Địa chỉ', value: s.address || '—' },
          ]} />
        </Card>
        <Card>
          <CardHead title="Phụ huynh & liên hệ" />
          <InfoGrid cols={1} items={[
            { label: 'Phụ huynh', value: s.parent || '—' }, { label: 'SĐT phụ huynh', value: s.parentPhone || '—' }, { label: 'Email', value: s.email || '—' },
          ]} />
        </Card>
      </div>

      <div className="u-grid u-grid--3">
        <MiniStat label="Chuyên cần tháng 9" value="95%" lg />
        <MiniStat label="Điểm gần nhất (Giữa kỳ)" value="8.5 / 10" lg />
        <MiniStat label="Học phí kỳ này" value="2.400.000đ" lg>
          <Chip tone={s.tuition === 'paid' ? 'green' : 'red'}>{s.tuition === 'paid' ? 'Đã đóng' : 'Quá hạn'}</Chip>
        </MiniStat>
      </div>

      <Card>
        <CardHead title="Lịch sử điểm danh gần đây">
          <div className="att-legend">
            <span><i className="u-dot u-dot--green" />Có mặt</span>
            <span><i className="u-dot u-dot--red" />Vắng</span>
          </div>
        </CardHead>
        <div className="att-grid">
          {ATTENDANCE.map(([d, label, late]) => (
            <div key={d} className={late ? 'att-tile is-late' : 'att-tile'}><b>{d}</b><span>{label}</span></div>
          ))}
        </div>
        <p className="u-faint" style={{ marginTop: 18, fontSize: 11.5 }}>11 buổi gần nhất · Lớp {s.className}</p>
      </Card>
    </div>
  )
}
