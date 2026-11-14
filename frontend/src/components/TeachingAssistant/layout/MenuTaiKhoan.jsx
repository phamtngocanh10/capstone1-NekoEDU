import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, User } from 'lucide-react';
import useBamNgoai from '../../../common/useClickOutside';
import {
  initialOf as chuCaiDauTen,
  shortName as tenRutGon,
  useManager as useNguCanhTaiKhoan,
} from '../../Manager/layout/ManagerContext';

function AnhTaiKhoan({ taiKhoan }) {
  return (
    <span className="avatar">
      {taiKhoan.avatarUrl ? (
        <img
          src={taiKhoan.avatarUrl}
          alt={taiKhoan.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
        />
      ) : chuCaiDauTen(taiKhoan.name)}
    </span>
  );
}

export default function MenuTaiKhoan() {
  const chuyenTrang = useNavigate();
  const { user: taiKhoan, openPasswordModal: moDoiMatKhau } = useNguCanhTaiKhoan();
  const [dangMo, datDangMo] = useState(false);
  const vungMenu = useRef(null);
  useBamNgoai(vungMenu, () => datDangMo(false), dangMo);

  function moHoSo() {
    datDangMo(false);
    chuyenTrang('/assistant/thongtincanhan');
  }

  function moBieuMauMatKhau() {
    datDangMo(false);
    moDoiMatKhau();
  }

  function dangXuat() {
    datDangMo(false);
    chuyenTrang('/assistant/dangxuat');
  }

  return (
    <div className="menu-wrap" ref={vungMenu}>
      <button
        className="user"
        aria-haspopup="menu"
        aria-expanded={dangMo}
        onClick={() => datDangMo(giaTri => !giaTri)}
      >
        <AnhTaiKhoan taiKhoan={taiKhoan} />
        <div><strong>{tenRutGon(taiKhoan.name)}</strong><small>Trợ giảng</small></div>
      </button>
      {dangMo && (
        <div className="popover popover--avatar" role="menu">
          <div className="avatar-card">
            <AnhTaiKhoan taiKhoan={taiKhoan} />
            <div><strong>{taiKhoan.name}</strong><small>{taiKhoan.email}</small></div>
          </div>
          <button role="menuitem" className="menu-item" onClick={moHoSo}>
            <User size={15} /> Thông tin cá nhân
          </button>
          <button role="menuitem" className="menu-item" onClick={moBieuMauMatKhau}>
            <KeyRound size={15} /> Đổi mật khẩu
          </button>
          <hr />
          <button role="menuitem" className="menu-item menu-item--danger" onClick={dangXuat}>
            <LogOut size={15} /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
