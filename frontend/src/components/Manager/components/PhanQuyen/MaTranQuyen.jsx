import { useState } from 'react'
import { Check, Minus } from 'lucide-react'
import { Btn, Card, Pills } from '../../../../common/ui'
import { useManager } from '../../layout/ManagerContext'
import { DEFAULT_MATRIX, FUNCTIONS, ROLES, accountStore } from './data'

const COLS = ['Xem', 'Thêm', 'Sửa', 'Xóa']
const NEXT = { 0: 2, 2: 1, 1: 0 } // chu kỳ: không → được phép → có điều kiện → không
const PERMISSION_STATES = [
  { className: 'pq-box', label: 'không được phép' },
  { className: 'pq-box is-cond', label: 'có điều kiện' },
  { className: 'pq-box is-on', label: 'được phép' },
]

function cloneMatrix(matrix) {
  const copy = {}
  for (const [role, rows] of Object.entries(matrix)) {
    copy[role] = rows.map((row) => ({ ...row, perms: [...row.perms] }))
  }
  return copy
}

// Figma 18.6 (Lecturer) + 18.7 (Teaching Assistant) — ma trận quyền theo vai trò
export default function MaTranQuyen() {
  const { notify } = useManager()
  const accounts = accountStore.use()
  const [role, setRole] = useState('Lecturer')
  const [matrix, setMatrix] = useState(() => cloneMatrix(DEFAULT_MATRIX))
  const rows = matrix[role]

  function togglePermission(rowIndex, columnIndex) {
    setMatrix((currentMatrix) => {
      const nextRows = currentMatrix[role].map((row, index) => {
        if (index !== rowIndex) return row
        const permissions = [...row.perms]
        permissions[columnIndex] = NEXT[permissions[columnIndex]]
        return { ...row, perms: permissions }
      })
      return { ...currentMatrix, [role]: nextRows }
    })
  }

  function restoreDefaults() {
    setMatrix((currentMatrix) => ({
      ...currentMatrix,
      [role]: cloneMatrix(DEFAULT_MATRIX)[role],
    }))
    notify(`Đã khôi phục quyền mặc định của ${role}`)
  }

  return (
    <>
      <div className="u-toolbar">
        <div className="pq-roles">
          <Pills items={ROLES.map((r) => ({ value: r, label: r }))} value={role} onChange={setRole} />
          <span className="u-faint" style={{ fontSize: 11.5 }}>Áp dụng cho {accounts.filter((a) => a.role === role).length} tài khoản</span>
        </div>
        <span className="u-grow" />
        <Btn variant="ghost" size="md" onClick={restoreDefaults}>Khôi phục mặc định</Btn>
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
                  {rows[ri].perms.map((permission, columnIndex) => {
                    const state = PERMISSION_STATES[permission]
                    return (
                      <td key={COLS[columnIndex]}>
                        <button
                          type="button"
                          className={state.className}
                          aria-label={`${fn} – ${COLS[columnIndex]}: ${state.label}`}
                          onClick={() => togglePermission(ri, columnIndex)}
                        >
                          {permission === 2 && <Check size={13} strokeWidth={3} />}
                          {permission === 1 && <Minus size={13} strokeWidth={3} />}
                        </button>
                      </td>
                    )
                  })}
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
