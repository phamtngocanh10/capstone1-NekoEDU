import { useNavigate } from 'react-router-dom'
import { BackLink, Btn, Card, CardHead, MiniStat } from '../../../../common/ui'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { NOTICE_TEXT } from './data'

// Figma 14.2 — Duyệt thông báo học phí tháng 10
export default function DuyetThongBao() {
  const navigate = useNavigate()
  const { notify } = useManager()
  usePageHeader('Duyệt thông báo học phí tháng 10', 'Xem trước nội dung trước khi gửi tới học viên đang học')

  return (
    <div className="u-page">
      <BackLink to="/hocphi">Học phí</BackLink>
      <div className="hp-tiles">
        <MiniStat label="Người nhận" value="428 học viên đang học" />
        <MiniStat label="Kênh gửi" value="Email + Thông báo trong app" />
        <MiniStat label="Thời điểm gửi" value="08:00, 25/09/2026" />
      </div>
      <Card>
        <CardHead title="Nội dung thông báo (xem trước)" />
        <div className="hp-msg">{NOTICE_TEXT}</div>
      </Card>
      <div className="u-row">
        <Btn variant="soft" size="md" onClick={() => notify('Đã gửi bản xem thử vào email của bạn')}>Gửi thử cho tôi</Btn>
        <Btn size="md" onClick={() => { notify('Đã lên lịch gửi thông báo học phí tháng 10'); navigate('/hocphi') }}>Xác nhận gửi</Btn>
      </div>
    </div>
  )
}
