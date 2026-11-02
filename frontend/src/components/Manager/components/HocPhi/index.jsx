import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, Clock, Download, Receipt, Sparkles, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Btn, Card, Chip, DataTable, Pills, SearchBox, StatCard } from '../../../../common/ui'
import { downloadText, norm, vnd } from '../../../../common/format'
import { useManager } from '../../layout/ManagerContext'
import { FEE_ROWS, FILTERS, STATUS } from './data'

// Figma 14.0 — Học phí & công nợ
export default function HocPhi() {
  const navigate = useNavigate()
  const { notify } = useManager()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const rows = useMemo(() => FEE_ROWS.filter((r) => (filter === 'all' || r.status === filter) && norm(`${r.name} ${r.className} ${r.id}`).includes(norm(query))), [query, filter])

  const exportReport = () => {
    downloadText('Bao-cao-hoc-phi.csv', ['Học viên,Lớp,Học phí kỳ này,Đã đóng,Còn nợ,Hạn đóng,Trạng thái', ...rows.map((r) => [r.name, r.className, r.fee, r.paid, r.fee - r.paid, r.due, STATUS[r.status].label].join(','))].join('\n'))
    notify('Đã xuất báo cáo học phí (CSV)')
  }

  const columns = [
    { key: 'name', label: 'Học viên', width: '17%', render: (r) => <strong>{r.name}</strong> },
    { key: 'className', label: 'Lớp', width: '17%', className: 'u-tight' },
    { key: 'fee', label: 'Học phí kỳ này', width: '15%', render: (r) => vnd(r.fee) },
    { key: 'paid', label: 'Đã đóng', width: '13%', render: (r) => vnd(r.paid) },
    { key: 'debt', label: 'Còn nợ', width: '14%', render: (r) => <strong className={r.fee - r.paid > 0 ? 'u-bad' : ''}>{vnd(r.fee - r.paid)}</strong> },
    { key: 'due', label: 'Hạn đóng', width: '12%' },
    { key: 'status', label: 'Trạng thái', width: '12%', render: (r) => <Chip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Chip> },
  ]

  return (
    <div className="u-page">
      <div className="u-grid u-grid--4">
        <StatCard icon={Wallet} tone="green" accent="green" label="Đã thu tháng 9" value="612.4tr" delta="+8%" deltaIcon={TrendingUp} />
        <StatCard icon={Receipt} tone="red" accent="red" label="Nợ học phí" value="32.6tr" badge={<Chip tone="blue" icon={Sparkles}>AI</Chip>} delta="12 hồ sơ" deltaTone="red" deltaIcon={TrendingDown} />
        <StatCard icon={Clock} tone="amber" accent="amber" label="Sắp đến hạn (7 ngày)" value="18 học viên" />
        <StatCard icon={CircleCheck} tone="blue" accent="blue" label="Đã tất toán tháng 8" value="391/398" />
      </div>

      <div className="hp-ai">
        <h5>Trợ lý AI · 2 đề xuất</h5>
        <div className="hp-ai__row">
          <span className="u-iconcircle"><Sparkles size={14} /></span>5 học viên có nguy cơ chậm đóng học phí tháng 9
          <Btn variant="soft" size="sm" onClick={() => navigate('/hocphi/nguy-co')}>Xem danh sách</Btn>
        </div>
        <div className="hp-ai__row">
          <span className="u-iconcircle"><Sparkles size={14} /></span>Thông báo học phí tháng 10 đã sẵn sàng gửi
          <Btn size="sm" onClick={() => navigate('/hocphi/duyet-thong-bao')}>Duyệt gửi</Btn>
        </div>
      </div>

      <div className="u-toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Tìm học viên, mã hóa đơn..." />
        <Pills items={FILTERS} value={filter} onChange={setFilter} />
        <span className="u-grow" />
        <Btn variant="soft" icon={Download} onClick={exportReport}>Xuất báo cáo</Btn>
      </div>

      <Card>
        <DataTable columns={columns} rows={rows} onRowClick={(r) => navigate('/hocphi/lich-su', { state: { student: r } })} />
      </Card>
    </div>
  )
}
