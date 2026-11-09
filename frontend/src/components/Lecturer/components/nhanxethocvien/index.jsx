import { useState } from 'react';
import { Btn, Card, Dialog } from '../../../../common/ui/index';
import { useGiangVien } from '../../layout/ngucanh';
import { apiGiangVien } from '../../../../api/giangvien';
import { useLopGiangDay } from '../../layout/dulieulophoc';
import { ChonLop, LoiDuLieu, DangTai, HocVien, TimKiem, khopTimKiem, useDuLieu, hienNgayGio } from '../dungchung/dungchung';

export default function NhanXetHocVien() {
  const classes = useLopGiangDay();
  const [classId, setClassId] = useState(classes[0].id);
  const [query, setQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const { notify } = useGiangVien();
  const selectedClass = classes.find(classItem => classItem.id === classId);

  async function loadComments() {
    const roster = await apiGiangVien.roster(classId);
    const comments = await apiGiangVien.comments(classId);
    return { roster, comments };
  }
  const remote = useDuLieu(loadComments, [classId]);
  const students = remote.data?.roster.filter(student => khopTimKiem(student, query)) ?? [];

  function openComment(student) {
    setSelectedStudent(student);
    setText('');
    setError('');
  }

  async function saveComment(event) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      if (!text.trim()) throw new Error('Vui lòng nhập nội dung nhận xét.');
      const comment = await apiGiangVien.addComment({ classId, studentId: selectedStudent.id, text: text.trim() });
      remote.setData(current => ({ ...current, comments: [comment, ...current.comments] }));
      setSelectedStudent(null);
      notify('Đã lưu nhận xét học viên');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="u-page lc-page">
      <div className="lc-toolbar">
        <ChonLop value={classId} onChange={setClassId} />
        <TimKiem value={query} onChange={setQuery} />
      </div>
      {!remote.data && <DangTai error={remote.error} retry={remote.reload} />}
      {remote.data && students.map(student => {
        const comments = remote.data.comments.filter(comment => comment.studentId === student.id);
        return (
          <Card key={student.id}>
            <div className="lc-toolbar">
              <HocVien student={student} />
              <span className="u-grow" />
              <Btn variant="soft" onClick={() => openComment(student)}>Thêm nhận xét</Btn>
            </div>
            {comments.map(comment => (
              <div className="lc-comment-preview" key={comment.id}>
                <small className="u-muted">{hienNgayGio(comment.date)}</small>
                <p>{comment.text}</p>
              </div>
            ))}
            {comments.length === 0 && <p className="u-muted lc-comment-preview">Chưa có nhận xét.</p>}
          </Card>
        );
      })}
      {remote.data && students.length === 0 && <Card>Không tìm thấy học viên.</Card>}
      {selectedStudent && (
        <Dialog title="Thêm nhận xét" subtitle={`${selectedStudent.name} · ${selectedClass.name}`} onClose={() => setSelectedStudent(null)}>
          <form onSubmit={saveComment}>
            <div className="lc-dialog-body">
              <label className="lc-field">
                Nội dung nhận xét
                <textarea required autoFocus maxLength={2000} rows={6} value={text} onChange={event => setText(event.target.value)} placeholder="Ghi nhận tiến bộ và nội dung cần luyện tập…" />
              </label>
              <small className="u-muted">{text.length}/2000 ký tự</small>
              <LoiDuLieu>{error}</LoiDuLieu>
            </div>
            <div className="lc-dialog-footer">
              <Btn variant="ghost" onClick={() => setSelectedStudent(null)}>Hủy</Btn>
              <Btn type="submit" disabled={isSaving}>{isSaving ? 'Đang lưu…' : 'Lưu nhận xét'}</Btn>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
