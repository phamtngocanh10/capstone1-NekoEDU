import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Clock3,
  Info,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Btn, Card, Chip, Dialog, SearchBox } from '../../../../common/ui';
import { useManager, usePageHeader } from '../../../Manager/layout/ManagerContext.jsx';
import { useAssistant } from '../../layout/NguCanhTroGiang';
import { formatDateTime, StudentIdentity, LoadingState, EmptyState } from '../shared/DungChung';
import { hasCompleteScores, isValidScore, SKILL_NAMES, calculateAverageScore } from './xuLyDiem';
import { GRANT_STATUSES } from '.';
import useGradeDraft from './useBanNhapDiem';

export default function GradeEntry() {
  const { grantId } = useParams();
  return <GradeSheetEditor key={grantId} grantId={grantId} />;
}

function GradeSheetEditor({ grantId }) {
  usePageHeader('Nhập điểm', 'Điểm bạn nhập sẽ được giảng viên duyệt trước khi vào bảng điểm');
  const navigate = useNavigate();
  const { notify } = useManager();
  const { data, reloadData } = useAssistant();
  const [query, setQuery] = useState('');
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const {
    draft,
    rows,
    hasChanges,
    hasInvalidScores,
    canEnterGrades,
    conflict,
    saveStatus,
    savedAt,
    error,
    loadError,
    submitting,
    reloading,
    changeScore,
    saveGradeDraft: saveDraft,
    submitGradeSheet,
    reloadDraft,
  } = useGradeDraft(grantId);

  const displayedRows = useMemo(() => {
    const searchText = query.trim().toLocaleLowerCase('vi');
    return rows.filter((row) =>
      `${row.name} ${row.code}`.toLocaleLowerCase('vi').includes(searchText)
    );
  }, [rows, query]);
  const completedStudentCount = rows.filter(hasCompleteScores).length;
  const reviewFeedback = data.submissions.find(
    (submission) =>
      String(submission.grantId) === String(grantId) && submission.status === 'RETURNED'
  );
  const inputLocked = !canEnterGrades || submitting || reloading || conflict;

  async function saveManually() {
    try {
      if (await saveDraft()) notify('Đã lưu bản nháp');
    } catch {
      // Hook giữ nguyên điểm đã nhập và hiển thị lỗi tại bảng điểm.
    }
  }

  async function submitForReview() {
    try {
      if (!(await submitGradeSheet())) return;
      setConfirmationVisible(false);
      reloadData();
      notify('Đã lưu bảng điểm mẫu ở trạng thái chờ duyệt.');
      navigate('/assistant/chamdiem/yeucau');
    } catch {
      setConfirmationVisible(false);
    }
  }

  function reloadAfterConflict() {
    if (
      hasChanges &&
      !window.confirm(
        'Tải lại sẽ thay điểm chưa lưu bằng bản nháp trong trình duyệt. Bạn muốn tiếp tục?'
      )
    )
      return;
    reloadDraft();
  }

  if (!draft) {
    return (
      <div className="ta-workflow-page">
        <Btn to="/assistant/chamdiem" variant="ghost" icon={ArrowLeft}>
          Quay lại chấm điểm
        </Btn>
        <LoadingState error={loadError} onRetry={reloadDraft} />
      </div>
    );
  }

  return (
    <div className="ta-workflow-page">
      <div className="ta-workflow-toolbar">
        <Btn to="/assistant/chamdiem" variant="ghost" icon={ArrowLeft}>
          Quay lại chấm điểm
        </Btn>
        <Btn to="/assistant/chamdiem/yeucau" variant="muted">
          Yêu cầu của tôi
        </Btn>
      </div>
      <GradeGrantDetails draft={draft} canEnterGrades={canEnterGrades} />
      {reviewFeedback && (
        <div className="ta-feedback" role="status">
          <Info size={18} />
          <p>
            <strong>Giảng viên yêu cầu chỉnh sửa</strong>
            {reviewFeedback.reviewNote || 'Vui lòng kiểm tra bảng điểm và gửi lại.'}
          </p>
        </div>
      )}
      <Card className="ta-grade-card">
        <div className="ta-grade-heading">
          <div>
            <h2>{draft.className}</h2>
            <p>{draft.title}</p>
          </div>
          <SearchBox value={query} onChange={setQuery} placeholder="Tìm học viên…" />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Chưa có học viên trong kỳ điểm"
            description="Giảng viên cần kiểm tra danh sách ghi danh của lớp."
          />
        ) : (
          <div className="ta-grade-table-wrap">
            <table className="ta-grade-table">
              <thead>
                <tr>
                  <th>HỌC VIÊN</th>
                  {SKILL_NAMES.map((name) => (
                    <th key={name}>{name.toLocaleUpperCase('vi')}</th>
                  ))}
                  <th>TRUNG BÌNH</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => (
                  <StudentGradeRow
                    key={row.studentId}
                    gradeRow={row}
                    inputLocked={inputLocked}
                    changeScore={changeScore}
                  />
                ))}
                {displayedRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="ta-no-results">
                      Không tìm thấy học viên phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="ta-grade-footer">
          <div>
            <strong>
              Đã nhập đủ {completedStudentCount} / {rows.length} học viên
            </strong>
            <DraftStatus saveStatus={saveStatus} hasChanges={hasChanges} savedAt={savedAt} />
          </div>
          <div className="ta-button-row">
            <Btn
              variant="muted"
              icon={Save}
              disabled={inputLocked || hasInvalidScores || saveStatus === 'saving'}
              onClick={saveManually}
            >
              Lưu nháp
            </Btn>
            <Btn
              icon={Send}
              disabled={
                inputLocked ||
                hasInvalidScores ||
                completedStudentCount !== rows.length ||
                !rows.length
              }
              onClick={() => setConfirmationVisible(true)}
            >
              Gửi giảng viên duyệt
            </Btn>
          </div>
        </div>
        {hasInvalidScores && (
          <p className="ta-workflow-error" role="alert">
            Điểm phải từ 0 đến 9, theo bước 0,5. Kiểm tra các ô được đánh dấu.
          </p>
        )}
        {error && (
          <div className="ta-save-error" role="alert">
            <p>{error}</p>
            {conflict && (
              <Btn
                variant="muted"
                size="sm"
                icon={RefreshCw}
                disabled={reloading}
                onClick={reloadAfterConflict}
              >
                Tải lại bản nháp
              </Btn>
            )}
          </div>
        )}
      </Card>
      <div className="ta-workflow-note">
        <Clock3 size={16} />
        <p>
          Bản nháp được lưu trong trình duyệt này. Bạn có thể nhập từng phần; cần đủ bốn kỹ năng của
          tất cả học viên trước khi gửi duyệt.
        </p>
      </div>
      {confirmationVisible && (
        <Dialog
          title="Gửi bảng điểm cho giảng viên?"
          subtitle={`${draft.className} · ${draft.title}`}
          onClose={() => !submitting && setConfirmationVisible(false)}
          size="sm"
        >
          <div className="ta-confirm-body">
            <p>
              Bảng điểm mẫu của <strong>{rows.length} học viên</strong> sẽ chuyển sang trạng thái
              chờ <strong>{draft.teacher}</strong> duyệt. Sau khi gửi, bạn chỉ có thể xem trong lúc
              chờ phê duyệt.
            </p>
            <p>Trong bản mẫu, thao tác này chỉ lưu trạng thái trên trình duyệt của bạn.</p>
          </div>
          <div className="u-modal__foot">
            <Btn
              variant="muted"
              disabled={submitting}
              onClick={() => setConfirmationVisible(false)}
            >
              Kiểm tra lại
            </Btn>
            <Btn icon={Send} disabled={submitting} onClick={submitForReview}>
              {submitting ? 'Đang gửi…' : 'Gửi duyệt'}
            </Btn>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function GradeGrantDetails({ draft, canEnterGrades }) {
  const status = GRANT_STATUSES[draft.state] ?? GRANT_STATUSES.expired;
  const title = draft.pending
    ? 'Bảng điểm đã gửi và đang chờ giảng viên duyệt'
    : canEnterGrades
      ? `Quyền nhập điểm đang mở đến ${formatDateTime(draft.closesAt)}`
      : 'Bảng điểm hiện ở chế độ xem';
  const statusLabel = draft.pending
    ? 'Chờ duyệt'
    : !canEnterGrades && draft.state === 'open'
      ? 'Đã hết hạn'
      : status.label;

  return (
    <div className={`ta-grading-banner ${!canEnterGrades ? 'is-closed' : ''}`}>
      <span className="ta-grading-banner-icon">
        <ShieldCheck size={23} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>
          Giảng viên {draft.teacher} · {formatDateTime(draft.opensAt)} –{' '}
          {formatDateTime(draft.closesAt)}
        </p>
        <small>Điểm bạn nhập sẽ gửi giảng viên duyệt trước khi vào bảng điểm lớp.</small>
      </div>
      <Chip tone={draft.pending ? 'amber' : canEnterGrades ? 'green' : status.tone}>
        {statusLabel}
      </Chip>
    </div>
  );
}

function StudentGradeRow({ gradeRow, inputLocked, changeScore }) {
  return (
    <tr>
      <td>
        <StudentIdentity name={gradeRow.name} code={gradeRow.code} />
      </td>
      {SKILL_NAMES.map((skillName, skillIndex) => {
        const value = gradeRow.scores[skillIndex];
        const invalidScore = !isValidScore(value);
        return (
          <td key={skillName}>
            <input
              className={`ta-score-input ${invalidScore ? 'is-invalid' : ''}`}
              type="number"
              inputMode="decimal"
              min="0"
              max="9"
              step="0.5"
              placeholder="—"
              aria-label={`${skillName} - ${gradeRow.name}`}
              aria-invalid={invalidScore}
              value={value}
              disabled={inputLocked}
              onChange={(event) => changeScore(gradeRow.studentId, skillIndex, event.target.value)}
            />
          </td>
        );
      })}
      <td>
        <strong className="ta-average">{calculateAverageScore(gradeRow.scores) ?? '—'}</strong>
      </td>
    </tr>
  );
}

function DraftStatus({ saveStatus, hasChanges, savedAt }) {
  let content = 'Điểm từ 0–9, bước 0,5 · Tự động lưu nháp';
  if (saveStatus === 'saving') content = 'Đang lưu nháp…';
  else if (hasChanges) content = 'Có thay đổi chưa lưu';
  else if (savedAt)
    content = (
      <>
        <Check size={13} /> Đã lưu nháp lúc {formatDateTime(savedAt)}
      </>
    );
  return (
    <span role="status" aria-live="polite">
      {content}
    </span>
  );
}
