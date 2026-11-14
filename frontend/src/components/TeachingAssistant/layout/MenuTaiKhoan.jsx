import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, User } from 'lucide-react';
import useClickOutside from '../../../common/useClickOutside.js';
import { initialOf, shortName, useManager } from '../../Manager/layout/ManagerContext.jsx';

function AccountAvatar({ account }) {
  return (
    <span className="avatar">
      {account.avatarUrl ? (
        <img
          src={account.avatarUrl}
          alt={account.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
        />
      ) : (
        initialOf(account.name)
      )}
    </span>
  );
}

export default function AccountMenu() {
  const navigate = useNavigate();
  const { user: account, openPasswordModal } = useManager();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setIsOpen(false), isOpen);

  function openProfile() {
    setIsOpen(false);
    navigate('/assistant/thongtincanhan');
  }

  function showPasswordForm() {
    setIsOpen(false);
    openPasswordModal();
  }

  function logout() {
    setIsOpen(false);
    navigate('/assistant/dangxuat');
  }

  return (
    <div className="menu-wrap" ref={menuRef}>
      <button
        className="user"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <AccountAvatar account={account} />
        <div>
          <strong>{shortName(account.name)}</strong>
          <small>Trợ giảng</small>
        </div>
      </button>
      {isOpen && (
        <div className="popover popover--avatar" role="menu">
          <div className="avatar-card">
            <AccountAvatar account={account} />
            <div>
              <strong>{account.name}</strong>
              <small>{account.email}</small>
            </div>
          </div>
          <button role="menuitem" className="menu-item" onClick={openProfile}>
            <User size={15} /> Thông tin cá nhân
          </button>
          <button role="menuitem" className="menu-item" onClick={showPasswordForm}>
            <KeyRound size={15} /> Đổi mật khẩu
          </button>
          <hr />
          <button role="menuitem" className="menu-item menu-item--danger" onClick={logout}>
            <LogOut size={15} /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
