import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import useClickOutside from '../../../common/useClickOutside';
import { useStudentParent } from './NguCanhHocVien';
import { logoutStudentParent } from '../data/duLieuDangNhap';

export default function AccountMenu() {
  const { data, notify } = useStudentParent();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setIsOpen(false), isOpen);
  const account = data.taiKhoan;
  function logout() {
    try {
      logoutStudentParent();
      navigate('/login', { replace: true });
    } catch (error) {
      notify(error.message);
    }
  }
  return (
    <div className="menu-wrap" ref={containerRef}>
      <button
        type="button"
        className="user"
        aria-label="Menu tài khoản"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="avatar">
          {account.anhDaiDien ? (
            <img src={account.anhDaiDien} alt={account.ten} />
          ) : (
            account.ten.trim().split(/\s+/).at(-1).charAt(0)
          )}
        </span>
        <div>
          <strong>{account.ten.split(' ').slice(-2).join(' ')}</strong>
          <small>Học viên/PH</small>
        </div>
      </button>
      {isOpen && (
        <div className="popover sp-user-menu" role="menu">
          <div className="sp-user-summary">
            <strong>{account.ten}</strong>
            <small>{account.email}</small>
          </div>
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              navigate('/student/thongtincanhan');
            }}
          >
            <User size={16} />
            Thông tin cá nhân
          </button>
          <hr />
          <button className="menu-item menu-item--danger" role="menuitem" onClick={logout}>
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
