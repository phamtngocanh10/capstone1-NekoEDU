import { useState } from 'react'
import { Lock, Mail, User } from 'lucide-react'
import { Btn, CheckRow, Chip, Dialog, FormModal, Notice, RadioChips, SelectField } from '../../../../common/ui'
import { TEACHING, lecturerStore } from '../GiangVien/data'
import { LOCK_REASONS, ROLES } from './data'

const classesOf = (account) => {
  const lec = lecturerStore.get().find((l) => l.name === account.name)
  return lec ? (TEACHING[lec.id] ?? []).length : 0
}

// Thêm / sửa tài khoản (Figma không có màn riêng cho form này — dùng chung kiểu form với các modal khác)
export function AccountFormModal({ account, onSubmit, onClose }) {
  const editing = Boolean(account)
  return (
    <FormModal
      title={editing ? 'Sửa tài khoản' : 'Thêm tài khoản'}
      subtitle={editing ? account.email : 'Tạo tài khoản đăng nhập mới cho hệ thống'}
      fields={[
        { name: 'name', label: 'Họ và tên', icon: User, placeholder: 'Nguyễn Văn A', required: true },
        { name: 'email', label: 'Email đăng nhập', icon: Mail, placeholder: 'email@neko.edu.vn', required: true },
        { name: 'role', label: 'Vai trò', type: 'select', icon: User, options: ROLES },
        { name: 'password', label: editing ? 'Mật khẩu mới' : 'Mật khẩu tạm thời', type: 'password', icon: Lock, placeholder: editing ? 'Để trống nếu không đổi' : 'Tối thiểu 6 ký tự', required: !editing },
      ]}
      initial={editing ? { name: account.name, email: account.email, role: account.role } : { role: ROLES[1] }}
      submitLabel={editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}
      cancelVariant="ghost"
      onSubmit={onSubmit}
      onClose={onClose}
    />
  )
}

// Figma 18.3 — Tạm khóa tài khoản
export function LockModal({ account, onConfirm, onClose }) {
  const [reason, setReason] = useState(LOCK_REASONS[0])
  const [period, setPeriod] = useState('forever')
  const [logout, setLogout] = useState(true)
  const [mail, setMail] = useState(true)
  const n = classesOf(account)
  return (
    <Dialog title="Tạm khóa tài khoản" subtitle="Người dùng không thể đăng nhập cho đến khi bạn mở khóa" onClose={onClose}>
      <div className="cm-fields">
        <div className="u-field">
          <span className="u-field__label">Tài khoản</span>
          <div className="u-control"><User size={16} /><span style={{ color: 'var(--text)' }}>{account.name} · {account.email} · {account.role}</span></div>
        </div>
        <SelectField label="Lý do tạm khóa" options={LOCK_REASONS} value={reason} onChange={(e) => setReason(e.target.value)} />
        <RadioChips label="Thời gian tạm khóa" cols={3} value={period} onChange={setPeriod} options={[{ value: 'forever', label: 'Đến khi mở lại' }, { value: '7', label: '7 ngày' }, { value: '30', label: '30 ngày' }]} />
        <CheckRow checked={logout} onChange={setLogout}>Đăng xuất khỏi mọi thiết bị ngay</CheckRow>
        <CheckRow checked={mail} onChange={setMail}>Gửi email thông báo cho người dùng</CheckRow>
        {n > 0 && <Notice tone="amber">Giảng viên đang phụ trách {n} lớp. Lịch và dữ liệu được giữ nguyên; hãy phân công giảng viên khác phụ trách nếu cần.</Notice>}
      </div>
      <div className="u-modal__foot">
        <Btn variant="ghost" size="sq" onClick={onClose}>Hủy</Btn>
        <Btn size="sq" onClick={() => onConfirm({ reason, period, logout, mail })}>Tạm khóa</Btn>
      </div>
    </Dialog>
  )
}

// Figma 18.4 — Xóa tài khoản (phải gõ "XÓA" để xác nhận)
export function DeleteModal({ account, onConfirm, onClose }) {
  const [text, setText] = useState('')
  const n = classesOf(account)
  return (
    <Dialog title="Xóa tài khoản" subtitle="Xóa vĩnh viễn tài khoản khỏi hệ thống" onClose={onClose}>
      <Notice tone="red" title="Xóa tài khoản không thể hoàn tác" className="cm-fields">Người dùng sẽ mất quyền đăng nhập vĩnh viễn.</Notice>
      <div className="pq-sum" style={{ marginTop: 14 }}>
        <div><div><strong>{account.name} · {account.role}</strong><small>{account.email}</small></div></div>
        {n > 0 && <div><div><strong>Lớp đang phụ trách</strong><small>{n} lớp — cần phân công lại trước khi xóa</small></div><Chip tone="red">Cần xử lý</Chip></div>}
        <div><div><strong>Điểm danh và bảng điểm</strong><small>Được giữ lại, hiển thị ẩn danh</small></div><Chip tone="green">Giữ lại</Chip></div>
      </div>
      <label className="u-field__label" htmlFor="confirm-delete">Nhập XÓA để xác nhận</label>
      <input id="confirm-delete" className="pq-confirm" style={{ marginTop: 6 }} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      <div className="u-modal__foot">
        <Btn variant="ghost" size="sq" onClick={onClose}>Hủy</Btn>
        <Btn variant="danger" size="sq" disabled={text.trim().toUpperCase() !== 'XÓA'} onClick={onConfirm}>Xóa tài khoản</Btn>
      </div>
    </Dialog>
  )
}
