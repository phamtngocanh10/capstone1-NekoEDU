import { useState } from 'react'
import { Banknote, CircleCheck, Plus, TrendingUp, TriangleAlert, Users, Wallet } from 'lucide-react'
import { Avatar, Btn, Card, CardHead, FormModal, StatCard } from '../../../../common/ui'
import { todayText, vnd } from '../../../../common/format'
import { useManager } from '../../layout/ManagerContext'
import { lecturerStore } from '../GiangVien/data'

const LEDGER = [
  { id: 1, date: '14/09', title: 'Học phí tháng 9 — KID 1B', amount: 3200000 },
  { id: 2, date: '14/09', title: 'Thanh toán tiền điện nước', amount: -4500000 },
  { id: 3, date: '13/09', title: 'Học phí tháng 9 — KID 2A', amount: 2400000 },
  { id: 4, date: '12/09', title: 'Mua tài liệu & học cụ', amount: -2100000 },
  { id: 5, date: '11/09', title: 'Học phí tháng 9 — KINDY 1A', amount: 2400000 },
  { id: 6, date: '10/09', title: 'Chi phí marketing tuyển sinh', amount: -6000000 },
  { id: 7, date: '09/09', title: 'Học phí tháng 9 — KID 3B', amount: 2800000 },
  { id: 8, date: '08/09', title: 'Bảo trì máy chiếu P.202', amount: -1200000 },
]
const CATEGORIES = ['Học phí', 'Điện nước', 'Lương', 'Marketing', 'Tài liệu & học cụ', 'Bảo trì', 'Khác']
const formatMillions = (amount) => `${amount.toFixed(1)}tr`
const ROLE_NOTE = { lecturer: 'Giảng viên', assistant: 'Trợ giảng' }

// Figma 15.0 (sổ thu chi + bảng lương) và 15.1 (thêm khoản thu / chi)
export default function ThuChi() {
  const { notify } = useManager()
  const lecturers = lecturerStore.use()
  const [ledger, setLedger] = useState(LEDGER)
  const [totals, setTotals] = useState({ income: 612.4, expense: 113.9 })
  const [adding, setAdding] = useState(false)
  const [closed, setClosed] = useState(false)

  const payroll = lecturers.map((lecturer) => ({
    ...lecturer,
    pay: lecturer.monthHours * lecturer.rate,
  }))
  const payTotal = payroll.reduce((total, lecturer) => total + lecturer.pay, 0)

  function addEntry(form) {
    const amount = Number(String(form.amount).replace(/\D/g, '')) || 0
    const isIncome = form.type === 'income'
    const entry = {
      id: Date.now(),
      date: form.date.slice(0, 5),
      title: form.note || form.category,
      amount: isIncome ? amount : -amount,
    }
    setLedger((entries) => [entry, ...entries])
    setTotals((currentTotals) => {
      const field = isIncome ? 'income' : 'expense'
      return { ...currentTotals, [field]: currentTotals[field] + amount / 1e6 }
    })
    setAdding(false)
    notify(`Đã ghi nhận ${isIncome ? 'khoản thu' : 'khoản chi'} ${vnd(amount)}`)
  }

  function closePayroll() {
    setClosed(true)
    notify('Đã chốt lương tháng 9')
  }

  function payrollStatus(lecturer) {
    if (closed) return 'Đã chốt lương'
    if (lecturer.monthHours) return 'Chờ chốt lương'
    return 'Chưa có lớp'
  }

  return (
    <div className="u-page">
      <div className="u-grid u-grid--4">
        <StatCard icon={Banknote} tone="green" accent="green" label="Thu tháng 9" value={formatMillions(totals.income)} delta="+8%" deltaIcon={TrendingUp} />
        <StatCard icon={TriangleAlert} tone="red" accent="red" label="Chi tháng 9" value={formatMillions(totals.expense)} />
        <StatCard icon={Users} tone="blue" accent="blue" label="Lương GV/TG tháng 9" value={formatMillions(payTotal / 1e6)} />
        <StatCard icon={Wallet} tone="amber" accent="amber" label="Lợi nhuận ước tính" value={formatMillions(totals.income - totals.expense)} />
      </div>

      <div className="tc-cols">
        <Card>
          <CardHead title="Sổ thu chi gần đây">
            <Btn size="sm" icon={Plus} onClick={() => setAdding(true)}>Thêm</Btn>
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
          <CardHead title="Bảng lương theo giờ dạy · Tháng 9" />
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
                    <td>{vnd(lecturer.rate)}</td>
                    <td style={{ textAlign: 'right' }}><strong>{vnd(lecturer.pay)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tc-total"><span>Tổng lương tháng 9</span><b>{vnd(payTotal)}</b></div>
          <p className="u-faint" style={{ margin: '6px 0 16px', fontSize: 11 }}>Giờ dạy tự động lấy từ Lịch và điểm danh; mức lương theo giờ đặt trong hồ sơ giảng viên.</p>
          <div className="u-row" style={{ justifyContent: 'flex-end' }}>
            <Btn disabled={closed} onClick={closePayroll}>{closed ? 'Đã chốt lương tháng 9' : 'Chốt lương tháng 9'}</Btn>
          </div>
        </Card>
      </div>

      {adding && (
        <FormModal
          title="Thêm khoản thu / chi"
          subtitle="Ghi nhận khoản thu hoặc chi vào sổ quỹ trung tâm"
          fields={[
            { name: 'type', label: 'Loại khoản', type: 'radio', options: [{ value: 'income', label: 'Khoản thu' }, { value: 'expense', label: 'Khoản chi' }], cols: 2 },
            { name: 'date', label: 'Ngày', type: 'date' },
            { name: 'amount', label: 'Số tiền', icon: Banknote, placeholder: '0đ', required: true },
            { name: 'category', label: 'Danh mục', type: 'select', options: CATEGORIES },
            { name: 'note', label: 'Diễn giải', placeholder: 'VD: Thanh toán tiền điện nước tháng 9', full: true },
            { name: 'proof', label: 'Chứng từ đính kèm', type: 'file', placeholder: 'Kéo thả hóa đơn / biên lai vào đây', hint: 'PDF, JPG, PNG' },
          ]}
          initial={{ type: 'expense', date: todayText(), category: CATEGORIES[1] }}
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
