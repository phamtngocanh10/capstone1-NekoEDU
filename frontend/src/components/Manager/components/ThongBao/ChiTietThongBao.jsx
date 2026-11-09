import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { Avatar, BackLink, Btn, Card, CardHead, Chip, DataTable, MiniStat } from '../../../../common/ui'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { STATUS } from './data'
import { getAnnouncement, remindAnnouncement, downloadAnnouncementFile } from '../../../../api/announcements'
import { operationError } from '../../../../api/finance'

// Figma 16.2 — Chi tiết thông báo: người nhận, tỉ lệ đọc, phản hồi
export default function ChiTietThongBao() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notify } = useManager()
  usePageHeader('Chi tiết thông báo', 'Theo dõi người nhận, tỉ lệ đọc và phản hồi')
  const [item, setItem] = useState({ title: '', status: 'draft', audience: '', meta: '', content: '', total: 0, readCount: 0 })
  const [RECIPIENTS, setRecipients] = useState([])
  const [REPLIES, setReplies] = useState([])
  const [files, setFiles] = useState([])
  async function refresh() {
    const data = await getAnnouncement(id)
    setItem(data.item); setRecipients(data.recipients); setReplies(data.replies); setFiles(data.files)
  }
  useEffect(() => { refresh().catch((error) => notify(operationError(error))) }, [id])
  const total = item.total
  const read = item.readCount
  const unread = total - read

  function duplicateAnnouncement() {
    const template = { title: item.title, content: item.content, messageType: item.messageType }
    navigate('/thongbao/soan', { state: { template } })
  }
  async function remindUnread() {
    try { const data = await remindAnnouncement(id); await refresh(); notify(`Đã nhắc ${data.reminded} tài khoản trong ứng dụng; kênh ngoài ứng dụng đang chờ xử lý`) }
    catch (error) { notify(operationError(error)) }
  }

  const columns = [
    { key: 'name', label: 'Học viên', width: '32%', render: (r) => <div className="u-person"><Avatar name={r.name} size={30} tone="soft" /><strong>{r.name}</strong></div> },
    { key: 'className', label: 'Lớp', width: '28%' },
    { key: 'at', label: 'Đọc lúc', width: '18%' },
    { key: 'read', label: 'Trạng thái', width: '22%', render: (r) => <Chip tone={r.read ? 'green' : 'amber'}>{r.read ? 'Đã đọc' : 'Chưa đọc'}</Chip> },
  ]

  return (
    <div className="u-page">
      <BackLink to="/thongbao">Thông báo</BackLink>
      <Card className="ds-head">
        <div className="u-grow">
          <h2>{item.title}</h2>
          <Chip tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Chip>{' '}
          <Chip tone={item.important ? 'red' : 'gray'}>{item.important ? 'Quan trọng' : 'Thường'}</Chip>
          <p>{item.audience} · {item.meta.split(' · ').slice(1).join(' · ')} · Người gửi: {item.sender ?? '—'}</p>
        </div>
        <Btn variant="ghost" onClick={duplicateAnnouncement}>Nhân bản</Btn>
        <Btn disabled={unread === 0} onClick={remindUnread}>Gửi lại cho người chưa đọc ({unread})</Btn>
      </Card>

      <div className="u-grid u-grid--4">
        <MiniStat label="Đã gửi" value={total} lg />
        <MiniStat label="Đã đọc" value={`${read} · ${item.read ?? 0}%`} tone="success" lg />
        <MiniStat label="Chưa đọc" value={unread} tone="danger-text" lg />
        <MiniStat label="Phản hồi từ phụ huynh" value={REPLIES.length} tone="info" lg />
      </div>

      <div className="td-cols">
        <Card>
          <CardHead title={`Người nhận (${total})`} />
          <DataTable columns={columns} rows={RECIPIENTS} chevron={false} />
        </Card>
        <div className="cp-col">
          <Card>
            <CardHead title="Nội dung thông báo" />
            <p className="u-muted" style={{ fontSize: 12.3, lineHeight: 1.7 }}>{item.content}</p>
            {files.map((file) => <div key={file.id} className="cp-file" style={{ marginTop: 14 }}><span className="exp-file__icon"><Paperclip size={14} /></span><div><strong style={{ color: 'var(--primary-2)' }} role="button" tabIndex={0} onClick={() => downloadAnnouncementFile(file).catch((error) => notify(operationError(error)))} onKeyDown={(event) => { if (event.key === 'Enter') downloadAnnouncementFile(file).catch((error) => notify(operationError(error))) }}>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB</small></div></div>)}
          </Card>
          <Card>
            <CardHead title={`Phản hồi từ phụ huynh (${REPLIES.length})`} />
            {REPLIES.map((r) => (
              <div key={r.id} className="td-reply">
                <Avatar name={r.name.split(' ').pop()} size={28} tone="soft" />
                <div className="u-grow"><div className="u-row"><strong>{r.name}</strong><time>{r.at}</time></div><p>{r.text}</p></div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
