import { useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import { MENU, EXTRA_PAGES } from './menu'
import { useManager } from './ManagerContext'
import NotificationMenu from './NotificationMenu'
import AvatarMenu from './AvatarMenu'

export default function Header() {
  const { pathname } = useLocation()
  const { header } = useManager()
  const current = [...MENU, ...EXTRA_PAGES].find((m) => pathname.startsWith(m.path))
  // Trang con đặt tiêu đề riêng bằng usePageHeader(); trang chính lấy từ menu.js
  const title = header?.title ?? current?.label ?? 'NEKO EDU'
  const subtitle = header ? header.subtitle : current?.subtitle

  return (
    <header className="header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="header__right">
        <label className="search">
          <Search size={15} />
          <input placeholder="Tìm học viên, lớp học..." />
        </label>
        <NotificationMenu />
        <AvatarMenu />
      </div>
    </header>
  )
}
