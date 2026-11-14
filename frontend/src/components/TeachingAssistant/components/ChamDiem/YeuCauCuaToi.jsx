import { useMemo, useState } from 'react';
import { CheckCheck, ClipboardList, Clock3, FileCheck2, Plus, Send, XCircle } from 'lucide-react';
import {
  Btn,
  Card,
  CardHead,
  Chip,
  DataTable,
  Dialog,
  SearchBox,
  SelectField,
  StatCard,
} from '../../../../common/ui';
import { usePageHeader, useManager } from '../../../Manager/layout/ManagerContext.jsx';
import { useAssistant } from '../../layout/NguCanhTroGiang';
import { formatDateTime, filterByQuery, LoadingState } from '../shared/DungChung';
import RequestGradingModal from './GuiYeuCauModal';

const REQUEST_STATUSES = {
  PENDING: { label: 'Chờ giảng viên duyệt', tone: 'amber' },
  APPROVED: { label: 'Đã duyệt', tone: 'green' },
  REJECTED: { label: 'Bị từ chối', tone: 'red' },
  RETURNED: { label: 'Cần chỉnh sửa', tone: 'red' },
  CANCELLED: { label: 'Đã hủy', tone: 'gray' },
};

function StatusBadge({ status }) {
  const display = REQUEST_STATUSES[status];
  return <Chip tone={display?.tone ?? 'gray'}>{display?.label ?? status}</Chip>;
}

function createHistory(data) {
  const requests = data.requests.map((request) => ({
    ...request,
    rowId: `yeucau-${request.id}`,
    type: 'yeucau',
    description: 'Yêu cầu mở quyền nhập điểm',
  }));
  const gradeSheets = data.submissions.map((gradeSheet) => ({
    ...gradeSheet,
    rowId: `bangdiem-${gradeSheet.id}`,
    type: 'bangdiem',
    description: `Điểm đã gửi duyệt (${gradeSheet.studentCount} HV)`,
  }));
  return [...requests, ...gradeSheets].sort(
    (previousRow, nextRow) => new Date(nextRow.createdAt) - new Date(previousRow.createdAt)
  );
}

const HISTORY_COLUMNS = [
  {
    key: 'description',
    label: 'NỘI DUNG',
    render: (row) => (
      <span className="ta-history-content">
        {row.type === 'yeucau' ? <Send size={17} /> : <FileCheck2 size={17} />}
        <span>
          <strong>{row.description}</strong>
          <small>{row.title}</small>
        </span>
      </span>
    ),
  },
  {
    key: 'className',
    label: 'LỚP',
    render: (row) => <strong>{row.className}</strong>,
  },
  {
    key: 'from',
    label: 'THỜI GIAN',
    render: (row) =>
      row.from ? (
        <span className="ta-history-time">
          {formatDateTime(row.from)}
          <br />
          {formatDateTime(row.to)}
        </span>
      ) : (
        '—'
      ),
  },
  {
    key: 'createdAt',
    label: 'GỬI LÚC',
    render: (row) => formatDateTime(row.createdAt),
  },
  {
    key: 'status',
    label: 'TRẠNG THÁI',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'reviewNote',
    label: 'GHI CHÚ GIẢNG VIÊN',
    render: (row) => (
      <span className="ta-review-note">
        {row.reviewNote || (row.status === 'APPROVED' ? 'Đã được phê duyệt' : '—')}
      </span>
    ),
  },
];

