import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCheck, MessageSquare, Send } from 'lucide-react';
import { BackLink, Btn, Card, Chip, TextAreaField } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { SectionHeader, EmptyState } from '../shared/DungChung';
import { formatDateTime } from '../shared/tienIch';
import '../../styles/hoc-phi-thong-bao.css';

export default function NotificationReply() {
  const { maThongBao: notificationId } = useParams();
  const {
    data,
    student,
    notifications,
    sendNotificationFeedback: sendReply,
    notify,
  } = useStudentParent();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const notification = notifications.find((replyItem) => replyItem.ma === notificationId);
  useEffect(() => {
    setContent('');
    setError('');
  }, [student.ma, notificationId]);
  if (!notification)
    return (
      <EmptyState
        title="Không tìm thấy thông báo"
        description="Chọn một thông báo của học viên hiện tại để gửi phản hồi."
      >
        <Btn to="/student/thongbao" variant="soft">
          Về danh sách thông báo
        </Btn>
      </EmptyState>
    );
  const replies = data.phanHoiThongBao.filter(
    (replyItem) => replyItem.maThongBao === notificationId && replyItem.maHocVien === student.ma
  );

  function submitReply(event) {
    event.preventDefault();
    setError('');
    try {
      sendReply({ maThongBao: notificationId, noiDung: content.trim() });
      setContent('');
      notify('Đã lưu phản hồi mẫu. Nội dung chưa được gửi đến trung tâm.');
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <div className="sp-page sp-notification-reply" key={`${student.ma}:${notificationId}`}>
      <BackLink to={`/student/thongbao/${notificationId}`}>Chi tiết thông báo</BackLink>
      <Card className="sp-reply-card">
        <div className="sp-reply-about">
          <MessageSquare size={23} />
          <div>
            <h2>Về thông báo: {notification.tieuDe}</h2>
            <p>
              {notification.nguoiGui} · NEKO EDU · {formatDateTime(notification.ngayGui)}
            </p>
            {notification.quanTrong && <Chip tone="amber">Quan trọng</Chip>}
          </div>
        </div>
        <form onSubmit={submitReply} className="sp-stack">
          <TextAreaField
            label="Nội dung phản hồi của bạn"
            placeholder="Nhập câu hỏi hoặc phản hồi của bạn về thông báo này..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
            maxLength={2000}
            rows={6}
          />
          <span className="sp-reply-counter">{content.length}/2000 ký tự</span>
          <p className="sp-note">
            Bản mẫu lưu phản hồi trên trình duyệt để bạn xem lại. Trung tâm chưa nhận được nội dung
            này.
          </p>
          {error && (
            <p className="sp-error" role="alert">
              {error}
            </p>
          )}
          <div>
            <Btn type="submit" icon={Send} disabled={!content.trim()}>
              Gửi phản hồi
            </Btn>
          </div>
        </form>
      </Card>
      <Card className="sp-reply-history">
        <SectionHeader
          title="Phản hồi đã gửi"
          description={`Lịch sử phản hồi của ${student.ten} cho thông báo này`}
        />
        {replies.length ? (
          <div>
            {[...replies].reverse().map((replyItem) => (
              <article key={replyItem.ma}>
                <div className="sp-toolbar">
                  <strong>{student.ten}</strong>
                  <span>
                    <CheckCheck size={14} /> Đã lưu trong bản mẫu
                  </span>
                </div>
                <p>{replyItem.noiDung}</p>
                <time dateTime={replyItem.ngayGui}>{formatDateTime(replyItem.ngayGui)}</time>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Chưa có phản hồi"
            description="Phản hồi bạn gửi trong bản mẫu sẽ được hiển thị ở đây."
          />
        )}
      </Card>
    </div>
  );
}
