import { useState } from 'react'
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
  const rows = accounts.filter((account) => role === 'all' || account.role === role)
  const filters = [
    { value: 'all', label: `Tất cả (${accounts.length})` },
    ...ROLES.map((roleName) => ({
      value: roleName,
      label: `${roleName} (${accounts.filter((account) => account.role === roleName).length})`,
    })),
  ]
  const close = () => setModal(null)

  function saveAccount(form) {
    const accountInfo = { name: form.name, email: form.email, role: form.role }
    if (modal.type === 'edit') {
      patchAccount(modal.account.id, accountInfo)
      notify('Đã cập nhật tài khoản')
    } else {
      const account = {
        id: `a${Date.now()}`,
        ...accountInfo,
        status: 'active',
        last: 'Chưa đăng nhập',
      }
      accountStore.set((currentAccounts) => [...currentAccounts, account])
      notify(`Đã tạo tài khoản ${form.email}`)
    }
    close()
  }

  function unlockAccount(account) {
    patchAccount(account.id, { status: 'active' })
    notify(`Đã mở khóa ${account.name}`)
  }

  function lockAccount() {
    patchAccount(modal.account.id, { status: 'locked' })
    close()
    notify(`Đã tạm khóa ${modal.account.name}`)
  }

  function deleteAccount() {
    accountStore.set((currentAccounts) => currentAccounts.filter((account) => account.id !== modal.account.id))
    close()
    notify(`Đã xóa tài khoản ${modal.account.name}`)
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
            : <Btn variant="soft" size="sm" onClick={() => unlockAccount(a)}>Mở khóa</Btn>)}
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

      {(modal?.type === 'add' || modal?.type === 'edit') && <AccountFormModal account={modal.account} onSubmit={saveAccount} onClose={close} />}
      {modal?.type === 'lock' && <LockModal account={modal.account} onClose={close} onConfirm={lockAccount} />}
      {modal?.type === 'delete' && <DeleteModal account={modal.account} onClose={close} onConfirm={deleteAccount} />}
    </>
  )
}
