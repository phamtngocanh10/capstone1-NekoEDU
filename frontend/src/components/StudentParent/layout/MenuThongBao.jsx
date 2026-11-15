import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import useClickOutside from '../../../common/useClickOutside';
import { useStudentParent } from './NguCanhHocVien';
import { formatDate } from '../components/shared/tienIch';

export default function NotificationMenu() {
  const { notifications } = useStudentParent();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setIsOpen(false), isOpen);
  const unreadCount = notifications.filter((notification) => !notification.daDoc).length;
  return (
    <div className="menu-wrap" ref={containerRef}>
      <button
        type="button"
        className="bell"
        aria-label={`Thông báo, ${unreadCount} chưa đọc`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <Bell size={19} />
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      {isOpen && (
        <div className="popover sp-notice-popover">
          <strong>Thông báo mới</strong>
          {notifications.slice(0, 3).map((notification) => (
            <Link
              to={`/student/thongbao/${notification.ma}`}
              key={notification.ma}
              onClick={() => setIsOpen(false)}
            >
              <strong>{notification.tieuDe}</strong>
              <small>{formatDate(notification.ngayGui)}</small>
            </Link>
          ))}
          <Link to="/student/thongbao" onClick={() => setIsOpen(false)}>
            Xem tất cả thông báo <ChevronRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
