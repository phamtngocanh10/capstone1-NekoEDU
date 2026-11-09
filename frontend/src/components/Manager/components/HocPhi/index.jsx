import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, Clock, Download, Receipt, Sparkles, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Btn, Card, Chip, DataTable, Pills, SearchBox, StatCard } from '../../../../common/ui'
import { downloadText, norm, vnd } from '../../../../common/format'
import { useManager } from '../../layout/ManagerContext'
import { FILTERS, STATUS } from './data'
import { getTuition, getTuitionRisks, operationError } from '../../../../api/finance'

// Figma 14.0 — Học phí & công nợ
export default function HocPhi() {
  const navigate = useNavigate()
  const { notify } = useManager()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [feeRows, setFeeRows] = useState([])
  const [stats, setStats] = useState({})
  const [risks, setRisks] = useState([])
  useEffect(() => {
    Promise.all([getTuition(), getTuitionRisks()]).then(([fees, riskData]) => {
      setFeeRows(fees.items); setStats(fees.stats); setRisks(riskData.items)
    }).catch((error) => notify(operationError(error)))
  }, [])
  const searchText = norm(query)
  const rows = feeRows.filter((student) => {
    const matchesStatus = filter === 'all' || student.status === filter
    const matchesSearch = norm(`${student.name} ${student.className} ${student.id} ${student.invoiceCode}`).includes(searchText)
    return matchesStatus && matchesSearch
  })

  function exportReport() {
    const header = 'Học viên,Lớp,Học phí kỳ này,Đã đóng,Còn nợ,Hạn đóng,Trạng thái'
    const reportRows = rows.map((student) => [
      student.name,
      student.className,
      student.fee,
      student.paid,
      student.fee - student.paid,
      student.due,
      STATUS[student.status].label,
    ].join(','))
    downloadText('Bao-cao-hoc-phi.csv', [header, ...reportRows].join('\n'))
    notify('Đã xuất báo cáo học phí (CSV)')
  }

  function viewPaymentHistory(student) {
    navigate('/hocphi/lich-su', { state: { student } })
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
        <StatCard icon={Wallet} tone="green" accent="green" label="Đã thu tháng này" value={vnd(stats.collected ?? 0)} deltaIcon={TrendingUp} />
        <StatCard icon={Receipt} tone="red" accent="red" label="Nợ học phí" value={vnd(stats.debt ?? 0)} badge={<Chip tone="blue" icon={Sparkles}>AI</Chip>} delta={`${stats.debt_count ?? 0} hồ sơ`} deltaTone="red" deltaIcon={TrendingDown} />
        <StatCard icon={Clock} tone="amber" accent="amber" label="Sắp đến hạn (7 ngày)" value={`${stats.soon_count ?? 0} học viên`} />
        <StatCard icon={CircleCheck} tone="blue" accent="blue" label="Đã tất toán" value={`${stats.settled ?? 0}/${stats.invoice_count ?? 0}`} />
      </div>

      <div className="hp-ai">
        <h5>Trợ lý AI · {risks.length} cảnh báo</h5>
        <div className="hp-ai__row">
          <span className="u-iconcircle"><Sparkles size={14} /></span>{risks.length} học viên có cảnh báo học phí
          <Btn variant="soft" size="sm" to="/hocphi/nguy-co">Xem danh sách</Btn>
        </div>
        <div className="hp-ai__row">
          <span className="u-iconcircle"><Sparkles size={14} /></span>Xem thông báo học phí chờ duyệt
          <Btn size="sm" to="/hocphi/duyet-thong-bao">Duyệt gửi</Btn>
        </div>
      </div>

      <div className="u-toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Tìm học viên, mã hóa đơn..." />
        <Pills items={FILTERS} value={filter} onChange={setFilter} />
        <span className="u-grow" />
        <Btn variant="soft" icon={Download} onClick={exportReport}>Xuất báo cáo</Btn>
      </div>

      <Card>
        <DataTable columns={columns} rows={rows} rowKey="invoiceId" onRowClick={viewPaymentHistory} />
      </Card>
    </div>
  )
}
