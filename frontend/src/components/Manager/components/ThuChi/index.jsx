import { useEffect, useRef, useState } from 'react'
import { Banknote, CircleCheck, Plus, TrendingUp, TriangleAlert, Users, Wallet } from 'lucide-react'
import { Avatar, Btn, Card, CardHead, FormModal, StatCard } from '../../../../common/ui'
import { todayText, vnd } from '../../../../common/format'
import { useManager } from '../../layout/ManagerContext'
import { getLedger, addLedgerEntry, closePayroll as commitPayroll, encodeFiles, sqlDate, operationError } from '../../../../api/finance'

const formatMillions = (amount) => `${amount.toFixed(1)}tr`
const ROLE_NOTE = { lecturer: 'Giảng viên', assistant: 'Trợ giảng' }

// Figma 15.0 (sổ thu chi + bảng lương) và 15.1 (thêm khoản thu / chi)
export default function ThuChi() {
  const { notify } = useManager()
  const [ledger, setLedger] = useState([])
  const [totals, setTotals] = useState({ income: 0, expense: 0 })
  const [payroll, setPayroll] = useState([])
  const [categories, setCategories] = useState([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [adding, setAdding] = useState(false)
  const [closed, setClosed] = useState(false)
  const ledgerRequest = useRef('')
  const submitting = useRef(false)

  async function refresh() {
    const data = await getLedger()
    setLedger(data.items); setTotals(data.totals); setPayroll(data.payroll)
    setCategories(data.categories); setMonth(data.month); setClosed(data.closed)
  }
  useEffect(() => { refresh().catch((error) => notify(operationError(error))) }, [])
  const payTotal = payroll.reduce((total, lecturer) => total + (lecturer.pay ?? 0), 0)

  async function addEntry(form) {
    if (submitting.current) return
    submitting.current = true
    const amount = Number(String(form.amount).replace(/[^\d-]/g, '')) || 0
    const isIncome = form.type === 'income'
    try {
      await addLedgerEntry({ type: form.type, date: sqlDate(form.date), amount,
        request_id: ledgerRequest.current,
        category: form.category, note: form.note, files: await encodeFiles([form.proof]) })
      await refresh()
      setAdding(false)
      notify(`Đã ghi nhận ${isIncome ? 'khoản thu' : 'khoản chi'} ${vnd(amount)}`)
    } catch (error) { notify(operationError(error)) }
    finally { submitting.current = false }
  }

  async function closePayroll() {
    try { await commitPayroll(month); await refresh(); notify(`Đã chốt lương tháng ${month}`) }
    catch (error) { notify(operationError(error)) }
  }

  function payrollStatus(lecturer) {
    if (lecturer.status === 'APPROVED' || lecturer.status === 'PAID') return 'Đã chốt lương'
    if (lecturer.monthHours) return 'Chờ chốt lương'
    return 'Chưa có lớp'
  }

  return (
    <div className="u-page">
      <div className="u-grid u-grid--4">
        <StatCard icon={Banknote} tone="green" accent="green" label={`Thu tháng ${month}`} value={formatMillions(totals.income)} deltaIcon={TrendingUp} />
        <StatCard icon={TriangleAlert} tone="red" accent="red" label={`Chi tháng ${month}`} value={formatMillions(totals.expense)} />
        <StatCard icon={Users} tone="blue" accent="blue" label={`Lương GV/TG tháng ${month}`} value={formatMillions(payTotal / 1e6)} />
        <StatCard icon={Wallet} tone="amber" accent="amber" label="Lợi nhuận ước tính" value={formatMillions(totals.income - totals.expense)} />
      </div>

      <div className="tc-cols">
        <Card>
          <CardHead title="Sổ thu chi gần đây">
            <Btn size="sm" icon={Plus} onClick={() => { ledgerRequest.current = crypto.randomUUID(); setAdding(true) }}>Thêm</Btn>
          </CardHead>
          <div>
            {ledger.map((e) => (
              <div key={e.id} className="tc-entry">
                <time>{e.date}</time>
                <strong>{e.title}</strong>
                <b className={e.amount > 0 ? 'u-good' : 'u-bad'}>{e.amount > 0 ? '+' : '−'}{vnd(Math.abs(e.amount))}</b>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title={`Bảng lương theo giờ dạy · Tháng ${month}`} />
          <div className="u-table-wrap">
            <table className="u-table">
              <colgroup><col style={{ width: '44%' }} /><col style={{ width: '12%' }} /><col style={{ width: '20%' }} /><col /></colgroup>
              <thead><tr><th>Giảng viên / Trợ giảng</th><th>Giờ dạy</th><th>Lương / giờ</th><th style={{ textAlign: 'right' }}>Thành tiền</th></tr></thead>
              <tbody>
                {payroll.map((lecturer) => (
                  <tr key={lecturer.id}>
                    <td>
                      <div className="u-person">
                        <Avatar name={lecturer.name} initial="last" size={28} tone="soft" />
                        <div>
                          <strong>{lecturer.name}</strong>
                          <small>{ROLE_NOTE[lecturer.role]} · {payrollStatus(lecturer)}</small>
                        </div>
                      </div>
                    </td>
                    <td>{lecturer.monthHours}h</td>
                    <td>{lecturer.rate == null ? '—' : vnd(lecturer.rate)}</td>
                    <td style={{ textAlign: 'right' }}><strong>{lecturer.pay == null ? '—' : vnd(lecturer.pay)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tc-total"><span>Tổng lương tháng {month}</span><b>{vnd(payTotal)}</b></div>
          <p className="u-faint" style={{ margin: '6px 0 16px', fontSize: 11 }}>Giờ dạy tự động lấy từ Lịch và điểm danh; mức lương theo giờ đặt trong hồ sơ giảng viên.</p>
          <div className="u-row" style={{ justifyContent: 'flex-end' }}>
            <Btn disabled={closed} onClick={closePayroll}>{closed ? `Đã chốt lương tháng ${month}` : `Chốt lương tháng ${month}`}</Btn>
          </div>
        </Card>
      </div>

      {adding && (
        <FormModal
          title="Thêm khoản thu / chi"
          subtitle="Ghi nhận khoản thu hoặc chi vào sổ quỹ trung tâm"
          fields={(values) => [
            { name: 'type', label: 'Loại khoản', type: 'radio', options: [{ value: 'income', label: 'Khoản thu' }, { value: 'expense', label: 'Khoản chi' }], cols: 2, resets: ['category'] },
            { name: 'date', label: 'Ngày', type: 'date' },
            { name: 'amount', label: 'Số tiền', icon: Banknote, placeholder: '0đ', required: true },
            { name: 'category', label: 'Danh mục', type: 'select', options: categories.filter((c) => c.txn_type === (values.type === 'income' ? 'INCOME' : 'EXPENSE')).map((c) => ({value: String(c.id), label: c.name})), required: true },
            { name: 'note', label: 'Diễn giải', placeholder: 'VD: Thanh toán tiền điện nước tháng 9', full: true },
            { name: 'proof', label: 'Chứng từ đính kèm', type: 'file', placeholder: 'Kéo thả hóa đơn / biên lai vào đây', hint: 'PDF, JPG, PNG' },
          ]}
          initial={{ type: 'expense', date: todayText(), category: String(categories.find((c) => c.txn_type === 'EXPENSE')?.id ?? '') }}
          submitLabel="Lưu khoản"
          submitIcon={CircleCheck}
          cancelVariant="ghost"
          onSubmit={addEntry}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}
