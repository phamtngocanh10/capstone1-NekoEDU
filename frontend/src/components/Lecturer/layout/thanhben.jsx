import { Link, NavLink } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { DANH_SACH_MENU } from './menu';

export default function ThanhBen({ dangMo, dongMenu }) {
  return (
    <aside className={`sidebar lc-sidebar ${dangMo ? 'is-open' : ''}`}>
      <Link to="/lecturer/tongquan" className="sidebar__brand" onClick={dongMenu}>
        <span className="logo"><GraduationCap size={20} /></span>
        <span><strong>NEKO EDU</strong><small>English Center Platform</small></span>
      </Link>
      <div className="sidebar__role"><strong>Lecturer</strong><small>Giảng viên</small></div>
      <nav className="sidebar__nav">
        {DANH_SACH_MENU.map(({ path, label, icon: BieuTuong }) => (
          <NavLink key={path} to={`/lecturer/${path}`} className="nav-item" onClick={dongMenu}>
            <BieuTuong size={17} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
