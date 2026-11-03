import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, BackLink, Btn, Card, CardHead, Chip, DataTable, InfoGrid, MiniStat } from '../../../../common/ui'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { STATUS as CLASS_STATUS } from '../KhoaHoc/data'
import { ROLE_LABEL, STATUS, TEACHING, lecturerStore, money, updateLecturer } from './data'
import LecturerFormModal from './LecturerFormModal'
import AssignClassModal from './AssignClassModal'
import StopTeachingModal from './StopTeachingModal'

// Figma 12.2 (hồ sơ) + 12.3 (sửa) + 12.5 (phân công lớp) + 12.7 (ngừng giảng dạy)
export default function HoSoGiangVien() {
  const { lecturerId } = useParams()
  const navigate = useNavigate()
  const { notify } = useManager()
  const lecturer = lecturerStore.use().find((item) => item.id === lecturerId)
  const [modal, setModal] = useState(null)
  usePageHeader('Hồ sơ giảng viên', 'Thông tin cá nhân, chuyên môn và lớp đang phụ trách')

  if (!lecturer) return <div className="u-page"><BackLink to="/giangvien">Giảng viên</BackLink><Card>Không tìm thấy giảng viên.</Card></div>
  const classes = TEACHING[lecturer.id] ?? []
  const close = () => setModal(null)
  const stopped = lecturer.status === 'stopped'

  function saveProfile(values) {
    updateLecturer(lecturer.id, {
      name: values.fullName,
      birth: values.birth,
      gender: values.gender,
      address: values.address,
      phone: values.phone,
      email: values.email,
      role: values.role,
      specialty: values.specialty,
      contract: values.contract,
      rate: Number(values.rate),
      joined: values.joined,
    })
    close()
    notify('Đã cập nhật hồ sơ giảng viên')
  }

  function assignClass(values) {
    close()
    notify(`Đã phân công ${values.cls.split(' · ')[0]} cho ${lecturer.name}`)
  }

  function stopTeaching() {
    updateLecturer(lecturer.id, { status: 'stopped', hours: 0 })
    close()
    notify(`${lecturer.name} đã ngừng giảng dạy`)
    navigate('/giangvien')
  }

  const columns = [
    { key: 'name', label: 'Lớp học', width: '27%', render: (classItem) => <strong>{classItem.name}</strong> },
    { key: 'room', label: 'Phòng', width: '12%' },
    { key: 'schedule', label: 'Lịch học', width: '27%' },
    { key: 'size', label: 'Sĩ số', width: '10%', render: (classItem) => <strong>{classItem.size}/{classItem.cap}</strong> },
    { key: 'status', label: 'Trạng thái', width: '16%', render: (classItem) => <Chip tone={CLASS_STATUS[classItem.status].tone}>{CLASS_STATUS[classItem.status].label}</Chip> },
  ]

  return (
    <div className="u-page">
      <BackLink to="/giangvien">Giảng viên</BackLink>

      <Card className="hv-profile">
        <Avatar name={lecturer.name} initial="last" size={56} tone="soft" />
        <div className="u-grow">
          <h2>{lecturer.name}</h2>
          <p>Mã GV: {lecturer.id} · {ROLE_LABEL[lecturer.role]} · {lecturer.cert} · {lecturer.contract}</p>
          <Chip tone={STATUS[lecturer.status].tone}>{STATUS[lecturer.status].label}</Chip>
        </div>
        <div className="u-row">
          <Btn variant="soft" onClick={() => setModal('edit')}>Sửa hồ sơ</Btn>
          <Btn disabled={stopped} onClick={() => setModal('assign')}>Phân công lớp</Btn>
          <Btn variant="outline-danger" disabled={stopped} onClick={() => setModal('stop')}>Ngừng giảng dạy</Btn>
        </div>
      </Card>

      <div className="gv-info">
        <Card>
          <CardHead title="Thông tin cá nhân" />
          <InfoGrid items={[
            { label: 'Họ và tên', value: lecturer.name }, { label: 'Ngày sinh', value: lecturer.birth },
            { label: 'Giới tính', value: lecturer.gender }, { label: 'Địa chỉ', value: lecturer.address },
            { label: 'SĐT', value: lecturer.phone }, { label: 'Email', value: lecturer.email },
          ]} />
        </Card>
        <Card>
          <CardHead title="Chuyên môn & hợp đồng" />
          <InfoGrid items={[
            { label: 'Chuyên môn', value: lecturer.specialty }, { label: 'Chứng chỉ', value: lecturer.certificate },
            { label: 'Loại hợp đồng', value: lecturer.contract }, { label: 'Lương theo giờ', value: money(lecturer.rate) },
            { label: 'Ngày vào làm', value: lecturer.joined }, { label: 'Tài khoản', value: lecturer.account },
          ]} />
        </Card>
      </div>

      <div className="u-grid u-grid--4">
        <MiniStat label="Giờ dạy tháng 9" value={`${lecturer.monthHours}h`} lg />
        <MiniStat label="Lớp phụ trách" value={classes.length} lg />
        <MiniStat label="Đánh giá trung bình" value={lecturer.rating} lg />
        <MiniStat label="Điểm danh đúng hạn" value={lecturer.punctual} lg />
      </div>

      <Card>
        <CardHead title={`Lớp đang phụ trách (${classes.length})`} action="Xem lịch dạy →" to={`/giangvien/${lecturer.id}/lich`} />
        <DataTable columns={columns} rows={classes} onRowClick={(classItem) => notify(`Lớp ${classItem.name} — xem chi tiết ở mục Khóa học & Lớp học`)} empty="Chưa phụ trách lớp nào" />
      </Card>

      {modal === 'edit' && (
        <LecturerFormModal
          lecturer={lecturer}
          onClose={close}
          onSubmit={saveProfile}
        />
      )}
      {modal === 'assign' && (
        <AssignClassModal lecturer={lecturer} onClose={close} onSubmit={assignClass} />
      )}
      {modal === 'stop' && (
        <StopTeachingModal lecturer={lecturer} onClose={close} onConfirm={stopTeaching} />
      )}
    </div>
  )
}
