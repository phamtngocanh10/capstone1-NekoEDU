import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { BackLink, Btn, Card, DataTable } from '../../../../common/ui'
import { vnd } from '../../../../common/format'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { getTuitionRisks, remindTuitionRisk, operationError } from '../../../../api/finance'

// Figma 14.1 — Học viên nguy cơ chậm học phí
export default function NguyCo() {
  const { notify } = useManager()
  usePageHeader('Học viên nguy cơ chậm học phí', 'Cảnh báo đã lưu dựa trên lịch sử thanh toán và công nợ')
  const [RISKS, setRisks] = useState([])
  const [sent, setSent] = useState(() => new Set())
  async function refresh() {
    const data = await getTuitionRisks()
    setRisks(data.items); setSent(new Set(data.items.filter((r) => r.reminded).map((r) => r.id)))
  }
  useEffect(() => { refresh().catch((error) => notify(operationError(error))) }, [])
  const total = RISKS.reduce((sum, student) => sum + student.debt, 0)

  async function remindStudent(student) {
    try { await remindTuitionRisk(student.id); await refresh(); notify(`Đã gửi nhắc học phí trong ứng dụng cho ${student.name}`) }
    catch (error) { notify(operationError(error)) }
  }

  const columns = [
    { key: 'name', label: 'Học viên', width: '20%', render: (r) => <strong>{r.name}</strong> },
    { key: 'className', label: 'Lớp', width: '18%' },
    { key: 'debt', label: 'Còn nợ', width: '16%', render: (r) => <strong className="u-bad">{vnd(r.debt)}</strong> },
    { key: 'reason', label: 'Lý do AI gắn cờ', width: '30%' },
    {
      key: 'act', label: 'Hành động', width: '16%',
      render: (r) => (
        <Btn variant="soft" size="sm" disabled={sent.has(r.id)} onClick={() => remindStudent(r)}>
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
          <small>Rà soát công nợ và hạn thanh toán của từng hóa đơn</small>
        </div>
      </div>
      <Card><DataTable columns={columns} rows={RISKS} chevron={false} /></Card>
    </div>
  )
}
