import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { BackLink, Btn, Card, CardHead, MiniStat } from '../../../../common/ui'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { getAnnouncements, getAnnouncement, sendAnnouncement, previewAnnouncement } from '../../../../api/announcements'
import { operationError } from '../../../../api/finance'

// Figma 14.2 — Duyệt thông báo học phí tháng 10
export default function DuyetThongBao() {
  const navigate = useNavigate()
  const { notify } = useManager()
  const [notice, setNotice] = useState(null)
  useEffect(() => {
    getAnnouncements().then(async (data) => {
      const item = data.items.find((a) => a.messageType === 'TUITION' && ['draft', 'scheduled'].includes(a.status))
      if (item) setNotice((await getAnnouncement(item.id)).item)
    }).catch((error) => notify(operationError(error)))
  }, [])
  usePageHeader('Duyệt thông báo học phí', 'Xem trước nội dung trước khi gửi tới học viên đang học')

  async function confirmSend() {
    if (!notice) return notify('Chưa có thông báo học phí chờ duyệt')
    try { await sendAnnouncement(notice.id); notify('Đã phát hành thông báo trong ứng dụng; các kênh ngoài ứng dụng được lưu vào hàng đợi'); navigate('/hocphi') }
    catch (error) { notify(operationError(error)) }
  }
  async function sendPreview() {
    if (!notice) return notify('Chưa có thông báo để xem thử')
    try { await previewAnnouncement(notice.id); notify('Đã lưu bản xem thử trong thông báo tài khoản của bạn') }
    catch (error) { notify(operationError(error)) }
  }

  return (
    <div className="u-page">
      <BackLink to="/hocphi">Học phí</BackLink>
      <div className="hp-tiles">
        <MiniStat label="Người nhận" value={notice?.audience ?? '—'} />
        <MiniStat label="Kênh gửi" value="Thông báo trong app / hàng đợi đã chọn" />
        <MiniStat label="Thời điểm gửi" value={notice?.scheduledAt ?? '—'} />
      </div>
      <Card>
        <CardHead title="Nội dung thông báo (xem trước)" />
        <div className="hp-msg">{notice?.content ?? 'Chưa có thông báo học phí chờ duyệt.'}</div>
      </Card>
      <div className="u-row">
        <Btn variant="soft" size="md" onClick={sendPreview}>Gửi thử cho tôi</Btn>
        <Btn size="md" onClick={confirmSend}>Xác nhận gửi</Btn>
      </div>
    </div>
  )
}
