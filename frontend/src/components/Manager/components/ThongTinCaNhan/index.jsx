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

export default function ThongTinCaNhan({ onSave }) {
  const { user, updateUser, openPasswordModal, notify } = useManager()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone,
    email: user.email,
    address: user.address,
  })
  function updateField(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  const dirty = ['name', 'phone', 'email', 'address'].some((k) => form[k] !== user[k])
  const valid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email)

  const handleSave = async (e) => {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    setError('')
    try {
      // TODO: await updateProfile(form)
      const profile = { ...form, name: form.name.trim() }
      const saved = onSave ? await onSave(profile) : profile
      updateUser(saved)
      setForm((currentForm) => ({
        name: saved.name ?? currentForm.name,
        phone: saved.phone ?? currentForm.phone,
        email: saved.email ?? currentForm.email,
        address: saved.address ?? currentForm.address,
      }))
      notify('Đã lưu thông tin cá nhân')
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? 'Không lưu được thông tin cá nhân.')
    } finally {
      setLoading(false)
    }
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
            <Input label="Họ và tên" icon={User} value={form.name} onChange={(event) => updateField('name', event.target.value)} />
            <Input label="Số điện thoại" icon={Phone} value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
            <Input label="Email" icon={Mail} type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
            <Input label="Vai trò" icon={ShieldCheck} value={user.role} readOnly disabled />
            <div className="form-grid__full">
              <Input label="Địa chỉ" icon={MapPin} value={form.address} onChange={(event) => updateField('address', event.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" disabled={loading || !dirty || !valid}>{loading ? 'Đang lưu...' : 'Lưu thay đổi'}</Button>
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
