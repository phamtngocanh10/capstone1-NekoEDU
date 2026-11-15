import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  MessageSquareQuote,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { BackLink, Btn, Card, Chip } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { FileAttachment, SectionHeader, EmptyState } from '../shared/DungChung';
import { formatDate, downloadPdfReport, getCourseName } from '../shared/tienIch';
import '../../styles/hoc-tap.css';

function getScoreRatio(score) {
  return Math.max(0, Math.min(10, score)) / 10;
}

function SkillsChart({ skills }) {
  return (
    <>
      <SectionHeader title="Điểm theo kỹ năng">
        <div className="sp-skill-legend">
          <span>
            <i />
            Bạn
          </span>
          <span>
            <i className="is-average" />
            Trung bình lớp
          </span>
        </div>
      </SectionHeader>
      <div className="sp-result-skills">
        {skills.map((skill) => (
          <div className="sp-result-skill" key={skill.ten}>
            <div>
              <strong>{skill.ten}</strong>
              <span>
                <b>{Number(skill.diem).toFixed(1)}</b>
                <small>TB lớp {Number(skill.trungBinhLop).toFixed(1)}</small>
              </span>
            </div>
            <div
              className="sp-result-skill__track"
              role="img"
              aria-label={`${skill.ten}: ${skill.diem}/10, trung bình lớp ${skill.trungBinhLop}/10`}
            >
              <span
                className="sp-result-skill__average"
                style={{ width: `${getScoreRatio(skill.trungBinhLop) * 100}%` }}
              />
              <span
                className="sp-result-skill__personal"
                style={{ width: `${getScoreRatio(skill.diem) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="sp-skill-scale" aria-hidden="true">
        {[0, 2, 4, 6, 8, 10].map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </>
  );
}

function ProgressChart({ results }) {
  const width = 320;
  const height = 180;
  const padding = 28;
  const baselineY = height - padding;
  const plotHeight = height - padding * 2;

  function getPointY(score) {
    return baselineY - getScoreRatio(score) * plotHeight;
  }

  const points = results.map((result, index) => ({
    x:
      results.length === 1
        ? width / 2
        : padding + (index / (results.length - 1)) * (width - padding * 2),
    y: getPointY(result.diemTong),
    ketQua: result,
  }));
  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <figure className="sp-result-trend">
      <svg
        viewBox={`0 0 ${width} ${height + 12}`}
        role="img"
        aria-label={`Tiến bộ điểm tổng: ${results.map((result) => `${formatDate(result.ngay)}, ${result.diemTong}/10`).join('; ')}`}
      >
        {[0, 5, 10].map((tick) => {
          const y = getPointY(tick);
          return (
            <g key={tick}>
              <line
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                className="sp-result-trend__grid"
              />
              <text x={5} y={y + 4}>
                {tick}
              </text>
            </g>
          );
        })}
        {points.length > 1 && (
          <polygon
            points={`${points[0].x},${baselineY} ${polylinePoints} ${points.at(-1).x},${baselineY}`}
            className="sp-result-trend__area"
          />
        )}
        <polyline points={polylinePoints} className="sp-result-trend__line" />
        {points.map(({ x, y, ketQua: result }) => (
          <g key={result.ma}>
            <circle cx={x} cy={y} r={4} className="sp-result-trend__point" />
            <text x={x} y={y - 12} textAnchor="middle" className="sp-result-trend__score">
              {Number(result.diemTong).toFixed(1)}
            </text>
            <text x={x} y={height} textAnchor="middle">
              {formatDate(result.ngay, { year: undefined })}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>Thang điểm 0–10 · Các bài kiểm tra đến ngày đang xem</figcaption>
    </figure>
  );
}

export default function ResultDetails() {
  const { maKetQua: resultId } = useParams();
  const { data, student } = useStudentParent();
  const [error, setError] = useState('');
  const result = data.ketQua.find(
    (resultItem) => resultItem.ma === resultId && resultItem.maHocVien === student.ma
  );

  if (!result)
    return (
      <div className="sp-page">
        <BackLink to="/student/ketqua">Điểm danh & Kết quả</BackLink>
        <EmptyState
          title="Không tìm thấy kết quả học tập"
          description={`Bài kiểm tra này không thuộc học viên ${student.ten} đang được chọn.`}
        >
          <Btn variant="soft" to="/student/ketqua">
            Xem kết quả của học viên
          </Btn>
        </EmptyState>
      </div>
    );

  const courseDetails = data.khoaHoc.find((course) => course.ma === result.maKhoa);
  const resultHistory = data.ketQua
    .filter(
      (resultItem) =>
        resultItem.maHocVien === student.ma &&
        resultItem.maKhoa === result.maKhoa &&
        resultItem.ngay <= result.ngay
    )
    .sort((previous, next) => previous.ngay.localeCompare(next.ngay));
  const attachment = data.taiLieu.find(
    (file) => file.ma === result.maTaiLieu && file.maKhoa === result.maKhoa
  );

  function downloadResultReport() {
    try {
      downloadPdfReport(`phieu-diem-${student.maSo}-${result.ma}.pdf`, result.tieuDe, [
        'NEKO EDU — PHIẾU ĐIỂM MẪU',
        `Học viên: ${student.ten} (${student.maSo})`,
        `Khóa học: ${getCourseName(data, result.maKhoa)}`,
        `Ngày kiểm tra: ${formatDate(result.ngay)}`,
        `Điểm tổng: ${Number(result.diemTong).toFixed(1)}/10 | Hạng ${result.hang}/${result.siSo}`,
        ...result.kyNang.map(
          (skill) =>
            `${skill.ten}: ${Number(skill.diem).toFixed(1)}/10 | Trung bình lớp ${Number(skill.trungBinhLop).toFixed(1)}`
        ),
        `Nhận xét của giảng viên: ${result.nhanXet}`,
        ...result.goiY.map((suggestion) => `Gợi ý: ${suggestion}`),
      ]);
      setError('');
    } catch (downloadError) {
      setError(downloadError.message || 'Chưa tải được phiếu điểm.');
    }
  }

  return (
    <div className="sp-page sp-study-page">
      <BackLink to="/student/ketqua">Điểm danh & Kết quả</BackLink>
      <Card className="sp-result-hero">
        <div className="sp-stack">
          <Chip tone="green" icon={CheckCircle2}>
            Đã công bố
          </Chip>
          <h2>{result.tieuDe}</h2>
          <p>
            {formatDate(result.ngay)} · {getCourseName(data, result.maKhoa)}
          </p>
          <span className="sp-study-meta">
            <Award size={15} />
            {student.ten} · {courseDetails?.giangVien}
          </span>
        </div>
        <div className="sp-result-total">
          <span>Điểm tổng</span>
          <strong>
            {Number(result.diemTong).toFixed(1)}
            <small>/ 10</small>
          </strong>
          <Chip tone="amber" icon={Trophy}>
            Hạng {result.hang} / {result.siSo}
          </Chip>
        </div>
        <Btn icon={Download} variant="soft" onClick={downloadResultReport}>
          Tải phiếu điểm (PDF)
        </Btn>
      </Card>
      {error && (
        <p className="sp-error" role="alert">
          {error}
        </p>
      )}

      <div className="sp-result-detail-grid">
        <Card className="sp-stack">
          <SkillsChart skills={result.kyNang} />
          <SectionHeader title="Nhận xét của giảng viên" />
          <div className="sp-teacher-comment">
            <MessageSquareQuote size={23} />
            <p>{result.nhanXet || 'Chưa có nhận xét chi tiết.'}</p>
            <small>
              {courseDetails?.giangVien} · {formatDate(result.ngay)}
            </small>
          </div>
          {attachment && (
            <div className="sp-stack">
              <SectionHeader title="Tệp đính kèm (1)" />
              <FileAttachment file={attachment} />
            </div>
          )}
        </Card>
        <aside className="sp-stack">
          <Card>
            <SectionHeader title="Tiến bộ điểm tổng">
              <TrendingUp size={17} />
            </SectionHeader>
            <ProgressChart results={resultHistory} />
          </Card>
          <Card className="sp-stack">
            <SectionHeader title="Gợi ý luyện tập" />
            <ul className="sp-result-suggestions">
              {result.goiY.map((suggestion) => (
                <li key={suggestion}>
                  <CheckCircle2 size={17} />
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
            <Btn variant="soft" icon={BookOpen} to={`/student/tailieu?khoa=${result.maKhoa}`}>
              Xem tài liệu gợi ý
            </Btn>
          </Card>
        </aside>
      </div>
    </div>
  );
}
