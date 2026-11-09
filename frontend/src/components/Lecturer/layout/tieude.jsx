import { useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { DANH_SACH_MENU } from './menu';
import { useGiangVien } from './ngucanh';
import MenuTaiKhoan from './menutaikhoan';
import ThongBao from './thongbao';

export default function TieuDe({ dangMo, batTatMenu }) {
  const { pathname } = useLocation();
  const { header } = useGiangVien();
  const muc = DANH_SACH_MENU.find(item => pathname.startsWith(`/lecturer/${item.path}`));
  const trangCaNhan = pathname === '/lecturer/thongtincanhan';
  const title = header?.title ?? (trangCaNhan ? 'Thông tin cá nhân' : muc?.label ?? 'Giảng viên');
  const subtitle = header?.subtitle ?? (trangCaNhan ? 'Quản lý hồ sơ và bảo mật tài khoản' : muc?.subtitle);
  return (
    <header className="header lc-header">
      <button className="lc-menu-button" aria-label={dangMo ? 'Đóng menu' : 'Mở menu'} onClick={batTatMenu}>
        {dangMo ? <X /> : <Menu />}
      </button>
      <div><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="header__right"><ThongBao /><MenuTaiKhoan /></div>
    </header>
  );
}
