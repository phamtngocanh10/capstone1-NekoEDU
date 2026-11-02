import { useNavigate, useParams } from 'react-router-dom'
import { Paperclip } from 'lucide-react'
import { Avatar, BackLink, Btn, Card, CardHead, Chip, DataTable, MiniStat } from '../../../../common/ui'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { DETAIL_TEXT, RECIPIENTS, REPLIES, STATUS, announceStore } from './data'

// Figma 16.2 — Chi tiết thông báo: người nhận, tỉ lệ đọc, phản hồi
export default function ChiTietThongBao() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notify } = useManager()
  usePageHeader('Chi tiết thông báo', 'Theo dõi người nhận, tỉ lệ đọc và phản hồi')
  const item = announceStore.use().find((a) => a.id === id) ?? announceStore.get()[3]
  const total = 23
  const read = Math.round((total * (item.read ?? 0)) / 100)

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
          <Chip tone="red">Quan trọng</Chip>
          <p>{item.audience} · {item.meta.split(' · ').slice(1).join(' · ')} · Người gửi: Ngọc Anh (Manager)</p>
        </div>
        <Btn variant="ghost" onClick={() => navigate('/thongbao/soan', { state: { template: { title: item.title, content: DETAIL_TEXT } } })}>Nhân bản</Btn>
        <Btn disabled={total - read === 0} onClick={() => notify(`Đã gửi lại cho ${total - read} người chưa đọc`)}>Gửi lại cho người chưa đọc ({total - read})</Btn>
      </Card>

      <div className="u-grid u-grid--4">
        <MiniStat label="Đã gửi" value={total} lg />
        <MiniStat label="Đã đọc" value={`${read} · ${item.read ?? 0}%`} tone="success" lg />
        <MiniStat label="Chưa đọc" value={total - read} tone="danger-text" lg />
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
            <p className="u-muted" style={{ fontSize: 12.3, lineHeight: 1.7 }}>{DETAIL_TEXT}</p>
            <div className="cp-file" style={{ marginTop: 14 }}><span className="exp-file__icon"><Paperclip size={14} /></span><div><strong style={{ color: 'var(--primary-2)' }}>Huong-dan-thanh-toan.pdf</strong><small>312 KB</small></div></div>
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
