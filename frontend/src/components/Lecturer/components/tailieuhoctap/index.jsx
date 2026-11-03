import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, FileText, Plus, Upload, Pencil, Trash2 } from 'lucide-react';
import { BackLink, Btn, Card, Dialog } from '../../../../common/ui/index';
import { useGiangVien, useTieuDeTrang } from '../../layout/ngucanh';
import { apiGiangVien } from '../../../../api/giangvien';
import { useLopGiangDay } from '../../layout/dulieulophoc';
import { ChonLop, LoiDuLieu, DangTai, taiTep, useDuLieu } from '../dungchung/dungchung';

const ACCEPTED = ['pdf', 'docx', 'pptx', 'mp3'];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default function TaiLieuHocTap() {
  const classes = useLopGiangDay();
  const remote = useDuLieu(() => apiGiangVien.documents());
  const [query, setQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const navigate = useNavigate();

  function classNames(classIds, separator) {
    return classIds.map(id => classes.find(classItem => classItem.id === id)?.name).join(separator);
  }
  const documents = remote.data?.filter(document => {
    const text = `${document.name} ${classNames(document.classIds, ' ')}`;
    return text.toLowerCase().includes(query.toLowerCase());
  }) ?? [];

  function finishUpload() {
    setUploadOpen(false);
    remote.reload();
  }

  return (
    <div className="u-page lc-page">
      <div className="lc-toolbar">
        <input className="lc-input u-grow" aria-label="Tìm tài liệu" placeholder="Tìm tài liệu theo tên, lớp học…" value={query} onChange={event => setQuery(event.target.value)} />
        <Btn icon={Plus} onClick={() => setUploadOpen(true)}>Tải tài liệu mới</Btn>
      </div>
      {!remote.data && <DangTai error={remote.error} retry={remote.reload} />}
      {remote.data && (
        <div className="lc-grid lc-grid--three">
          {documents.map(document => {
            const extension = document.name.split('.').at(-1);
            return (
              <button className="lc-document-card" key={document.id} onClick={() => navigate(`/lecturer/tailieu/${document.id}`)}>
                <span className={`lc-file-icon is-${extension}`}><FileText size={25} /><small>.{extension}</small></span>
                <strong>{document.name}</strong>
                <p>{classNames(document.classIds, ', ')}</p>
                <small>{document.size} · {document.date.split('-').reverse().join('/')}</small>
              </button>
            );
          })}
        </div>
      )}
      {remote.data && documents.length === 0 && <Card>Không tìm thấy tài liệu.</Card>}
      {uploadOpen && <TaiTaiLieu onClose={() => setUploadOpen(false)} onDone={finishUpload} />}
    </div>
  );
}

function TaiTaiLieu({ onClose, onDone }) {
  const classes = useLopGiangDay();
  const [classId, setClassId] = useState(classes[0].id);
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  function selectFile(nextFile) {
    setError('');
    if (!nextFile) return;
    const extension = nextFile.name.split('.').at(-1).toLowerCase();
    if (!ACCEPTED.includes(extension) || nextFile.size > MAX_FILE_SIZE || !nextFile.size) {
      setError('Chọn tệp PDF, DOCX, PPTX hoặc MP3, dung lượng từ 1 byte đến 20 MB.');
      setFile(null);
      return;
    }
    setFile(nextFile);
    setName(nextFile.name);
  }

  function dropFile(event) {
    event.preventDefault();
    selectFile(event.dataTransfer.files[0]);
  }

  async function uploadDocument(event) {
    event.preventDefault();
    setError('');
    setIsUploading(true);
    try {
      if (!file || !name.trim()) throw new Error('Chọn tệp và nhập tên tài liệu.');
      const extension = file.name.split('.').at(-1).toLowerCase();
      let displayName = name.trim();
      if (!name.toLowerCase().endsWith('.' + extension)) displayName += '.' + extension;
      await apiGiangVien.uploadDocument(file, { name: displayName, classIds: [classId] });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog title="Tải tài liệu học tập mới" onClose={onClose}>
      <form onSubmit={uploadDocument}>
        <div className="lc-dialog-body">
          <label className="lc-field">Lớp học<ChonLop value={classId} onChange={setClassId} /></label>
          <label className="lc-field">
            Tên hiển thị tài liệu
            <input className="lc-input" required maxLength={200} value={name} onChange={event => setName(event.target.value)} />
          </label>
          <label className="lc-upload-link" onDragOver={event => event.preventDefault()} onDrop={dropFile}>
            <Upload size={28} />
            <strong>Kéo thả file vào đây hoặc bấm để chọn</strong>
            <input aria-label="Chọn tài liệu" type="file" accept=".pdf,.docx,.pptx,.mp3" onChange={event => selectFile(event.target.files[0])} />
            <span>PDF, DOCX, PPTX, MP3 — tối đa 20 MB</span>
            {file && <strong>{file.name}</strong>}
          </label>
          <LoiDuLieu>{error}</LoiDuLieu>
        </div>
        <div className="lc-dialog-footer">
          <Btn variant="ghost" onClick={onClose}>Hủy</Btn>
          <Btn type="submit" disabled={isUploading || !file}>{isUploading ? 'Đang tải…' : 'Tải lên & Chia sẻ'}</Btn>
        </div>
      </form>
    </Dialog>
  );
}

export function ChiTietTaiLieu() {
  const classes = useLopGiangDay();
  const { documentId } = useParams();
  const remote = useDuLieu(() => apiGiangVien.documents());
  const document = remote.data?.find(item => item.id === documentId);
  useTieuDeTrang('Chi tiết tài liệu', document?.name ?? 'Thông tin và lịch sử hoạt động tài liệu');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [action, setAction] = useState(null);
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const { notify } = useGiangVien();

  async function runAction(work) {
    setError('');
    setIsBusy(true);
    try {
      await work();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function updateDocument(changes) {
    const updated = await apiGiangVien.updateDocument({ ...document, ...changes });
    remote.setData(current => current.map(item => item.id === updated.id ? updated : item));
  }

  function downloadDocument() {
    runAction(async () => {
      const blob = await apiGiangVien.downloadDocument(document.id);
      taiTep(blob, document.name);
      await updateDocument({
        downloads: document.downloads + 1,
        events: [...document.events, `Tải xuống: ${new Date().toLocaleString('vi-VN')}`],
      });
    });
  }

  function openRename() {
    setAction('rename');
    setName(document.name);
  }

  function changeClass(classId, checked) {
    let classIds = document.classIds.filter(id => id !== classId);
    if (checked) classIds = [...document.classIds, classId];
    if (!classIds.length) {
      setError('Tài liệu phải áp dụng cho ít nhất một lớp.');
      return;
    }
    runAction(() => updateDocument({ classIds }));
  }

  function confirmAction() {
    runAction(async () => {
      if (action === 'delete') {
        await apiGiangVien.deleteDocument(document.id);
        navigate('/lecturer/tailieu');
        notify('Đã xóa tài liệu');
        return;
      }
      if (!name.trim()) throw new Error('Tên tài liệu không được để trống.');
      const extension = document.name.split('.').at(-1);
      let displayName = name.trim();
      if (!displayName.toLowerCase().endsWith('.' + extension.toLowerCase())) displayName += '.' + extension;
      await updateDocument({ name: displayName });
      setAction(null);
    });
  }

  if (!remote.data) return <DangTai error={remote.error} retry={remote.reload} />;
  if (!document) return <DangTai error="Tài liệu không tồn tại hoặc đã được xóa." />;
  const isRenaming = action === 'rename';

  return (
    <div className="u-page lc-page">
      <BackLink to="/lecturer/tailieu">Tài liệu học tập</BackLink>
      <LoiDuLieu>{error}</LoiDuLieu>
      <Card>
        <div className="lc-toolbar">
          <span className="lc-card-icon"><FileText size={32} /></span>
          <div className="u-grow">
            <h2>{document.name}</h2>
            <p className="u-muted">Tải lên {document.date.split('-').reverse().join('/')} · {document.size} · {document.downloads} lượt tải</p>
          </div>
          <Btn disabled={isBusy} icon={Download} onClick={downloadDocument}>Tải xuống</Btn>
          <Btn variant="soft" icon={Pencil} onClick={openRename}>Đổi tên tệp</Btn>
        </div>
      </Card>
      <div className="lc-grid lc-grid--two">
        <Card>
          <h3 className="lc-section-title">Áp dụng cho lớp</h3>
          {classes.map(classItem => (
            <label className="lc-check" key={classItem.id}>
              <input type="checkbox" checked={document.classIds.includes(classItem.id)} disabled={isBusy} onChange={event => changeClass(classItem.id, event.target.checked)} />
              {classItem.name}
            </label>
          ))}
        </Card>
        <Card>
          <h3 className="lc-section-title">Lịch sử hoạt động</h3>
          {document.events.map((event, index) => <p className="lc-comment-preview" key={index}>{event}</p>)}
        </Card>
      </div>
      <Btn variant="outline-danger" icon={Trash2} onClick={() => setAction('delete')}>Gỡ khỏi lớp / Xóa</Btn>
      {action && (
        <Dialog title={isRenaming ? 'Đổi tên tài liệu' : 'Xóa tài liệu?'} onClose={() => setAction(null)}>
          <div className="lc-dialog-body">
            {isRenaming ? (
              <label className="lc-field">Tên tài liệu<input className="lc-input" autoFocus maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label>
            ) : (
              <p>Tài liệu “{document.name}” sẽ được gỡ khỏi tất cả các lớp đã chọn.</p>
            )}
            <LoiDuLieu>{error}</LoiDuLieu>
          </div>
          <div className="lc-dialog-footer">
            <Btn variant="ghost" onClick={() => setAction(null)}>Hủy</Btn>
            <Btn disabled={isBusy} variant={action === 'delete' ? 'danger' : 'primary'} onClick={confirmAction}>Xác nhận</Btn>
          </div>
        </Dialog>
      )}
    </div>
  );
}
