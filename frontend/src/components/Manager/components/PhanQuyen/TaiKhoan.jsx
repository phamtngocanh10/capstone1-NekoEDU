import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Avatar, Btn, Card, Chip, DataTable, MiniStat, Pills } from '../../../../common/ui'
import { useManager } from '../../layout/ManagerContext'
import { ROLES, ROLE_TONE, accountStore, patchAccount } from './data'
import { AccountFormModal, DeleteModal, LockModal } from './AccountModals'

// Figma 18.0 — danh sách tài khoản (+ 18.3 tạm khóa, 18.4 xóa)
export default function TaiKhoan() {
  const { notify } = useManager()
  const accounts = accountStore.use()
  const [role, setRole] = useState('all')
  const [modal, setModal] = useState(null) // { type: 'add' | 'edit' | 'lock' | 'delete', account? }
  const rows = useMemo(() => accounts.filter((a) => role === 'all' || a.role === role), [accounts, role])
  const filters = [{ value: 'all', label: `Tất cả (${accounts.length})` }, ...ROLES.map((r) => ({ value: r, label: `${r} (${accounts.filter((a) => a.role === r).length})` }))]
  const close = () => setModal(null)

  const save = (v) => {
    if (modal.type === 'edit') { patchAccount(modal.account.id, { name: v.name, email: v.email, role: v.role }); notify('Đã cập nhật tài khoản') }
    else { accountStore.set((l) => [...l, { id: `a${Date.now()}`, name: v.name, email: v.email, role: v.role, status: 'active', last: 'Chưa đăng nhập' }]); notify(`Đã tạo tài khoản ${v.email}`) }
    close()
  }

  const columns = [
    { key: 'name', label: 'Tài khoản', width: '30%', render: (a) => <div className="u-person"><Avatar name={a.name} initial="last" size={32} tone="soft" /><div><strong>{a.name}</strong><small>{a.email}</small></div></div> },
    { key: 'role', label: 'Vai trò', width: '17%', render: (a) => <Chip tone={ROLE_TONE[a.role]}>{a.role}</Chip> },
    { key: 'status', label: 'Trạng thái', width: '13%', render: (a) => <span className={`pq-state is-${a.status}`}><i />{a.status === 'active' ? 'Hoạt động' : 'Tạm khóa'}</span> },
    { key: 'last', label: 'Đăng nhập gần nhất', width: '16%', className: 'u-tight' },
    {
      key: 'actions', label: 'Thao tác', width: '24%',
      render: (a) => (
        <div className="pq-acts">
          {a.self && <Chip>Tài khoản của bạn</Chip>}
          <Btn variant="soft" size="sm" onClick={() => setModal({ type: 'edit', account: a })}>Sửa</Btn>
          {!a.self && (a.status === 'active'
            ? <Btn variant="ghost" size="sm" onClick={() => setModal({ type: 'lock', account: a })}>Tạm khóa</Btn>
            : <Btn variant="soft" size="sm" onClick={() => { patchAccount(a.id, { status: 'active' }); notify(`Đã mở khóa ${a.name}`) }}>Mở khóa</Btn>)}
          {!a.self && <Btn variant="outline-danger" size="sm" onClick={() => setModal({ type: 'delete', account: a })}>Xóa</Btn>}
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="u-grid u-grid--4">
        <MiniStat label="Tổng tài khoản" value={accounts.length} accent="var(--primary)" lg />
        <MiniStat label="Đang hoạt động" value={accounts.filter((a) => a.status === 'active').length} accent="var(--success-fill)" lg />
        <MiniStat label="Tạm khóa" value={accounts.filter((a) => a.status === 'locked').length} accent="var(--warning-fill)" lg />
        <MiniStat label="Đăng nhập hôm nay" value={6} accent="#1a6fc9" lg />
      </div>
      <div className="u-toolbar">
        <Pills items={filters} value={role} onChange={setRole} />
        <span className="u-grow" />
        <Btn icon={Plus} onClick={() => setModal({ type: 'add' })}>Thêm tài khoản</Btn>
      </div>
      <Card><DataTable columns={columns} rows={rows} chevron={false} /></Card>

      {(modal?.type === 'add' || modal?.type === 'edit') && <AccountFormModal account={modal.account} onSubmit={save} onClose={close} />}
      {modal?.type === 'lock' && <LockModal account={modal.account} onClose={close} onConfirm={() => { patchAccount(modal.account.id, { status: 'locked' }); close(); notify(`Đã tạm khóa ${modal.account.name}`) }} />}
      {modal?.type === 'delete' && <DeleteModal account={modal.account} onClose={close} onConfirm={() => { accountStore.set((l) => l.filter((a) => a.id !== modal.account.id)); close(); notify(`Đã xóa tài khoản ${modal.account.name}`) }} />}
    </>
  )
}
