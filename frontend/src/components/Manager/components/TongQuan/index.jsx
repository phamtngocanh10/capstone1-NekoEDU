import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, ChevronRight, ClipboardList, CreditCard, MessageSquare, Sparkles,
  TrendingDown, TrendingUp, TriangleAlert, Upload, UserCheck,
} from 'lucide-react'
import { Avatar, Card, CardHead, Chip, DataTable, StatCard } from '../../../../common/ui'
import { useManager } from '../../layout/ManagerContext'
import { RECENT, REQUESTS, TODAY_CLASSES } from './data'

const RECENT_ICONS = { fee: CreditCard, upload: Upload, student: UserCheck, chat: MessageSquare }

const CLASS_COLUMNS = [
  { key: 'name', label: 'Lớp học', width: '24%', render: (r) => <strong>{r.name}</strong> },
  { key: 'teacher', label: 'Giảng viên', width: '19%' },
  { key: 'room', label: 'Phòng', width: '8%' },
  { key: 'time', label: 'Giờ', width: '17%' },
  { key: 'size', label: 'Sĩ số', width: '8%' },
  {
    key: 'done',
    label: 'Điểm danh',
    width: '24%',
    render: (r) => <Chip tone={r.done ? 'green' : 'amber'}>{r.done ? 'Đã điểm danh' : 'Chưa điểm danh'}</Chip>,
  },
]

export default function TongQuan() {
  const navigate = useNavigate()
  const { notify } = useManager()

  return (
    <div className="u-page">
      <div className="u-grid u-grid--4">
        <StatCard icon={UserCheck} label="Học viên đang học" value="428" delta="+12" deltaIcon={TrendingUp} />
        <StatCard icon={CalendarDays} tone="blue" accent="blue" label="Lớp học hôm nay" value={`${TODAY_CLASSES.length} lớp`} />
        <StatCard
          icon={TriangleAlert}
          tone="red"
          accent="red"
          label="Học phí quá hạn"
          value="32.6tr"
          badge={<Chip tone="blue" icon={Sparkles}>AI</Chip>}
          delta="12 hồ sơ"
          deltaTone="red"
          deltaIcon={TrendingDown}
        />
        <StatCard icon={ClipboardList} tone="amber" accent="amber" label="Đơn từ chờ duyệt" value="7 đơn" />
      </div>

      <div className="dash-ai">
        <span className="dash-ai__icon"><Sparkles size={16} /></span>
        <div>
          <strong>Trợ lý AI: phát hiện 5 học viên có nguy cơ chậm đóng học phí tháng 9</strong>
          <small>Dựa trên lịch sử thanh toán và công nợ hiện tại — cần rà soát trước ngày 20/09</small>
        </div>
        <button type="button" className="u-link dash-ai__link" onClick={() => navigate('/hocphi/nguy-co')}>
          Xem chi tiết <ChevronRight size={15} />
        </button>
      </div>

      <div className="dash-cols">
        <Card>
          <CardHead title="Lớp học hôm nay" action="Xem lịch đầy đủ" to="/lichphancong" />
          <DataTable columns={CLASS_COLUMNS} rows={TODAY_CLASSES} chevron={false} maxHeight={290} />
        </Card>

        <div className="dash-side">
          <Card>
            <CardHead title="Đơn từ chờ duyệt" action="Xem tất cả" onAction={() => notify('Màn hình Đơn từ chưa có trong thiết kế Figma')} />
            <ul className="u-list u-scroll-y" style={{ maxHeight: 220 }}>
              {REQUESTS.map((r) => (
                <li key={r.id}>
                  <Avatar name={r.name} tone="soft" />
                  <strong className="u-grow">{r.name}</strong>
                  <Chip tone="green">{r.status}</Chip>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHead title="Thông báo gần đây" />
            <ul className="u-list u-scroll-y" style={{ maxHeight: 260 }}>
              {RECENT.map((n) => {
                const Icon = RECENT_ICONS[n.icon]
                return (
                  <li key={n.id}>
                    <span className="u-iconcircle"><Icon size={14} /></span>
                    <div>
                      <strong>{n.text}</strong>
                      <small>{n.time}</small>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
