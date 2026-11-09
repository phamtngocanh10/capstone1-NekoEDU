import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, CircleCheck, CircleAlert } from 'lucide-react'
import Modal from '../../../../common/Modal'
import Button from '../../../../common/Button'
import { useManager } from '../../layout/ManagerContext'
import { changePassword } from '../../../../api/auth'

// Điểm độ mạnh 0–4: độ dài >= 8, hoa+thường, số, ký tự đặc biệt.
function passwordStrength(password) {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return Math.max(score, 1)
}
const LEVELS = [
  null,
  { label: 'Yếu', tone: 'danger' },
  { label: 'Trung bình', tone: 'warning' },
  { label: 'Khá mạnh', tone: 'warning' },
  { label: 'Mạnh', tone: 'success' },
]

function PasswordField({ label, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="field__box">
        <Lock size={16} />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="field__eye"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
    </label>
  )
}

export default function ChangePasswordModal({ onClose, onChangePassword }) {
  const navigate = useNavigate()
  const { notify } = useManager()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const score = passwordStrength(next)
  const level = LEVELS[score]
  let matchState = null
  if (confirm) matchState = confirm === next ? 'ok' : 'bad'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!current) return setError('Vui lòng nhập mật khẩu hiện tại.')
    if (next.length < 8) return setError('Mật khẩu mới cần tối thiểu 8 ký tự.')
    if (next === current) return setError('Mật khẩu mới phải khác mật khẩu hiện tại.')
    if (next !== confirm) return setError('Mật khẩu xác nhận chưa khớp.')

    setLoading(true)
    try {
      const savePassword = onChangePassword ?? changePassword
      const result = await savePassword({ currentPassword: current, newPassword: next })
      notify('Đã cập nhật mật khẩu thành công')
      onClose()
      if (result?.requiresLogin) navigate('/login', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? 'Không đổi được mật khẩu, vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Đổi mật khẩu"
      subtitle="Mật khẩu mới nên khác với mật khẩu bạn đã dùng trước đây"
      onClose={onClose}
    >
      <form className="pw-form" onSubmit={handleSubmit}>
        <PasswordField
          label="Mật khẩu hiện tại"
          value={current}
          onChange={setCurrent}
          placeholder="Nhập mật khẩu hiện tại"
          autoComplete="current-password"
        />

        <div>
          <PasswordField
            label="Mật khẩu mới"
            value={next}
            onChange={setNext}
            placeholder="Tối thiểu 8 ký tự"
            autoComplete="new-password"
          />
          {next && (
            <div className={`strength strength--${level.tone}`}>
              <div className="strength__bar">
                <span style={{ width: `${score * 25}%` }} />
              </div>
              <small>Độ mạnh: {level.label}</small>
            </div>
          )}
        </div>

        <PasswordField
          label="Xác nhận mật khẩu mới"
          value={confirm}
          onChange={setConfirm}
          placeholder="Nhập lại mật khẩu mới"
          autoComplete="new-password"
        />
        {matchState === 'ok' && (
          <p className="hint hint--ok"><CircleCheck size={13} /> Mật khẩu xác nhận đã khớp</p>
        )}
        {matchState === 'bad' && (
          <p className="hint hint--bad"><CircleAlert size={13} /> Mật khẩu xác nhận chưa khớp</p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="modal__actions">
          <Button type="button" variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Đang lưu...' : 'Cập nhật'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
