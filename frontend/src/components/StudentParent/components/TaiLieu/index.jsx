import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, FileAudio, FileText, FolderOpen } from 'lucide-react';
import { Card, Chip, Pills, SearchBox, SelectField } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { FileAttachment, SectionHeader, EmptyState } from '../shared/DungChung';
import { formatDate, filterByQuery, getCourseName } from '../shared/tienIch';
import '../../styles/hoc-tap.css';

const FILE_TYPES = [
  { value: '', label: 'Tất cả' },
  { value: 'PDF', label: 'PDF' },
  { value: 'MP3', label: 'Âm thanh' },
  { value: 'DOCX', label: 'Tài liệu Word' },
];

export default function LearningMaterials() {
  const { data, student, enrolledCourses } = useStudentParent();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('timkiem') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const [courseId, setCourseId] = useState(searchParams.get('khoa') ?? '');
  const [fileType, setFileType] = useState('');
  const previousStudentIdRef = useRef(student.ma);
  const courseIds = new Set(enrolledCourses.map((course) => course.ma));
  const validCourseId = courseIds.has(courseId) ? courseId : '';
  const materials = data.taiLieu.filter(
    (file) =>
      courseIds.has(file.maKhoa) &&
      (!validCourseId || file.maKhoa === validCourseId) &&
      (!fileType || file.loai === fileType)
  );
  const filteredMaterials = filterByQuery(
    materials,
    query,
    (file) => `${file.ten} ${getCourseName(data, file.maKhoa)}`
  ).sort((previous, next) => next.ngayDang.localeCompare(previous.ngayDang));

  useEffect(() => {
    setQuery(urlQuery);
    setCourseId(searchParams.get('khoa') ?? '');
  }, [urlQuery, searchParams]);

  useEffect(() => {
    if (previousStudentIdRef.current === student.ma) return;
    previousStudentIdRef.current = student.ma;
    setQuery('');
    setCourseId('');
    setFileType('');
    setSearchParams({}, { replace: true });
  }, [student.ma, setSearchParams]);

  return (
    <div className="sp-page sp-study-page">
      <Card className="sp-library-intro">
        <span className="sp-study-icon">
          <FolderOpen size={25} />
        </span>
        <div>
          <h2>Thư viện học tập</h2>
          <p>Tài liệu được giảng viên chia sẻ cho các khóa {student.ten} đang theo học.</p>
        </div>
        <Chip tone="blue">{materials.length} tài liệu</Chip>
      </Card>
      <div className="sp-toolbar sp-library-toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Tìm tài liệu..." />
        <SelectField
          label="Khóa học"
          value={validCourseId}
          onChange={(event) => setCourseId(event.target.value)}
          options={[
            { value: '', label: 'Tất cả khóa học' },
            ...enrolledCourses.map((course) => ({ value: course.ma, label: course.ten })),
          ]}
        />
      </div>
      <Pills items={FILE_TYPES} value={fileType} onChange={setFileType} />
      <SectionHeader
        title="Tài liệu của lớp"
        description={`${filteredMaterials.length} tài liệu phù hợp · Chỉ hiển thị các khóa học đang theo học`}
      />
      {filteredMaterials.length ? (
        <div className="sp-grid-3 sp-library-grid">
          {filteredMaterials.map((file) => {
            const Icon = file.loai === 'MP3' ? FileAudio : FileText;
            return (
              <Card
                className={`sp-library-file sp-library-file--${file.loai.toLowerCase()}`}
                key={file.ma}
              >
                <div className="sp-library-file__visual">
                  <Icon size={36} strokeWidth={1.5} />
                  <Chip
                    tone={file.loai === 'MP3' ? 'amber' : file.loai === 'DOCX' ? 'blue' : 'green'}
                  >
                    .{file.loai.toLowerCase()}
                  </Chip>
                </div>
                <FileAttachment file={file} />
                <div className="sp-library-file__metadata">
                  <span>
                    <BookOpen size={13} />
                    {getCourseName(data, file.maKhoa)}
                  </span>
                  <small>
                    {file.dungLuong} · {formatDate(file.ngayDang)}
                  </small>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Chưa có tài liệu phù hợp"
          description={
            query
              ? 'Thử tìm kiếm bằng từ khóa khác hoặc đổi bộ lọc.'
              : 'Tài liệu của những khóa học đang theo học sẽ xuất hiện tại đây.'
          }
        />
      )}
      <p className="sp-muted">
        Các tệp được tạo từ nội dung minh họa để bạn dùng thử chức năng xem và tải xuống.
      </p>
    </div>
  );
}
