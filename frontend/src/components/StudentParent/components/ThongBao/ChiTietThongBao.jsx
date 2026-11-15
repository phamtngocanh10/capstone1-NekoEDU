import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Download, MessageSquare } from 'lucide-react';
import { BackLink, Btn, Card, Chip } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { FileAttachment, SectionHeader, EmptyState } from '../shared/DungChung';
import { formatDateTime, downloadMaterial } from '../shared/tienIch';
import '../../styles/hoc-phi-thong-bao.css';

const NOTIFICATION_LABELS = {
  hocPhi: 'Học phí',
  lichHoc: 'Lịch học',
  ketQua: 'Kết quả học tập',
  chung: 'Thông báo chung',
};

export default function NotificationDetails() {
  const { maThongBao: notificationId } = useParams();
  const { student, notifications, markNotificationRead, notify } = useStudentParent();
  const [error, setError] = useState('');
  const openedNotificationRef = useRef('');
  const notification = notifications.find(
    (notificationItem) => notificationItem.ma === notificationId
  );

  useEffect(() => {
    const pageKey = `${student.ma}:${notificationId}`;
    if (!notification || openedNotificationRef.current === pageKey) return;
    openedNotificationRef.current = pageKey;
    setError('');
    if (!notification.daDoc) {
      try {
        markNotificationRead(notificationId);
      } catch (saveError) {
        setError(saveError.message);
      }
    }
  }, [student.ma, notificationId, notification, markNotificationRead]);

  if (!notification)
    return (
      <EmptyState
        title="Không tìm thấy thông báo"
        description="Thông báo không tồn tại hoặc không thuộc học viên đang chọn."
      >
        <Btn to="/student/thongbao" variant="soft">
          Về danh sách thông báo
        </Btn>
      </EmptyState>
    );

  const index = notifications.findIndex(
    (notificationItem) => notificationItem.ma === notificationId
  );
  const previousNotification = notifications[index - 1];
  const nextNotification = notifications[index + 1];
  const attachments = notification.tepDinhKem ?? [];
  const relatedNotifications = notifications
    .filter((notificationItem) => notificationItem.ma !== notificationId)
    .slice(0, 3);
  const paragraphs = Array.isArray(notification.noiDung)
    ? notification.noiDung
    : String(notification.noiDung ?? '').split(/\n\s*\n/);

  function toggleReadStatus() {
    setError('');
    try {
      markNotificationRead(notificationId, !notification.daDoc);
      notify(
        notification.daDoc
          ? 'Đã đánh dấu thông báo là chưa đọc.'
          : 'Đã đánh dấu thông báo là đã đọc.'
      );
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  function downloadAllAttachments() {
    setError('');
    try {
      attachments.forEach((file) => downloadMaterial(file));
      notify(`Đã tạo ${attachments.length} tệp tải xuống từ dữ liệu mẫu.`);
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  return (
    <div className="sp-page sp-notification-detail">
      <div className="sp-toolbar">
        <BackLink to="/student/thongbao">Quay lại danh sách thông báo</BackLink>
        <div className="sp-notification-paging">
          <Btn
            variant="icon"
            icon={ChevronLeft}
            to={previousNotification ? `/student/thongbao/${previousNotification.ma}` : undefined}
            disabled={!previousNotification}
            aria-label="Thông báo trước"
          />
          <span>
            {index + 1} / {notifications.length}
          </span>
          <Btn
            variant="icon"
            icon={ChevronRight}
            to={nextNotification ? `/student/thongbao/${nextNotification.ma}` : undefined}
            disabled={!nextNotification}
            aria-label="Thông báo sau"
          />
        </div>
      </div>
      {error && (
        <p className="sp-error" role="alert">
          {error}
        </p>
      )}
      <div className="sp-split">
        <Card className="sp-notification-content">
          <div className="sp-notification-chips">
            <Chip tone="blue">
              {NOTIFICATION_LABELS[notification.loai] || NOTIFICATION_LABELS.chung}
            </Chip>
            {notification.quanTrong && <Chip tone="amber">Quan trọng</Chip>}
          </div>
          <h2>{notification.tieuDe}</h2>
          <div className="sp-notification-sender">
            <span className="sp-sender-avatar">{notification.nguoiGui?.charAt(0) || 'N'}</span>
            <div>
              <strong>{notification.nguoiGui} · NEKO EDU</strong>
              <small>
                {formatDateTime(notification.ngayGui)} · Gửi tới: {notification.doiTuong}
              </small>
            </div>
          </div>
          <div className="sp-notification-body">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          {attachments.length > 0 && (
            <section className="sp-notification-attachments">
              <SectionHeader title={`Tệp đính kèm (${attachments.length})`}>
                <Btn size="xs" variant="ghost" icon={Download} onClick={downloadAllAttachments}>
                  Tải tất cả
                </Btn>
              </SectionHeader>
              <div className="sp-stack">
                {attachments.map((file) => (
                  <FileAttachment key={file.ma} file={file} />
                ))}
              </div>
            </section>
          )}
          <div className="sp-notification-footer">
            <span className="sp-read-state">
              <CheckCheck size={16} />
              {notification.daDoc
                ? 'Bạn đã đọc thông báo này'
                : 'Thông báo đang được đánh dấu chưa đọc'}
            </span>
            <div>
              <Btn size="sm" variant="ghost" onClick={toggleReadStatus}>
                {notification.daDoc ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
              </Btn>
              <Btn
                size="sm"
                icon={MessageSquare}
                to={`/student/thongbao/${notificationId}/phanhoi`}
              >
                Phản hồi trung tâm
              </Btn>
            </div>
          </div>
        </Card>
        <aside className="sp-stack">
          <Card>
            <SectionHeader title="Thông tin thông báo" />
            <dl className="sp-notification-info">
              {[
                ['Người gửi', notification.nguoiGui],
                ['Ngày gửi', formatDateTime(notification.ngayGui)],
                ['Đối tượng', notification.doiTuong],
                ['Loại', NOTIFICATION_LABELS[notification.loai] || NOTIFICATION_LABELS.chung],
                ['Mức ưu tiên', notification.quanTrong ? 'Quan trọng' : 'Thông thường'],
                ['Tệp đính kèm', `${attachments.length} tệp`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {relatedNotifications.length > 0 && (
            <Card>
              <SectionHeader title="Thông báo khác" />
              <div className="sp-related-notifications">
                {relatedNotifications.map((notificationItem) => (
                  <Link key={notificationItem.ma} to={`/student/thongbao/${notificationItem.ma}`}>
                    <Bell size={16} />
                    <span>
                      <strong>{notificationItem.tieuDe}</strong>
                      <small>{formatDateTime(notificationItem.ngayGui)}</small>
                    </span>
                    <ChevronRight size={14} />
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
