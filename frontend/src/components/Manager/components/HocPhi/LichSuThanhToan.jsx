import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { CircleCheck, Plus } from 'lucide-react'
import { Avatar, BackLink, Btn, Card, CardHead, Chip, DataTable, FormModal, MiniStat } from '../../../../common/ui'
import { todayText, vnd } from '../../../../common/format'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { getPayments, collectPayment as savePayment, encodeFiles, sqlDate, operationError } from '../../../../api/finance'

const STATUS = { paid: ['green', 'Đã đóng'], upcoming: ['gray', 'Chưa đến hạn'], overdue: ['red', 'Quá hạn'] }
const money = (s) => Number(String(s).replace(/[^\d-]/g, '')) || 0

// Figma 14.3 (lịch sử thanh toán) + 14.4 (thu tiền học phí)
export default function LichSuThanhToan() {
  const { state } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { notify } = useManager()
  usePageHeader('Lịch sử thanh toán', 'Hóa đơn và các lần thanh toán của học viên')
  const [student, setStudent] = useState(state?.student ?? { name: '—', id: searchParams.get('student') ?? '', className: '—', joined: '—' })
  const studentCode = state?.student?.id ?? searchParams.get('student')
  const [invoices, setInvoices] = useState([])
  const [collecting, setCollecting] = useState(false)
  const paymentRequest = useRef('')
  const submitting = useRef(false)
  const unpaid = invoices.filter((invoice) => invoice.status !== 'paid')
  const totalPaid = invoices.reduce((total, invoice) => total + invoice.paid, 0)
  const debt = invoices.reduce((total, invoice) => total + invoice.balance, 0)
  async function refresh() {
    if (!studentCode) return
    const data = await getPayments(studentCode)
    setInvoices(data.items); setStudent(data.student)
  }
  useEffect(() => {
    if (studentCode) { setSearchParams({ student: studentCode }, { replace: true }); refresh().catch((error) => notify(operationError(error))) }
  }, [studentCode])

  async function collectPayment(form) {
    if (submitting.current) return
    submitting.current = true
    try {
      const recorded = await savePayment({ invoice: form.invoice, amount: money(form.amount), date: sqlDate(form.date),
        request_id: paymentRequest.current,
        method: { 'Tiền mặt': 'CASH', 'Chuyển khoản': 'BANK_TRANSFER', 'VNPAY': 'VNPAY' }[form.method],
        files: await encodeFiles([form.proof]), receipt: Boolean(form.receipt) })
      await refresh(); setCollecting(false)
      notify(`Đã ghi nhận thu ${vnd(money(form.amount))} của ${student.name} · ${recorded.receipt_no}`)
      if (form.receipt) setTimeout(() => window.print(), 0)
    } catch (error) { notify(operationError(error)) }
    finally { submitting.current = false }
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
      <BackLink to={`/hocvien/${student.id}`}>{student.name}</BackLink>
      <Card className="hv-profile">
        <Avatar name={student.name} size={56} tone="soft" />
        <div className="u-grow">
          <h2>{student.name}</h2>
          <p>Mã HV: {student.id} · Lớp {student.className} · Nhập học {student.joined ?? '—'}</p>
          <Chip tone={debt > 0 ? 'red' : 'green'}>{debt > 0 ? 'Còn công nợ' : 'Đã thanh toán'}</Chip>
        </div>
        <Btn variant="ghost" onClick={() => window.print()}>In biên lai</Btn>
        <Btn icon={Plus} disabled={!unpaid.length} onClick={() => { paymentRequest.current = crypto.randomUUID(); setCollecting(true) }}>Thu tiền / tạo hóa đơn</Btn>
      </Card>

      <div className="u-grid u-grid--4">
        <MiniStat label="Tổng đã đóng" value={vnd(totalPaid)} tone="success" lg />
        <MiniStat label="Còn nợ" value={vnd(debt)} lg />
        <MiniStat label="Kỳ học phí tiếp theo" value={unpaid[0]?.due ?? '—'} lg />
        <MiniStat label="Hình thức thường dùng" value={invoices.find((i) => i.method !== '—')?.method ?? '—'} lg />
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
            { name: 'invoice', label: 'Khoản cần thu', type: 'select', full: true, options: unpaid.map((i) => ({ value: i.id, label: `${i.id} · ${i.item.split(' · ')[0]} · ${vnd(i.balance)}` })), required: true, resets: ['amount'] },
            { name: 'amount', label: 'Số tiền thu', placeholder: '0đ', required: true },
            { name: 'date', label: 'Ngày thu', type: 'date' },
            { name: 'method', label: 'Hình thức thanh toán', type: 'radio', full: true, options: ['Tiền mặt', 'Chuyển khoản', 'VNPAY'], cols: 3 },
            { name: 'proof', type: 'file', placeholder: 'Kéo thả file vào đây', hint: 'Ảnh chuyển khoản / chứng từ (không bắt buộc)' },
            { name: 'receipt', type: 'check', label: 'In biên lai thanh toán' },
          ]}
          initial={{ invoice: unpaid[0]?.id ?? '', amount: unpaid[0] ? vnd(unpaid[0].balance) : '', date: todayText(), method: 'Chuyển khoản', receipt: true }}
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
