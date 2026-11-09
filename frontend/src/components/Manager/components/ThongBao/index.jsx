import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { Avatar, Btn, Card, CardHead, Chip, Dialog, MiniStat, Pills, Progress } from '../../../../common/ui'
import { useManager } from '../../layout/ManagerContext'
import { STATUS } from './data'
import { getAnnouncements, getAnnouncementOptions } from '../../../../api/announcements'
import { operationError } from '../../../../api/finance'

// Figma 16.0 — Thông báo đã tạo + mẫu thông báo nhanh
export default function ThongBao() {
  const navigate = useNavigate()
  const { notify } = useManager()
  const [items, setItems] = useState([])
  const [templates, setTemplates] = useState([])
  const [stats, setStats] = useState({ sentThisMonth: 0, readPercent: 0 })
  useEffect(() => {
    Promise.all([getAnnouncements(), getAnnouncementOptions()]).then(([data, options]) => {
      setItems(data.items); setStats(data.stats); setTemplates(options.templates)
    }).catch((error) => notify(operationError(error)))
  }, [])
  const [filter, setFilter] = useState('all')
  const [preview, setPreview] = useState(null)
  const count = (status) => items.filter((item) => item.status === status).length
  const rows = items.filter((item) => filter === 'all' || item.status === filter)
  const filters = [
    { value: 'all', label: `Tất cả (${items.length})` }, { value: 'sent', label: `Đã gửi (${count('sent')})` },
    { value: 'scheduled', label: `Hẹn giờ (${count('scheduled')})` }, { value: 'draft', label: `Bản nháp (${count('draft')})` },
  ]

  function applyTemplate(template) {
    navigate('/thongbao/soan', { state: { template } })
  }

  function openAnnouncement(id) {
    navigate(`/thongbao/${id}`)
  }

  return (
    <div className="u-page">
      <div className="u-grid u-grid--4">
        <MiniStat label="Đã gửi tháng này" value={stats.sentThisMonth} lg />
        <MiniStat label="Tỉ lệ đã đọc trung bình" value={`${stats.readPercent}%`} lg />
        <MiniStat label="Đang hẹn giờ" value={count('scheduled')} lg />
        <MiniStat label="Bản nháp" value={count('draft')} lg />
      </div>
      <div className="u-toolbar">
        <Pills items={filters} value={filter} onChange={setFilter} />
        <span className="u-grow" />
        <Btn icon={Plus} to="/thongbao/soan">Soạn thông báo mới</Btn>
      </div>

      <div className="tb-cols">
        <Card>
          <CardHead title="Thông báo đã tạo" />
          {rows.length === 0 && <p className="u-faint" style={{ padding: 24, textAlign: 'center' }}>Không có thông báo phù hợp</p>}
          {rows.map((a) => (
            <div
              key={a.id}
              className="tb-item"
              role="button"
              tabIndex={0}
              onClick={() => openAnnouncement(a.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') openAnnouncement(a.id)
              }}
            >
              <span className="tb-item__icon"><FileText size={17} /></span>
              <div className="u-grow"><strong>{a.title}</strong><small>{a.meta}</small></div>
              <div className="tb-item__side">
                <Chip tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Chip>
                {a.read !== null && (<><Progress value={a.read} color="var(--success-fill)" label="Tỉ lệ đã đọc" /><span>{a.read}% đã đọc</span></>)}
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <CardHead title="Mẫu thông báo nhanh" action="Quản lý mẫu" onAction={() => notify('Quản lý mẫu thông báo sẽ có ở phiên bản sau')} />
          {templates.map((t) => (
            <div key={t.id} className="tb-tpl">
              <div className="u-person"><Avatar name={t.letter} size={30} /><div><strong>{t.title}</strong><small>{t.desc}</small></div></div>
              <div className="u-row">
                <Btn size="sm" onClick={() => applyTemplate(t)}>Dùng mẫu</Btn>
                <Btn variant="ghost" size="sm" onClick={() => setPreview(t)}>Xem trước</Btn>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {preview && (
        <Dialog title={preview.title} subtitle="Xem trước mẫu thông báo" onClose={() => setPreview(null)}>
          <div className="hp-msg">{preview.content}</div>
          <div className="u-modal__foot">
            <Btn variant="ghost" size="sq" onClick={() => setPreview(null)}>Đóng</Btn>
            <Btn size="sq" onClick={() => applyTemplate(preview)}>Dùng mẫu</Btn>
          </div>
        </Dialog>
      )}
    </div>
  )
}
