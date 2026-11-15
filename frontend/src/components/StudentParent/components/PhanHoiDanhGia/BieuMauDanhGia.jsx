import { useId, useState } from 'react';
import { Send, Star } from 'lucide-react';
import { Btn, Card, CardHead, SelectField, TextAreaField } from '../../../../common/ui';
import { EmptyState } from '../shared/DungChung';

const REVIEW_CRITERIA = [
  {
    ma: 'chatLuongGiangDay',
    ten: 'Chất lượng giảng dạy',
    moTa: 'Nội dung bài học và cách giảng dạy của giảng viên',
  },
  { ma: 'coSoVatChat', ten: 'Cơ sở vật chất', moTa: 'Phòng học, thiết bị và không gian học tập' },
  {
    ma: 'hoTroTrungTam',
    ten: 'Hỗ trợ từ trung tâm',
    moTa: 'Sự hỗ trợ và giải đáp từ đội ngũ NEKO EDU',
  },
];
const RATING_LABELS = ['Chưa hài lòng', 'Cần cải thiện', 'Bình thường', 'Hài lòng', 'Rất hài lòng'];

function StarRating({ name, description, value, onChange }) {
  const groupId = useId();
  return (
    <fieldset className="sp-rating-field" role="radiogroup" aria-label={name}>
      <legend>{name}</legend>
      <p>{description}</p>
      <div className="sp-rating-field__row">
        <div className="sp-stars">
          {RATING_LABELS.map((label, index) => {
            const score = index + 1;
            return (
              <label key={score} className="sp-star-choice" title={`${score}/5 — ${label}`}>
                <input
                  type="radio"
                  name={groupId}
                  value={score}
                  checked={value === score}
                  aria-label={`${score} sao — ${label}`}
                  onChange={() => onChange(score)}
                />
                <span className={score <= value ? 'sp-star is-on' : 'sp-star'}>
                  <Star
                    size={27}
                    fill={score <= value ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  />
                </span>
              </label>
            );
          })}
        </div>
        <span className="sp-rating-field__value" aria-live="polite">
          {value ? `${value}/5 · ${RATING_LABELS[value - 1]}` : 'Chọn mức đánh giá'}
        </span>
      </div>
    </fieldset>
  );
}

export default function ReviewForm({ enrolledCourses, student, submitReview, notify }) {
  const [courseId, setCourseId] = useState(enrolledCourses[0]?.ma ?? '');
  const [ratings, setRatings] = useState({
    chatLuongGiangDay: 0,
    coSoVatChat: 0,
    hoTroTrungTam: 0,
  });
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const selectedCourse =
    enrolledCourses.find((course) => course.ma === courseId) ?? enrolledCourses[0];

  function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (REVIEW_CRITERIA.some((criterion) => !ratings[criterion.ma])) {
      setError('Vui lòng chọn số sao cho cả ba tiêu chí trước khi gửi.');
      return;
    }
    if (!comment.trim()) {
      setError('Vui lòng chia sẻ thêm nhận xét của bạn.');
      return;
    }
    try {
      submitReview({ maKhoa: selectedCourse?.ma, ...ratings, nhanXet: comment.trim() });
      setRatings({ chatLuongGiangDay: 0, coSoVatChat: 0, hoTroTrungTam: 0 });
      setComment('');
      notify('Đã lưu đánh giá mẫu. Cảm ơn bạn đã chia sẻ trải nghiệm học tập!');
    } catch (submitError) {
      setError(submitError.message || 'Chưa lưu được đánh giá. Vui lòng thử lại.');
    }
  }

  if (!selectedCourse) {
    return (
      <Card>
        <EmptyState
          title="Chưa có lớp để đánh giá"
          description="Lớp đang theo học của học viên sẽ xuất hiện tại đây."
        />
      </Card>
    );
  }

  return (
    <Card className="sp-review-form">
      <CardHead
        title={`Đánh giá lớp ${selectedCourse.ten}`}
        sub={`Chia sẻ trải nghiệm học tập của ${student.ten}`}
      />
      <form onSubmit={handleSubmit}>
        <SelectField
          label="Lớp học"
          value={selectedCourse.ma}
          options={enrolledCourses.map((course) => ({ value: course.ma, label: course.ten }))}
          onChange={(event) => {
            setCourseId(event.target.value);
            setError('');
          }}
        />
        <div className="sp-review-form__criteria">
          {REVIEW_CRITERIA.map((criterion) => (
            <StarRating
              key={criterion.ma}
              name={criterion.ten}
              description={criterion.moTa}
              value={ratings[criterion.ma]}
              onChange={(score) =>
                setRatings((previousRatings) => ({ ...previousRatings, [criterion.ma]: score }))
              }
            />
          ))}
        </div>
        <TextAreaField
          label="Nhận xét thêm"
          value={comment}
          maxLength={1000}
          rows={4}
          placeholder={`Chia sẻ trải nghiệm học tập của ${student.ten}...`}
          onChange={(event) => setComment(event.target.value)}
        />
        <div className="sp-review-form__count">{comment.length}/1000 ký tự</div>
        {error && (
          <p className="sp-error" role="alert">
            {error}
          </p>
        )}
        <div className="sp-review-form__footer">
          <p>Đánh giá được lưu trong bản mẫu trên trình duyệt này.</p>
          <Btn type="submit" icon={Send}>
            Gửi đánh giá
          </Btn>
        </div>
      </form>
    </Card>
  );
}
