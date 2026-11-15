import {
  CheckCircle2,
  GraduationCap,
  HeartHandshake,
  MessageSquare,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { Card, CardHead, Chip } from '../../../../common/ui';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { EmptyState } from '../shared/DungChung';
import { formatDate, getCourseName } from '../shared/tienIch';
import ReviewForm from './BieuMauDanhGia';
import '../../styles/ca-nhan.css';

function ReviewScore({ review }) {
  const averageRating = (review.chatLuongGiangDay + review.coSoVatChat + review.hoTroTrungTam) / 3;
  return (
    <span
      className="sp-review-score"
      aria-label={`Đánh giá trung bình ${averageRating.toFixed(1)} trên 5 sao`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={14}
          fill={index + 1 <= Math.round(averageRating) ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      ))}
      <strong>{averageRating.toFixed(1)}/5</strong>
    </span>
  );
}

export default function Reviews() {
  const {
    data,
    student,
    enrolledCourses,
    submitCourseReview: submitReview,
    notify,
  } = useStudentParent();
  const reviews = data.danhGia
    .filter((review) => review.maHocVien === student.ma)
    .sort((previous, next) => new Date(next.ngayGui) - new Date(previous.ngayGui));

  return (
    <div className="sp-page sp-reviews">
      <div className="sp-split sp-reviews__top">
        <ReviewForm
          key={student.ma}
          enrolledCourses={enrolledCourses}
          student={student}
          submitReview={submitReview}
          notify={notify}
        />
        <aside className="sp-stack">
          <Card className="sp-review-benefits">
            <span className="sp-review-benefits__icon">
              <HeartHandshake size={24} />
            </span>
            <h2>Vì sao đánh giá của bạn quan trọng?</h2>
            <ul>
              <li>
                <GraduationCap size={19} />
                <span>Giúp trung tâm cải thiện chất lượng giảng dạy từng lớp học.</span>
              </li>
              <li>
                <CheckCircle2 size={19} />
                <span>Hỗ trợ Manager theo dõi hiệu quả giảng viên chính xác hơn.</span>
              </li>
              <li>
                <ShieldCheck size={19} />
                <span>Mọi đánh giá đều ẩn danh với giảng viên đứng lớp.</span>
              </li>
            </ul>
          </Card>
          <div className="sp-note sp-review-note">
            <MessageSquare size={19} />
            <span>Mỗi góp ý là một bước giúp trải nghiệm học tập của con tốt hơn.</span>
          </div>
        </aside>
      </div>

      <Card>
        <CardHead title="Đánh giá đã gửi" sub={`Lịch sử đánh giá của ${student.ten}`} />
        {reviews.length ? (
          <div className="sp-review-history">
            {reviews.map((review) => (
              <article className="sp-review-history__item" key={review.ma}>
                <div className="sp-review-history__top">
                  <div>
                    <strong>{getCourseName(data, review.maKhoa)}</strong>
                    <span>{formatDate(review.ngayGui)}</span>
                  </div>
                  <ReviewScore review={review} />
                </div>
                <p>{review.nhanXet}</p>
                <div className="sp-review-history__bottom">
                  <Chip tone="green" icon={CheckCircle2}>
                    Đã gửi
                  </Chip>
                  <span>
                    Giảng dạy {review.chatLuongGiangDay}/5 · Cơ sở vật chất {review.coSoVatChat}/5 ·
                    Hỗ trợ {review.hoTroTrungTam}/5
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Chưa có đánh giá"
            description="Đánh giá bạn gửi cho học viên này sẽ được lưu tại đây."
          />
        )}
      </Card>
    </div>
  );
}
