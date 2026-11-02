import { useState } from 'react'
import {
  Camera,
  Mail,
  CalendarDays,
  User,
  Phone,
  MapPin,
  KeyRound,
  MonitorSmartphone,
  ShieldCheck,
} from 'lucide-react'
import Button from '../../../../common/Button'
import Input from '../../../../common/Input'
import { initialOf, useManager } from '../../layout/ManagerContext'
// import { updateProfile } from '../../../../api/profile' // bỏ comment khi có backend

export default function ThongTinCaNhan() {
  const { user, updateUser, openPasswordModal, notify } = useManager()
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone,
    email: user.email,
    address: user.address,
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const dirty = ['name', 'phone', 'email', 'address'].some((k) => form[k] !== user[k])
  const valid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email)

  const handleSave = (e) => {
    e.preventDefault()
    if (!valid) return
    // TODO: await updateProfile(form)
    updateUser({ ...form, name: form.name.trim() })
    notify('Đã lưu thông tin cá nhân')
  }

  return (
    <div className="profile">
      <div className="profile__top">
        <section className="card profile-card">
          <div className="profile-card__avatar">
            <span>{initialOf(user.name)}</span>
            <button type="button" aria-label="Đổi ảnh đại diện"><Camera size={13} /></button>
          </div>
          <strong>{user.name}</strong>
          <span className="chip chip--info">{user.role}</span>
          <ul>
            <li><Mail size={14} /> {user.email}</li>
            <li><CalendarDays size={14} /> Tham gia từ {user.joined}</li>
          </ul>
        </section>

        <form className="card" onSubmit={handleSave}>
          <div className="card__head"><h3>Thông tin chung</h3></div>
          <div className="form-grid">
            <Input label="Họ và tên" icon={User} value={form.name} onChange={set('name')} />
            <Input label="Số điện thoại" icon={Phone} value={form.phone} onChange={set('phone')} />
            <Input label="Email" icon={Mail} type="email" value={form.email} onChange={set('email')} />
            <Input label="Vai trò" icon={ShieldCheck} value={user.role} readOnly disabled />
            <div className="form-grid__full">
              <Input label="Địa chỉ" icon={MapPin} value={form.address} onChange={set('address')} />
            </div>
          </div>
          <div className="form-actions">
            <Button type="submit" disabled={!dirty || !valid}>Lưu thay đổi</Button>
          </div>
        </form>
      </div>

      <section className="card">
        <div className="card__head"><h3>Bảo mật tài khoản</h3></div>
        <ul className="sec-list">
          <li>
            <span className="sec__icon"><KeyRound size={16} /></span>
            <div>
              <strong>Mật khẩu</strong>
              <small>Nên đổi định kỳ 90 ngày để bảo vệ tài khoản</small>
            </div>
            <button type="button" className="pill-btn" onClick={openPasswordModal}>
              <KeyRound size={13} /> Đổi mật khẩu
            </button>
          </li>
          <li>
            <span className="sec__icon"><MonitorSmartphone size={16} /></span>
            <div>
              <strong>Phiên đăng nhập hiện tại</strong>
              <small>Chrome trên Windows · Đà Nẵng · Hoạt động bây giờ</small>
            </div>
            <span className="chip chip--success">Đang dùng</span>
          </li>
        </ul>
      </section>
    </div>
  )
}
