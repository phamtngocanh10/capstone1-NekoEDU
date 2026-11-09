import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { BackLink, Btn, Card, Chip, Dialog, MiniStat } from '../../../../common/ui/index';
import { useGiangVien, useTieuDeTrang } from '../../layout/ngucanh';
import { apiGiangVien } from '../../../../api/giangvien';
import { KY_NANG } from '../dungchung/dulieu';
import { useLopGiangDay } from '../../layout/dulieulophoc';
import { ChonLop, LoiDuLieu, DangTai, HocVien, BangDuLieu, diemTrungBinh, useDuLieu } from '../dungchung/dungchung';

const PERMISSIONS = [
  ['attendance', 'Điểm danh hỗ trợ'],
  ['roster', 'Xem danh sách học viên'],
  ['documents', 'Tải tài liệu lên'],
];

export function DuyetDiemTroGiang() {
  const classes = useLopGiangDay();
  const { assistantId } = useParams();
  const [params] = useSearchParams();
  const classId = params.get('classId') || classes[0].id;
  const selectedClass = classes.find(classItem => classItem.id === classId);
  const navigate = useNavigate();
  const { notify } = useGiangVien();
  useTieuDeTrang('Duyệt điểm trợ giảng nhập', 'Kiểm tra điểm trước khi thêm vào bảng điểm lớp');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState('');

  async function loadSubmission() {
    const assistants = await apiGiangVien.assistants();
    const assistant = assistants.find(item => item.id === assistantId && item.classId === classId);
    const submission = await apiGiangVien.assistantSubmission(assistantId, classId);
    const grade = await apiGiangVien.grades(classId, submission.test);
    const roster = await apiGiangVien.roster(classId);
    return { assistant, submission, grade, roster };
  }
  const remote = useDuLieu(loadSubmission, [assistantId, classId]);

  async function reviewSubmission(approve) {
    setIsSaving(true);
    setError('');
    try {
      if (!approve && !reason.trim()) throw new Error('Nhập lý do trả lại trợ giảng.');
      const { submission } = remote.data;
      await apiGiangVien.reviewSubmission(assistantId, classId, {
        approve,
        test: submission.test,
        rows: submission.rows,
        reason: reason.trim(),
      });
      notify(approve ? 'Đã duyệt điểm. Bạn có thể xác nhận công bố trong Bảng điểm.' : 'Đã trả lại điểm cho trợ giảng');
      navigate('/lecturer/trogiang/yeucau');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (!remote.data) return <DangTai error={remote.error} retry={remote.reload} />;
  const { assistant, submission, grade, roster } = remote.data;
  if (!assistant?.pending) {
    return (
      <div className="u-page">
        <BackLink to="/lecturer/trogiang/yeucau">Yêu cầu nhập điểm</BackLink>
        <Card>Không có bảng điểm chờ duyệt cho trợ giảng này.</Card>
      </div>
    );
  }
  return (
    <div className="u-page lc-page">
      <BackLink to="/lecturer/trogiang/yeucau">Yêu cầu nhập điểm</BackLink>
      <Card>
        <div className="lc-toolbar">
          <div className="u-grow">
            <h2>{selectedClass?.name} · {submission.test}</h2>
            <p className="u-muted">Trợ giảng {assistant.name} · {roster.length} học viên</p>
          </div>
          <Chip tone="amber">Chờ bạn duyệt</Chip>
        </div>
        <p className="lc-info">Ô màu vàng là điểm khác bản nháp. Sau khi duyệt, bạn vẫn cần xác nhận để công bố.</p>
        <LoiDuLieu>{error}</LoiDuLieu>
        <BangDuLieu headings={['Học viên', ...KY_NANG, 'Trung bình', 'Ghi chú trợ giảng']}>
          {submission.rows.map(row => {
            const previousRow = grade.rows.find(item => item.studentId === row.studentId);
            const student = roster.find(item => item.id === row.studentId);
            return (
              <tr key={row.studentId}>
                <td><HocVien student={student} /></td>
                {row.scores.map((score, index) => {
                  const previousScore = previousRow?.scores[index];
                  const isChanged = previousScore !== score;
                  return (
                    <td key={index} className={isChanged ? 'lc-score-changed' : ''}>
                      {score}{isChanged && <small className="lc-block">trước: {previousScore || '—'}</small>}
                    </td>
                  );
                })}
                <td>{diemTrungBinh(row.scores)}</td>
                <td>{row.note || '—'}</td>
              </tr>
            );
          })}
        </BangDuLieu>
        <div className="lc-toolbar lc-actions">
          <Btn disabled={isSaving} variant="outline-danger" onClick={() => setReturnOpen(true)}>Trả lại trợ giảng</Btn>
          <Btn disabled={isSaving} onClick={() => reviewSubmission(true)}>Duyệt & thêm vào bảng điểm</Btn>
        </div>
      </Card>
      {returnOpen && (
        <Dialog title="Trả lại trợ giảng" onClose={() => setReturnOpen(false)}>
          <div className="lc-dialog-body">
            <label className="lc-field">Lý do<textarea rows={4} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>
            <LoiDuLieu>{error}</LoiDuLieu>
          </div>
          <div className="lc-dialog-footer">
            <Btn variant="ghost" onClick={() => setReturnOpen(false)}>Hủy</Btn>
            <Btn disabled={isSaving} onClick={() => reviewSubmission(false)}>Trả lại</Btn>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default function TroGiang({ requests = false }) {
  const classes = useLopGiangDay();
  useTieuDeTrang(requests ? 'Yêu cầu nhập điểm' : 'Trợ giảng của tôi', 'Quản lý trợ giảng, quyền nhập điểm và yêu cầu chờ duyệt');
  const remote = useDuLieu(() => apiGiangVien.assistants());
  const [modal, setModal] = useState(null);
  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { notify } = useGiangVien();

  function className(classId) {
    return classes.find(classItem => classItem.id === classId)?.name;
  }

  async function saveAssistant(assistant) {
    setIsSaving(true);
    setError('');
    try {
      const assistants = await apiGiangVien.saveAssistant(assistant);
      remote.setData(assistants);
      notify('Đã cập nhật trợ giảng');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function openPermission(assistant) {
    setSelectedAssistant(assistant);
    setModal('permission');
  }

  function togglePermission(assistant) {
    if (assistant.open) saveAssistant({ ...assistant, open: false });
    else openPermission(assistant);
  }

  function finishUpdate(assistants) {
    remote.setData(assistants);
    setModal(null);
  }

  if (!remote.data) return <DangTai error={remote.error} retry={remote.reload} />;
  const assistants = remote.data;
  const permissionRequests = assistants.filter(assistant => assistant.request);
  const pendingGrades = assistants.filter(assistant => assistant.pending);
  const waitingAssistants = assistants.filter(assistant => assistant.request || assistant.pending);
  const openCount = assistants.filter(assistant => assistant.open).length;

  return (
    <div className="u-page lc-page">
      {requests && <BackLink to="/lecturer/trogiang">Trợ giảng</BackLink>}
      <LoiDuLieu>{error}</LoiDuLieu>
      {!requests && (
        <>
          <div className="lc-stats">
            <MiniStat label="Trợ giảng đang hỗ trợ" value={assistants.length} />
            <MiniStat label="Đã mở quyền nhập điểm" value={openCount} tone="success" />
            <MiniStat label="Yêu cầu chờ duyệt" value={permissionRequests.length} tone="warning" />
            <MiniStat label="Điểm chờ duyệt" value={pendingGrades.length} />
          </div>
          <div className="lc-toolbar">
            <Btn variant="soft" to="/lecturer/trogiang/yeucau">Yêu cầu & điểm chờ duyệt ({waitingAssistants.length})</Btn>
            <span className="u-grow" />
            <Btn onClick={() => setModal('add')}>+ Thêm trợ giảng</Btn>
          </div>
          <Card>
            <h3 className="lc-section-title">Trợ giảng trong các lớp của tôi</h3>
            <BangDuLieu headings={['Trợ giảng', 'Lớp phụ trách', 'Điểm danh', 'Quyền nhập điểm', 'Yêu cầu', 'Thao tác']}>
              {assistants.map(assistant => {
                let requestStatus = '—';
                if (assistant.pending) {
                  requestStatus = <Btn variant="soft" to={`/lecturer/trogiang/duyet/${assistant.id}?classId=${assistant.classId}`}>Điểm chờ duyệt</Btn>;
                } else if (assistant.request) {
                  requestStatus = <Chip tone="amber">Xin mở quyền</Chip>;
                }
                return (
                  <tr key={`${assistant.id}:${assistant.classId}`}>
                    <td><HocVien student={{ id: assistant.email, name: assistant.name }} /></td>
                    <td>{className(assistant.classId)}</td>
                    <td>{assistant.permissions?.includes('attendance') ? 'Hỗ trợ' : 'Chưa mở'}</td>
                    <td>
                      <Chip tone={assistant.open ? 'green' : 'gray'}>{assistant.open ? 'Đang mở' : 'Chưa mở'}</Chip>
                      {assistant.open && <small className="lc-block u-muted">đến {assistant.end?.replace('T', ' ')}</small>}
                    </td>
                    <td>{requestStatus}</td>
                    <td>
                      <Btn variant={assistant.open ? 'danger-soft' : 'soft'} disabled={isSaving} onClick={() => togglePermission(assistant)}>
                        {assistant.open ? 'Thu hồi quyền' : 'Mở quyền nhập điểm'}
                      </Btn>
                    </td>
                  </tr>
                );
              })}
            </BangDuLieu>
          </Card>
        </>
      )}
      {requests && (
        <>
          <h3>Yêu cầu mở quyền nhập điểm ({permissionRequests.length})</h3>
          {permissionRequests.map(assistant => (
            <Card key={`${assistant.id}:${assistant.classId}`}>
              <div className="lc-toolbar">
                <HocVien student={{ id: 'Teaching Assistant', name: assistant.name }} />
                <span className="u-grow" /><Chip tone="amber">Chờ duyệt</Chip>
              </div>
              <p className="lc-comment-preview">Lý do: {assistant.requestNote || '—'}</p>
              <p className="u-muted">Lớp: {className(assistant.classId)} · {assistant.submissionTest || 'Yêu cầu mở quyền nhập điểm'}</p>
              <div className="lc-toolbar lc-actions">
                <Btn variant="outline-danger" disabled={isSaving} onClick={() => saveAssistant({ ...assistant, request: false, open: false })}>Từ chối</Btn>
                <Btn onClick={() => openPermission(assistant)}>Duyệt & mở quyền</Btn>
              </div>
            </Card>
          ))}
          <h3>Điểm do trợ giảng nhập, chờ duyệt ({pendingGrades.length})</h3>
          {pendingGrades.map(assistant => (
            <Card key={`${assistant.id}:${assistant.classId}`}>
              <div className="lc-toolbar">
                <div className="u-grow"><h3>{assistant.name}</h3><p className="u-muted">{className(assistant.classId)} · {assistant.submissionTest || 'Kiểm tra giữa kỳ'}</p></div>
                <Btn to={`/lecturer/trogiang/duyet/${assistant.id}?classId=${assistant.classId}`}>Xem & duyệt</Btn>
              </div>
            </Card>
          ))}
          {waitingAssistants.length === 0 && <Card>Không còn yêu cầu hoặc điểm chờ duyệt.</Card>}
        </>
      )}
      <p className="lc-info">Trợ giảng chỉ nhập điểm trong thời gian Manager đã đặt. Điểm trợ giảng nhập cần giảng viên duyệt trước khi công bố.</p>
      {modal === 'add' && <ThemTroGiang assistants={assistants} onClose={() => setModal(null)} onDone={finishUpdate} />}
      {modal === 'permission' && <MoQuyenNhapDiem assistant={selectedAssistant} onClose={() => setModal(null)} onDone={finishUpdate} />}
    </div>
  );
}

function ThemTroGiang({ assistants, onClose, onDone }) {
  const classes = useLopGiangDay();
  const candidates = useDuLieu(() => apiGiangVien.assistantCandidates());
  const [selectedId, setSelectedId] = useState('');
  const assistantId = selectedId || candidates.data?.[0]?.id || '';
  const [classId, setClassId] = useState(classes[0].id);
  const [permissions, setPermissions] = useState(['attendance', 'roster']);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function togglePermission(key, checked) {
    setPermissions(current => {
      if (checked) return [...current, key];
      return current.filter(permission => permission !== key);
    });
  }

  async function addAssistant(event) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const alreadyAssigned = assistants.some(assistant => assistant.id === assistantId && assistant.classId === classId);
      if (alreadyAssigned) throw new Error('Trợ giảng đã được phân công vào lớp này.');
      const assistant = candidates.data.find(item => item.id === assistantId);
      if (!assistant) throw new Error('Chọn một trợ giảng hợp lệ.');
      const updated = await apiGiangVien.saveAssistant({ ...assistant, classId, permissions, open: false, request: false, pending: false });
      onDone(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog title="Thêm trợ giảng" subtitle="Thêm trợ giảng vào lớp bạn phụ trách" onClose={onClose}>
      <form onSubmit={addAssistant}>
        <div className="lc-dialog-body">
          {!candidates.data ? (
            <DangTai error={candidates.error} retry={candidates.reload} />
          ) : (
            <label className="lc-field">
              Chọn trợ giảng
              <select className="lc-select" required value={assistantId} onChange={event => setSelectedId(event.target.value)}>
                {candidates.data.map(assistant => <option key={assistant.id} value={assistant.id}>{assistant.name} · Teaching Assistant</option>)}
              </select>
            </label>
          )}
          <label className="lc-field">Lớp phụ trách<ChonLop value={classId} onChange={setClassId} /></label>
          <h3>Quyền của trợ giảng</h3>
          {PERMISSIONS.map(([key, label]) => (
            <label key={key} className="lc-check">
              <input type="checkbox" checked={permissions.includes(key)} onChange={event => togglePermission(key, event.target.checked)} />
              {label}
            </label>
          ))}
          <p className="u-muted">Quyền nhập điểm được mở riêng sau khi trợ giảng gửi yêu cầu.</p>
          <LoiDuLieu>{error}</LoiDuLieu>
        </div>
        <div className="lc-dialog-footer">
          <Btn variant="ghost" onClick={onClose}>Hủy</Btn>
          <Btn type="submit" disabled={isSaving || !assistantId}>Thêm trợ giảng</Btn>
        </div>
      </form>
    </Dialog>
  );
}

function MoQuyenNhapDiem({ assistant, onClose, onDone }) {
  const classes = useLopGiangDay();
  const selectedClass = classes.find(classItem => classItem.id === assistant.classId);
  const windowRequest = useDuLieu(() => apiGiangVien.gradingWindow(assistant.classId), [assistant.classId]);
  const [selectedStart, setStart] = useState('');
  const [selectedEnd, setEnd] = useState('');
  const gradingWindow = windowRequest.data;
  const start = selectedStart || gradingWindow?.opensAt || '';
  const end = selectedEnd || gradingWindow?.closesAt || '';
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function savePermission(event) {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const invalidWindow = !gradingWindow || start >= end || end > gradingWindow.closesAt || start < gradingWindow.opensAt;
      if (invalidWindow) throw new Error('Thời gian không hợp lệ hoặc nằm ngoài kỳ nhập điểm của Manager.');
      const updated = await apiGiangVien.saveAssistant({ ...assistant, open: true, request: false, start, end });
      onDone(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog title="Mở quyền nhập điểm" subtitle="Cho phép trợ giảng nhập điểm trong thời gian nhất định" onClose={onClose}>
      <form onSubmit={savePermission}>
        <div className="lc-dialog-body">
          <p><strong>{assistant.name}</strong> · {selectedClass?.name}</p>
          {!gradingWindow ? (
            <DangTai error={windowRequest.error} retry={windowRequest.reload} />
          ) : (
            <>
              <p>Kỳ điểm: {gradingWindow.test}</p>
              <label className="lc-field">Mở lúc<input required type="datetime-local" className="lc-input" min={gradingWindow.opensAt} max={gradingWindow.closesAt} value={start} onChange={event => setStart(event.target.value)} /></label>
              <label className="lc-field">Đóng lúc<input required type="datetime-local" className="lc-input" min={start} max={gradingWindow.closesAt} value={end} onChange={event => setEnd(event.target.value)} /></label>
              <p className="lc-info">Giới hạn do Manager đặt: {gradingWindow.closesAt.replace('T', ' ')}. Điểm trợ giảng nhập cần giảng viên duyệt.</p>
            </>
          )}
          <LoiDuLieu>{error}</LoiDuLieu>
        </div>
        <div className="lc-dialog-footer">
          <Btn variant="ghost" onClick={onClose}>Hủy</Btn>
          <Btn type="submit" disabled={isSaving || !gradingWindow}>Mở quyền</Btn>
        </div>
      </form>
    </Dialog>
  );
}
