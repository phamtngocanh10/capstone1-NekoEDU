import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CircleCheck, Plus } from 'lucide-react'
import { Avatar, BackLink, Btn, Card, CardHead, Chip, DataTable, FormModal, MiniStat } from '../../../../common/ui'
import { todayText, vnd } from '../../../../common/format'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { INVOICES } from './data'

const STATUS = { paid: ['green', 'Đã đóng'], upcoming: ['gray', 'Chưa đến hạn'] }
const money = (s) => Number(String(s).replace(/\D/g, '')) || 0

// Figma 14.3 (lịch sử thanh toán) + 14.4 (thu tiền học phí)
export default function LichSuThanhToan() {
  const { state } = useLocation()
  const { notify } = useManager()
  usePageHeader('Lịch sử thanh toán', 'Hóa đơn và các lần thanh toán của học viên')
  const student = state?.student ?? { name: 'Nguyễn Minh Anh', id: 'HV20260142', className: 'KID 2A' }
  const [invoices, setInvoices] = useState(INVOICES)
  const [collecting, setCollecting] = useState(false)
  const unpaid = invoices.filter((invoice) => invoice.status !== 'paid')
  const totalPaid = invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((total, invoice) => total + invoice.amount, 0)

  function collectPayment(form) {
    setInvoices((currentInvoices) => currentInvoices.map((invoice) => {
      if (invoice.id !== form.invoice) return invoice
      return { ...invoice, status: 'paid', paidAt: form.date, method: form.method }
    }))
    setCollecting(false)
    notify(`Đã ghi nhận thu ${vnd(money(form.amount))} của ${student.name}`)
  }

  const columns = [
    { key: 'id', label: 'Mã hóa đơn', width: '17%', render: (i) => <strong>{i.id}</strong> },
    { key: 'item', label: 'Khoản thu', width: '22%', className: 'u-tight' },
    { key: 'amount', label: 'Số tiền', width: '13%', render: (i) => <strong>{vnd(i.amount)}</strong> },
    { key: 'due', label: 'Hạn đóng', width: '12%' },
    { key: 'paidAt', label: 'Ngày đóng', width: '12%' },
    { key: 'method', label: 'Hình thức', width: '12%' },
    { key: 'status', label: 'Trạng thái', width: '12%', render: (i) => <Chip tone={STATUS[i.status][0]}>{STATUS[i.status][1]}</Chip> },
  ]

  return (
    <div className="u-page">
      <BackLink to={`/hocvien/${student.id.replace(/b$/, '')}`}>{student.name}</BackLink>
      <Card className="hv-profile">
        <Avatar name={student.name} size={56} tone="soft" />
        <div className="u-grow">
          <h2>{student.name}</h2>
          <p>Mã HV: {student.id.replace(/b$/, '')} · Lớp {student.className} · Nhập học 21/08/2026</p>
          <Chip tone={unpaid.some((i) => i.status === 'overdue') ? 'red' : 'green'}>Đã thanh toán</Chip>
        </div>
        <Btn variant="ghost" onClick={() => window.print()}>In biên lai</Btn>
        <Btn icon={Plus} onClick={() => setCollecting(true)}>Thu tiền / tạo hóa đơn</Btn>
      </Card>

      <div className="u-grid u-grid--4">
        <MiniStat label="Tổng đã đóng" value={vnd(totalPaid)} tone="success" lg />
        <MiniStat label="Còn nợ" value="0đ" lg />
        <MiniStat label="Kỳ học phí tiếp theo" value="20/11/2026" lg />
        <MiniStat label="Hình thức thường dùng" value="Chuyển khoản" lg />
      </div>

      <Card>
        <CardHead title="Hóa đơn và thanh toán" />
        <DataTable columns={columns} rows={invoices} chevron={false} />
        <p className="u-faint" style={{ marginTop: 14, fontSize: 11.5 }}>Nhấn vào hóa đơn để xem chi tiết hoặc in biên lai</p>
      </Card>

      {collecting && (
        <FormModal
          title="Thu tiền học phí"
          subtitle={`Ghi nhận thanh toán cho học viên ${student.name}`}
          fields={[
            { name: 'invoice', label: 'Khoản cần thu', type: 'select', full: true, options: unpaid.map((i) => ({ value: i.id, label: `${i.id} · ${i.item.split(' · ')[0]} · ${vnd(i.amount)}` })), required: true },
            { name: 'amount', label: 'Số tiền thu', placeholder: '0đ', required: true },
            { name: 'date', label: 'Ngày thu', type: 'date' },
            { name: 'method', label: 'Hình thức thanh toán', type: 'radio', full: true, options: ['Tiền mặt', 'Chuyển khoản', 'Thẻ'], cols: 3 },
            { name: 'proof', type: 'file', placeholder: 'Kéo thả file vào đây', hint: 'Ảnh chuyển khoản / chứng từ (không bắt buộc)' },
            { name: 'receipt', type: 'check', label: 'In biên lai và gửi cho phụ huynh' },
          ]}
          initial={{ invoice: unpaid[0]?.id ?? '', amount: unpaid[0] ? vnd(unpaid[0].amount) : '', date: todayText(), method: 'Chuyển khoản', receipt: true }}
          submitLabel="Xác nhận thu"
          submitIcon={CircleCheck}
          cancelVariant="ghost"
          onSubmit={collectPayment}
          onClose={() => setCollecting(false)}
        />
      )}
    </div>
  )
}
