import { useState } from 'react';
import { Bell, CheckCheck, Search } from 'lucide-react';
import { Btn, Card, Chip, Pills, SearchBox } from '../../../../common/ui';
import { norm } from '../../../../common/format.js';
import { useManager } from '../../../Manager/layout/ManagerContext.jsx';
import { assistantData } from '../../data/duLieuTroGiang';
import { formatDateTime, LoadingState, EmptyState, useAsyncData } from '../shared/DungChung';

function NotificationContent({ notification }) {
  return (
    <article className={`ta-notification-item ${!notification.read ? 'is-unread' : ''}`}>
      <span className="ta-notification-item__icon">
        <Bell size={20} />
      </span>
      <div>
        <div className="ta-notification-item__heading">
          <h2>{notification.title}</h2>
          {!notification.read && <Chip tone="blue">Chưa đọc</Chip>}
        </div>
        <p>{notification.text}</p>
        <time dateTime={notification.time}>{formatDateTime(notification.time)}</time>
      </div>
    </article>
  );
}

function NoNotifications({ query, filter }) {
  let title = 'Chưa có thông báo';
  let description = 'Thông báo từ trung tâm và giảng viên sẽ xuất hiện tại đây.';

  if (query) {
    title = 'Không tìm thấy thông báo';
    description = 'Thử tìm bằng một từ khóa khác.';
  } else if (filter === 'chuaDoc') {
    title = 'Bạn đã đọc hết thông báo';
  }

  return <EmptyState icon={query ? Search : Bell} title={title} description={description} />;
}

export default function Notifications() {
  const notificationResource = useAsyncData(assistantData.getNotifications);
  const [filter, setFilter] = useState('tatCa');
  const [query, setQuery] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const { notify } = useManager();

  const items = notificationResource.data?.items ?? [];
  const unreadCount = notificationResource.data?.unread ?? 0;
  const normalizedQuery = norm(query);
  const displayedNotifications = items.filter((notification) => {
    const matchesFilter = filter === 'tatCa' || !notification.read;
    const content = norm(`${notification.title} ${notification.text}`);
    return matchesFilter && content.includes(normalizedQuery);
  });
  const filters = [
    { value: 'tatCa', label: `Tất cả (${items.length})` },
    { value: 'chuaDoc', label: `Chưa đọc (${unreadCount})` },
  ];

  async function markAllNotificationsRead() {
    setUpdating(true);
    setUpdateError('');
    try {
      await assistantData.markAllNotificationsRead();
      notificationResource.reload();
      notify('Đã đánh dấu tất cả thông báo là đã đọc');
    } catch (error) {
      setUpdateError(error.message);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="u-page ta-notifications">
      <div className="ta-toolbar ta-toolbar--between">
        <Pills items={filters} value={filter} onChange={setFilter} />
        <Btn
          icon={CheckCheck}
          variant="soft"
          disabled={updating || !unreadCount}
          onClick={markAllNotificationsRead}
        >
          {updating ? 'Đang cập nhật…' : 'Đánh dấu tất cả đã đọc'}
        </Btn>
      </div>

      <SearchBox value={query} onChange={setQuery} placeholder="Tìm thông báo..." />
      {updateError && (
        <p className="ta-error" role="alert">
          {updateError}
        </p>
      )}

      {notificationResource.loading || notificationResource.error ? (
        <LoadingState error={notificationResource.error} onRetry={notificationResource.reload} />
      ) : (
        <Card pad={false}>
          {displayedNotifications.length ? (
            displayedNotifications.map((notification) => (
              <NotificationContent key={notification.id} notification={notification} />
            ))
          ) : (
            <NoNotifications query={query} filter={filter} />
          )}
        </Card>
      )}
    </div>
  );
}
