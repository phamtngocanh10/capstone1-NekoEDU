import { useState } from 'react'
import { Check, Minus } from 'lucide-react'
import { Btn, Card, Pills } from '../../../../common/ui'
import { useManager } from '../../layout/ManagerContext'
import { DEFAULT_MATRIX, FUNCTIONS, ROLES, accountStore } from './data'

const COLS = ['Xem', 'Thêm', 'Sửa', 'Xóa']
const NEXT = { 0: 2, 2: 1, 1: 0 } // chu kỳ: không → được phép → có điều kiện → không
const clone = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.map((r) => ({ ...r, perms: [...r.perms] }))]))

// Figma 18.6 (Lecturer) + 18.7 (Teaching Assistant) — ma trận quyền theo vai trò
export default function MaTranQuyen() {
  const { notify } = useManager()
  const accounts = accountStore.use()
  const [role, setRole] = useState('Lecturer')
  const [matrix, setMatrix] = useState(() => clone(DEFAULT_MATRIX))
  const rows = matrix[role]
  const toggle = (ri, ci) => setMatrix((m) => ({ ...m, [role]: m[role].map((r, i) => (i === ri ? { ...r, perms: r.perms.map((p, j) => (j === ci ? NEXT[p] : p)) } : r)) }))

  return (
    <>
      <div className="u-toolbar">
        <div className="pq-roles">
          <Pills items={ROLES.map((r) => ({ value: r, label: r }))} value={role} onChange={setRole} />
          <span className="u-faint" style={{ fontSize: 11.5 }}>Áp dụng cho {accounts.filter((a) => a.role === role).length} tài khoản</span>
        </div>
        <span className="u-grow" />
        <Btn variant="ghost" size="md" onClick={() => { setMatrix((m) => ({ ...m, [role]: clone(DEFAULT_MATRIX)[role] })); notify(`Đã khôi phục quyền mặc định của ${role}`) }}>Khôi phục mặc định</Btn>
        <Btn size="md" onClick={() => notify(`Đã lưu phân quyền cho vai trò ${role}`)}>Lưu thay đổi</Btn>
      </div>

      <Card>
        <div className="u-table-wrap">
          <table className="u-table pq-matrix">
            <colgroup><col style={{ width: '24%' }} />{COLS.map((c) => <col key={c} style={{ width: '9%' }} />)}<col /></colgroup>
            <thead><tr><th>Chức năng</th>{COLS.map((c) => <th key={c}>{c}</th>)}<th>Ghi chú</th></tr></thead>
            <tbody>
              {FUNCTIONS.map((fn, ri) => (
                <tr key={fn}>
                  <td>{fn}</td>
                  {rows[ri].perms.map((p, ci) => (
                    <td key={COLS[ci]}>
                      <button type="button" className={p === 2 ? 'pq-box is-on' : p === 1 ? 'pq-box is-cond' : 'pq-box'} aria-label={`${fn} – ${COLS[ci]}: ${p === 2 ? 'được phép' : p === 1 ? 'có điều kiện' : 'không được phép'}`} onClick={() => toggle(ri, ci)}>
                        {p === 2 && <Check size={13} strokeWidth={3} />}{p === 1 && <Minus size={13} strokeWidth={3} />}
                      </button>
                    </td>
                  ))}
                  <td>{rows[ri].note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="pq-legend">
        <span><i className="pq-box is-on"><Check size={11} strokeWidth={3} /></i>Được phép</span>
        <span><i className="pq-box is-cond"><Minus size={11} strokeWidth={3} /></i>Có điều kiện (xem ghi chú)</span>
        <span><i className="pq-box" />Không được phép</span>
      </div>
    </>
  )
}
