import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { BackLink, Btn, Card, DataTable } from '../../../../common/ui'
import { vnd } from '../../../../common/format'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { RISKS } from './data'

// Figma 14.1 — Học viên nguy cơ chậm học phí
export default function NguyCo() {
  const { notify } = useManager()
  usePageHeader('Học viên nguy cơ chậm học phí', 'Trợ lý AI phát hiện dựa trên lịch sử thanh toán — cần rà soát trước 20/09')
  const [sent, setSent] = useState(() => new Set())
  const total = RISKS.reduce((s, r) => s + r.debt, 0)

  const columns = [
    { key: 'name', label: 'Học viên', width: '20%', render: (r) => <strong>{r.name}</strong> },
    { key: 'className', label: 'Lớp', width: '18%' },
    { key: 'debt', label: 'Còn nợ', width: '16%', render: (r) => <strong className="u-bad">{vnd(r.debt)}</strong> },
    { key: 'reason', label: 'Lý do AI gắn cờ', width: '30%' },
    {
      key: 'act', label: 'Hành động', width: '16%',
      render: (r) => (
        <Btn variant="soft" size="sm" disabled={sent.has(r.id)} onClick={() => { setSent((s) => new Set(s).add(r.id)); notify(`Đã gửi nhắc học phí cho ${r.name}`) }}>
          {sent.has(r.id) ? 'Đã nhắc' : 'Nhắc học phí'}
        </Btn>
      ),
    },
  ]

  return (
    <div className="u-page">
      <BackLink to="/hocphi">Học phí</BackLink>
      <div className="hp-alert">
        <TriangleAlert size={20} />
        <div>
          <strong>{RISKS.length} học viên · tổng công nợ liên quan {vnd(total)}</strong>
          <small>Nên nhắc thanh toán trước hạn học phí tháng 10 (20/10)</small>
        </div>
      </div>
      <Card><DataTable columns={columns} rows={RISKS} chevron={false} /></Card>
    </div>
  )
}
