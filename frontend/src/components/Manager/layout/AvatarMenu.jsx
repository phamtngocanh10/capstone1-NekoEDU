import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LogOut, User } from 'lucide-react'
import useClickOutside from '../../../common/useClickOutside'
import { initialOf, shortName, useManager } from './ManagerContext'

export default function AvatarMenu({ profilePath = '/thongtincanhan' }) {
  const navigate = useNavigate()
  const { user, openPasswordModal } = useManager()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  function openProfile() {
    setOpen(false)
    navigate(profilePath)
  }

  function changePassword() {
    setOpen(false)
    openPasswordModal()
  }

  function handleLogout() {
    setOpen(false)
    // TODO: await logout() (src/api/profile.js) khi có backend
    localStorage.removeItem('access_token')
    localStorage.removeItem('neko-auth-user')
    navigate('/login', { replace: true })
  }

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        className="user"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span className="avatar">{initialOf(user.name)}</span>
        <div>
          <strong>{shortName(user.name)}</strong>
          <small>{user.role}</small>
        </div>
      </button>

      {open && (
        <div className="popover popover--avatar" role="menu">
          <div className="avatar-card">
            <span className="avatar">{initialOf(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <button role="menuitem" className="menu-item" onClick={openProfile}>
            <User size={15} /> Thông tin cá nhân
          </button>
          <button role="menuitem" className="menu-item" onClick={changePassword}>
            <KeyRound size={15} /> Đổi mật khẩu
          </button>
          <hr />
          <button role="menuitem" className="menu-item menu-item--danger" onClick={handleLogout}>
            <LogOut size={15} /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}
