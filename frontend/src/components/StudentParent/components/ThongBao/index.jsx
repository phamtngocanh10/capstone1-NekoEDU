import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  CreditCard,
  FileText,
  GraduationCap,
} from 'lucide-react';
import { Btn, Card, Chip, Pills, SearchBox } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { EmptyState } from '../shared/DungChung';
import { formatDateTime, filterByQuery } from '../shared/tienIch';
import '../../styles/hoc-phi-thong-bao.css';

const NOTIFICATION_ICONS = {
  hocPhi: CreditCard,
  lichHoc: CalendarDays,
  ketQua: GraduationCap,
  chung: Bell,
};

export default function Notifications() {
  const { notifications, markAllNotificationsRead, notify } = useStudentParent();
  const [filter, setFilter] = useState('tatCa');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const unreadCount = notifications.filter((notification) => !notification.daDoc).length;
  const filterOptions = [
    { value: 'tatCa', label: 'Tất cả' },
    { value: 'chuaDoc', label: `Chưa đọc (${unreadCount})` },
    { value: 'hocPhi', label: 'Học phí' },
    { value: 'lichHoc', label: 'Lịch học' },
    { value: 'ketQua', label: 'Kết quả học tập' },
  ];
  const filteredNotifications = filterByQuery(
    notifications,
    query,
    (notification) => `${notification.tieuDe} ${notification.tomTat}`
  ).filter(
    (notification) =>
      filter === 'tatCa' ||
      (filter === 'chuaDoc' ? !notification.daDoc : notification.loai === filter)
  );

  function markAllAsRead() {
    setError('');
    try {
      markAllNotificationsRead();
      notify('Đã đánh dấu các thông báo của học viên đang chọn là đã đọc.');
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <div className="sp-page sp-notifications">
      <div className="sp-toolbar">
        <Pills items={filterOptions} value={filter} onChange={setFilter} />
        <Btn
          icon={CheckCheck}
          variant="ghost"
          size="sm"
          onClick={markAllAsRead}
          disabled={!unreadCount}
        >
          Đánh dấu tất cả đã đọc
        </Btn>
      </div>
      <SearchBox value={query} onChange={setQuery} placeholder="Tìm thông báo..." />
      {error && (
        <p className="sp-error" role="alert">
          {error}
        </p>
      )}
      <Card pad={false} className="sp-notification-list">
        {filteredNotifications.length ? (
          filteredNotifications.map((notification) => {
            const Icon = NOTIFICATION_ICONS[notification.loai] || Bell;
            return (
              <Link
                key={notification.ma}
                to={`/student/thongbao/${notification.ma}`}
                className={`sp-notification-row ${notification.daDoc ? '' : 'is-unread'}`}
              >
                <span className={`sp-notification-icon sp-notification-icon--${notification.loai}`}>
                  <Icon size={21} />
                </span>
                <span className="sp-notification-main">
                  <span className="sp-notification-title">
                    {!notification.daDoc && (
                      <span className="sp-unread-dot" aria-label="Chưa đọc" />
                    )}
                    {notification.tieuDe}
                    {notification.quanTrong && (
                      <Chip tone="amber" size="xs">
                        Quan trọng
                      </Chip>
                    )}
                  </span>
                  <span className="sp-notification-summary">{notification.tomTat}</span>
                </span>
                <span className="sp-notification-meta">
                  <time dateTime={notification.ngayGui}>
                    {formatDateTime(notification.ngayGui)}
                  </time>
                  {Boolean(notification.tepDinhKem?.length) && (
                    <small>
                      <FileText size={12} /> {notification.tepDinhKem.length} tệp
                    </small>
                  )}
                </span>
                <ChevronRight className="sp-notification-chevron" size={16} />
              </Link>
            );
          })
        ) : (
          <EmptyState
            title={
              filter === 'chuaDoc' && !query
                ? 'Bạn đã đọc hết thông báo'
                : 'Không có thông báo phù hợp'
            }
            description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm để xem thêm."
          />
        )}
      </Card>
      {filteredNotifications.length > 0 && (
        <p className="sp-list-caption">
          Đã hiển thị {filteredNotifications.length} thông báo · Nhấn vào tiêu đề để xem nội dung và
          tệp đính kèm.
        </p>
      )}
    </div>
  );
}
