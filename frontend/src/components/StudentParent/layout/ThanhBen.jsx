import { Link, NavLink } from 'react-router-dom';
import { GraduationCap, HeartHandshake } from 'lucide-react';
import { MENU_ITEMS } from './menu';

export default function Sidebar({ isOpen }) {
  return (
    <aside className={`sidebar sp-sidebar ${isOpen ? 'is-open' : ''}`}>
      <Link to="/student/trangchu" className="sidebar__brand">
        <span className="logo">
          <GraduationCap size={20} />
        </span>
        <div>
          <strong>NEKO EDU</strong>
          <small>English Center Platform</small>
        </div>
      </Link>
      <div className="sidebar__role">
        <strong>Student / Parent</strong>
        <small>Tài khoản dùng chung</small>
      </div>
      <nav className="sidebar__nav" aria-label="Điều hướng học viên và phụ huynh">
        {MENU_ITEMS.map(({ path, title, icon: Icon }) => (
          <NavLink to={`/student/${path}`} className="nav-item" key={path}>
            <Icon size={17} />
            <span>{title}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sp-sidebar-foot">
        <HeartHandshake size={18} />
        <p>
          Đồng hành cùng gia đình,
          <br />
          nuôi dưỡng mỗi tiến bộ.
        </p>
      </div>
    </aside>
  );
}
