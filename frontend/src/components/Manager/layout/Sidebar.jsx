import { NavLink } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { MENU } from './menu'

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="logo"><GraduationCap size={18} /></span>
        <div>
          <strong>NEKO EDU</strong>
          <small>English Center Platform</small>
        </div>
      </div>

      <div className="sidebar__role">
        <strong>Manager</strong>
        <small>Toàn quyền vận hành trung tâm</small>
      </div>

      <nav className="sidebar__nav">
        {MENU.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} className="nav-item">
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
