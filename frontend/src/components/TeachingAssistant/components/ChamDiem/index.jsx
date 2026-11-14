import { useState } from 'react';
import {
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Clock3,
  LockKeyhole,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { Btn, Card, CardHead, Chip } from '../../../../common/ui';
import { usePageHeader, useManager } from '../../../Manager/layout/ManagerContext.jsx';
import { useAssistant } from '../../layout/NguCanhTroGiang';
import { formatDateTime, LoadingState } from '../shared/DungChung';
import RequestGradingModal from './GuiYeuCauModal';

export const GRANT_STATUSES = {
  open: { label: 'Đang mở', tone: 'green' },
  scheduled: { label: 'Chưa đến thời gian', tone: 'blue' },
  expired: { label: 'Đã hết hạn', tone: 'gray' },
  revoked: { label: 'Đã thu hồi', tone: 'red' },
  published: { label: 'Đã công bố', tone: 'gray' },
};

function GradeGrantRow({ grant, className }) {
  const status = GRANT_STATUSES[grant.state] ?? GRANT_STATUSES.expired;
  const canEnterGrades = grant.state === 'open' && !grant.pending;
  return (
    <article className={`ta-grant-row ${grant.state === 'open' ? 'is-open' : ''}`}>
      <span className="ta-grant-icon">
        <ShieldCheck size={20} />
      </span>
      <div className="ta-grant-info">
        <strong>{className || 'Lớp được phân công'}</strong>
        <span>
          {grant.title} · {grant.teacher}
        </span>
        <small>
          <Clock3 size={12} />
          {formatDateTime(grant.opensAt)} – {formatDateTime(grant.closesAt)}
        </small>
      </div>
      <Chip tone={grant.pending ? 'amber' : status.tone}>
        {grant.pending ? 'Chờ giảng viên duyệt' : status.label}
      </Chip>
      <Btn
        variant={canEnterGrades ? 'primary' : 'muted'}
        size="sm"
        iconRight={ChevronRight}
        to={`/assistant/chamdiem/nhap/${grant.id}`}
      >
        {canEnterGrades ? 'Nhập điểm' : 'Xem chi tiết'}
      </Btn>
    </article>
  );
}

export default function Grading() {
  usePageHeader('Chấm điểm', 'Nhập điểm theo quyền được cấp và gửi giảng viên duyệt');
  const { data, loading, loadError, reloadData } = useAssistant();
  const { notify } = useManager();
  const [requestOpen, setRequestOpen] = useState(false);

  if (loadError) return <LoadingState error={loadError} onRetry={reloadData} />;
  if (loading && !data.classes.length) return <LoadingState />;

  const grants = data.grants;
  const openGrantCount = grants.filter((grant) => grant.state === 'open' && !grant.pending).length;
  const classNamesById = new Map(
    data.classes.map((classItem) => [String(classItem.id), classItem.name])
  );

  return (
    <div className="ta-workflow-page">
      <div className="ta-workflow-toolbar">
        <div className="ta-workflow-tabs" aria-label="Chấm điểm">
          <Btn variant="soft" to="/assistant/chamdiem" icon={ShieldCheck} aria-current="page">
            Quyền nhập điểm
          </Btn>
          <Btn variant="ghost" to="/assistant/chamdiem/yeucau" icon={ClipboardList}>
            Yêu cầu của tôi
          </Btn>
        </div>
        <Btn icon={Plus} onClick={() => setRequestOpen(true)}>
          Gửi yêu cầu nhập điểm
        </Btn>
      </div>

      {!openGrantCount && (
        <Card className="ta-grading-locked">
          <span className="ta-lock-illustration">
            <LockKeyhole size={30} strokeWidth={1.6} />
          </span>
          <h2>Giảng viên chưa mở quyền nhập điểm cho bạn</h2>
          <p>
            Bạn có thể xem lịch, danh sách lớp và hỗ trợ điểm danh.
            <br />
            Để nhập điểm, hãy gửi yêu cầu để giảng viên mở quyền;
            <br className="ta-desktop-break" />
            điểm bạn nhập sẽ được giảng viên duyệt trước khi vào bảng điểm.
          </p>
          <div className="ta-button-row">
            <Btn variant="muted" to="/assistant/lichhotro" icon={CalendarClock}>
              Về lịch hỗ trợ
            </Btn>
            <Btn icon={Plus} onClick={() => setRequestOpen(true)}>
              Gửi yêu cầu
            </Btn>
          </div>
        </Card>
      )}
      {grants.length > 0 && (
        <Card>
          <CardHead
            title="Quyền nhập điểm của bạn"
            sub={`${openGrantCount} quyền đang mở · Thời gian và phạm vi do giảng viên cấp`}
          />
          <div className="ta-grant-list">
            {grants.map((grant) => (
              <GradeGrantRow
                key={grant.id}
                grant={grant}
                className={classNamesById.get(String(grant.classId)) || grant.className}
              />
            ))}
          </div>
        </Card>
      )}
      <div className="ta-workflow-note">
        <ShieldCheck size={16} />
        <p>Điểm được lưu nháp riêng và chỉ cập nhật bảng điểm lớp sau khi giảng viên phê duyệt.</p>
      </div>
      {loading && (
        <span className="ta-muted" role="status">
          Đang cập nhật quyền…
        </span>
      )}
      {requestOpen && (
        <RequestGradingModal
          onClose={() => setRequestOpen(false)}
          onSuccess={() => notify('Đã lưu yêu cầu nhập điểm mẫu')}
        />
      )}
    </div>
  );
}
