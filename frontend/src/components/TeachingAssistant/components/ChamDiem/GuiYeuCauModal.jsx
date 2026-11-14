import { useRef, useState } from 'react';
import { CalendarClock, Send, UserRound } from 'lucide-react';
import { Btn, Dialog, SelectField, TextAreaField, TextField } from '../../../../common/ui';
import { assistantData } from '../../data/duLieuTroGiang';
import { useAssistant } from '../../layout/NguCanhTroGiang';
import { formatDateTime, getErrorMessage } from '../shared/DungChung';

function inputDateTime(date) {
  if (!date) return '';
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(parsedDate)
    .replace(' ', 'T');
}

const parseVietnamDateTime = (value) =>
  new Date(`${value.length === 16 ? `${value}:00` : value}+07:00`);

export default function RequestGradingModal({ onClose, initialClassId = '', onSuccess }) {
  const { data, reloadData } = useAssistant();
  const [form, setForm] = useState({
    classId: initialClassId,
    assessmentId: '',
    startAt: '',
    endAt: '',
    note: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const assessments = data.periods.filter(
    (assessment) =>
      String(assessment.classId) === form.classId &&
      assessment.status !== 'PUBLISHED' &&
      new Date(assessment.closesAt) > new Date()
  );
  const selectedAssessment = assessments.find(
    (assessment) => String(assessment.assessmentId) === form.assessmentId
  );
  const selectedClass = data.classes.find((classItem) => String(classItem.id) === form.classId);

  function changeField(fieldName, value) {
    setForm((previousData) => ({ ...previousData, [fieldName]: value }));
    setError('');
  }

  function selectClass(classId) {
    setForm((previousData) => ({
      ...previousData,
      classId,
      assessmentId: '',
      startAt: '',
      endAt: '',
    }));
    setError('');
  }

  function selectAssessment(assessmentId) {
    const assessment = assessments.find(
      (assessment) => String(assessment.assessmentId) === assessmentId
    );
    const start = assessment ? Math.max(Date.now(), new Date(assessment.opensAt).getTime()) : null;
    setForm((previousData) => ({
      ...previousData,
      assessmentId,
      startAt: start ? inputDateTime(new Date(Math.ceil(start / 60000) * 60000)) : '',
      endAt: inputDateTime(assessment?.closesAt),
    }));
    setError('');
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (submittingRef.current) return;
    const { classId, assessmentId, startAt, endAt, note } = form;
    if (!selectedAssessment || !startAt || !endAt || !note.trim()) {
      setError('Vui lòng chọn lớp, kỳ điểm, thời gian và nhập lý do.');
      return;
    }
    const start = parseVietnamDateTime(startAt);
    const end = parseVietnamDateTime(endAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setError('Thời gian kết thúc phải hợp lệ và sau thời gian bắt đầu.');
      return;
    }
    if (
      start < new Date(selectedAssessment.opensAt) ||
      end > new Date(selectedAssessment.closesAt)
    ) {
      setError('Thời gian đề nghị phải nằm trong kỳ nhập điểm của lớp.');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      await assistantData.createGradingRequest({
        classId,
        assessmentId,
        from: start.toISOString(),
        to: end.toISOString(),
        note: note.trim(),
      });
      reloadData();
      onSuccess?.();
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Chưa gửi được yêu cầu. Vui lòng thử lại.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      title="Gửi yêu cầu nhập điểm"
      subtitle="Yêu cầu mẫu được lưu trong trình duyệt để xem trước quy trình"
      onClose={() => !submittingRef.current && onClose()}
      size="md"
    >
      <form onSubmit={submitRequest}>
        <fieldset className="u-form ta-request-form ta-request-fields" disabled={submitting}>
          <SelectField
            label="Lớp"
            required
            full
            value={form.classId}
            placeholder="Chọn lớp được phân công"
            options={data.classes.map((classItem) => ({
              value: String(classItem.id),
              label: classItem.name,
            }))}
            onChange={(event) => selectClass(event.target.value)}
          />
          <SelectField
            label="Kỳ điểm"
            required
            full
            value={form.assessmentId}
            placeholder="Chọn kỳ điểm"
            disabled={!form.classId}
            options={assessments.map((assessment) => ({
              value: String(assessment.assessmentId),
              label: assessment.title,
            }))}
            onChange={(event) => selectAssessment(event.target.value)}
          />
          {form.classId && !assessments.length && (
            <p className="ta-field-note" role="status">
              Lớp này chưa có kỳ điểm có thể gửi yêu cầu. Vui lòng liên hệ giảng viên phụ trách.
            </p>
          )}
          <TextField
            label="Giảng viên nhận yêu cầu"
            icon={UserRound}
            full
            readOnly
            value={selectedAssessment?.teacher || selectedClass?.teacher || ''}
            placeholder="Tự động theo lớp và kỳ điểm"
          />
          <TextField
            label="Cần nhập từ"
            type="datetime-local"
            icon={CalendarClock}
            required
            value={form.startAt}
            onChange={(event) => changeField('startAt', event.target.value)}
            disabled={!selectedAssessment}
            min={inputDateTime(selectedAssessment?.opensAt)}
            max={inputDateTime(selectedAssessment?.closesAt)}
          />
          <TextField
            label="Đến"
            type="datetime-local"
            icon={CalendarClock}
            required
            value={form.endAt}
            onChange={(event) => changeField('endAt', event.target.value)}
            disabled={!selectedAssessment}
            min={form.startAt || inputDateTime(selectedAssessment?.opensAt)}
            max={inputDateTime(selectedAssessment?.closesAt)}
          />
          {selectedAssessment && (
            <p className="ta-field-note">
              Kỳ nhập điểm: {formatDateTime(selectedAssessment.opensAt)} –{' '}
              {formatDateTime(selectedAssessment.closesAt)}
            </p>
          )}
          <TextAreaField
            label="Lý do / ghi chú"
            required
            value={form.note}
            onChange={(event) => changeField('note', event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Ví dụ: Em hỗ trợ nhập điểm bài kiểm tra giữa kỳ cho lớp."
          />
          {error && (
            <p className="ta-workflow-error" role="alert">
              {error}
            </p>
          )}
        </fieldset>
        <div className="u-modal__foot">
          <Btn variant="muted" disabled={submitting} onClick={onClose}>
            Hủy
          </Btn>
          <Btn type="submit" icon={Send} disabled={submitting || !selectedAssessment}>
            {submitting ? 'Đang gửi…' : 'Gửi yêu cầu'}
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}
