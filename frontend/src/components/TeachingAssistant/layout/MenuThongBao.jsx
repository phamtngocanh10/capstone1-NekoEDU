import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import useClickOutside from '../../../common/useClickOutside.js';
import { useManager } from '../../Manager/layout/ManagerContext.jsx';
import { formatDateTime, useAsyncData } from '../components/shared/DungChung';
import { assistantData } from '../data/duLieuTroGiang';

function NotificationPreview({ notification, closeMenu }) {
  return (
    <Link
      className={`ta-notification-preview ${!notification.read ? 'is-unread' : ''}`}
      to="/assistant/thongbao"
      onClick={closeMenu}
    >
      <span className="ta-notification-preview__icon">
        <Bell size={15} />
      </span>
      <span>
        <strong>{notification.title}</strong>
        <small>{formatDateTime(notification.time)}</small>
      </span>
      {!notification.read && <i />}
    </Link>
  );
}

export default function NotificationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const notificationResource = useAsyncData(assistantData.getNotifications, [isOpen]);
  const { notify } = useManager();
  const items = notificationResource.data?.items ?? [];
  const unreadCount = notificationResource.data?.unread ?? 0;
  const notificationLabel = `Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`;

  function closeMenu() {
    setIsOpen(false);
  }

  useClickOutside(menuRef, closeMenu, isOpen);

  async function markAllNotificationsRead() {
    try {
      await assistantData.markAllNotificationsRead();
      notificationResource.reload();
    } catch (error) {
      notify(error.message);
    }
  }

  return (
    <div className="menu-wrap" ref={menuRef}>
      <button
        className="bell"
        aria-label={notificationLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <Bell size={17} />
        {unreadCount > 0 && <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="popover ta-notification-popover">
          <div className="ta-notification-popover__head">
            <strong>Thông báo</strong>
            {unreadCount > 0 && (
              <button className="u-link" onClick={markAllNotificationsRead}>
                Đọc tất cả
              </button>
            )}
          </div>
          {notificationResource.error && <p role="alert">{notificationResource.error}</p>}
          {!notificationResource.error && !items.length && (
            <p>
              {notificationResource.loading ? 'Đang tải thông báo…' : 'Bạn chưa có thông báo mới.'}
            </p>
          )}
          {items.slice(0, 4).map((notification) => (
            <NotificationPreview
              key={notification.id}
              notification={notification}
              closeMenu={closeMenu}
            />
          ))}
          <Link
            className="ta-notification-popover__foot"
            to="/assistant/thongbao"
            onClick={closeMenu}
          >
            Xem tất cả thông báo <ChevronRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}