function RequestDetails({ content, onClose }) {
  return (
    <Dialog
      title={content.description}
      subtitle={`${content.className} · ${content.title}`}
      onClose={onClose}
    >
      <div className="ta-history-detail">
        <StatusBadge status={content.status} />
        <dl>
          <div>
            <dt>Giảng viên phụ trách</dt>
            <dd>{content.teacher || '—'}</dd>
          </div>
          <div>
            <dt>Gửi lúc</dt>
            <dd>{formatDateTime(content.createdAt)}</dd>
          </div>
          {content.from && (
            <div>
              <dt>Thời gian đề nghị</dt>
              <dd>
                {formatDateTime(content.from)} – {formatDateTime(content.to)}
              </dd>
            </div>
          )}
          <div>
            <dt>Lý do / ghi chú của bạn</dt>
            <dd>{content.note || '—'}</dd>
          </div>
          <div>
            <dt>Phản hồi giảng viên</dt>
            <dd>{content.reviewNote || 'Chưa có phản hồi'}</dd>
          </div>
          {content.reviewedAt && (
            <div>
              <dt>Phản hồi lúc</dt>
              <dd>{formatDateTime(content.reviewedAt)}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="u-modal__foot">
        <Btn variant="muted" onClick={onClose}>
          Đóng
        </Btn>
        {content.grantId && (
          <Btn to={`/assistant/chamdiem/nhap/${content.grantId}`}>Xem bảng điểm</Btn>
        )}
      </div>
    </Dialog>
  );
}

export default function MyRequests() {
  usePageHeader('Yêu cầu của tôi', 'Yêu cầu nhập điểm và điểm đã gửi giảng viên duyệt');
  const { data, loading, loadError, reloadData } = useAssistant();
  const { notify } = useManager();
  const [requestOpen, setRequestOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selectedContent, setSelectedContent] = useState(null);
  const history = useMemo(() => createHistory(data), [data]);
  const stats = useMemo(
    () =>
      history.reduce(
        (total, row) => {
          if (row.status === 'APPROVED') total.approved += 1;
          if (row.status === 'PENDING') total.pendingApproval += 1;
          if (['REJECTED', 'RETURNED'].includes(row.status)) total.needsChanges += 1;
          return total;
        },
        { approved: 0, pendingApproval: 0, needsChanges: 0 }
      ),
    [history]
  );

  if (loadError) return <LoadingState error={loadError} onRetry={reloadData} />;
  if (loading && !data.classes.length) return <LoadingState />;

  const filteredHistory = filterByQuery(
    history,
    query,
    (row) => `${row.className} ${row.title} ${row.description} ${row.teacher ?? ''}`
  ).filter((row) => !status || row.status === status);

  function viewDetails(row) {
    const classItem = data.classes.find(
      (classItem) => String(classItem.id) === String(row.classId)
    );
    setSelectedContent({ ...row, teacher: row.teacher || classItem?.teacher });
  }

  return (
    <div className="ta-workflow-page">
      <div className="ta-workflow-toolbar">
        <div className="ta-workflow-tabs">
          <Btn variant="ghost" to="/assistant/chamdiem">
            Quyền nhập điểm
          </Btn>
          <Btn
            variant="soft"
            icon={ClipboardList}
            to="/assistant/chamdiem/yeucau"
            aria-current="page"
          >
            Yêu cầu của tôi
          </Btn>
        </div>
        <Btn icon={Plus} onClick={() => setRequestOpen(true)}>
          Gửi yêu cầu nhập điểm
        </Btn>
      </div>
      <div className="ta-history-stats">
        <StatCard icon={Send} label="Yêu cầu đã gửi" value={history.length} />
        <StatCard icon={CheckCheck} label="Đã duyệt" value={stats.approved} accent="green" />
        <StatCard
          icon={Clock3}
          label="Chờ giảng viên duyệt"
          value={stats.pendingApproval}
          accent="amber"
        />
        <StatCard
          icon={XCircle}
          label="Bị từ chối / cần sửa"
          value={stats.needsChanges}
          accent="red"
        />
      </div>
      <Card className="ta-history-card">
        <CardHead
          title="Yêu cầu và điểm đã gửi"
          sub="Theo dõi trạng thái phê duyệt và phản hồi của giảng viên"
        />
        <div className="ta-workflow-filters">
          <SearchBox value={query} onChange={setQuery} placeholder="Tìm lớp, kỳ điểm, yêu cầu…" />
          <SelectField
            label="Trạng thái"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              ...Object.entries(REQUEST_STATUSES).map(([value, display]) => ({
                value,
                label: display.label,
              })),
            ]}
          />
        </div>
        <DataTable
          columns={HISTORY_COLUMNS}
          rows={filteredHistory}
          rowKey="rowId"
          onRowClick={viewDetails}
          empty={
            history.length
              ? 'Không có yêu cầu phù hợp với bộ lọc.'
              : 'Bạn chưa gửi yêu cầu hoặc bảng điểm nào. Gửi yêu cầu để giảng viên cấp quyền nhập điểm.'
          }
        />
        <p className="ta-table-caption">
          {filteredHistory.length} / {history.length} nội dung · Chọn một dòng để xem chi tiết
        </p>
      </Card>
      {requestOpen && (
        <RequestGradingModal
          onClose={() => setRequestOpen(false)}
          onSuccess={() => notify('Đã lưu yêu cầu nhập điểm mẫu')}
        />
      )}
      {selectedContent && (
        <RequestDetails content={selectedContent} onClose={() => setSelectedContent(null)} />
      )}
    </div>
  );
}
