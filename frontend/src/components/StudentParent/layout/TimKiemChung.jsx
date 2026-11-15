import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, FileText, Search } from 'lucide-react';
import useClickOutside from '../../../common/useClickOutside';
import { useStudentParent } from './NguCanhHocVien';
import { filterByQuery } from '../components/shared/tienIch';

export default function GlobalSearch() {
  const { data, student, enrolledCourses } = useStudentParent();
  const { pathname } = useLocation();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setIsOpen(false), isOpen);
  useEffect(() => {
    setQuery('');
    setIsOpen(false);
  }, [pathname, student.ma]);
  const courseIds = new Set(enrolledCourses.map((course) => course.ma));
  const files = data.taiLieu.filter((file) => courseIds.has(file.maKhoa));
  const matchingCourses = query.trim()
    ? filterByQuery(enrolledCourses, query, (course) => course.ten).slice(0, 3)
    : [];
  const matchingFiles = query.trim()
    ? filterByQuery(files, query, (file) => file.ten).slice(0, 4)
    : [];
  return (
    <div className="sp-search" ref={containerRef}>
      <label className="search">
        <Search size={15} />
        <input
          type="search"
          aria-label="Tìm khóa học, tài liệu"
          placeholder="Tìm khóa học, tài liệu..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
      </label>
      {isOpen && query.trim() && (
        <div className="sp-search-results" role="region" aria-label="Kết quả tìm kiếm">
          {matchingCourses.map((course) => (
            <Link
              key={course.ma}
              to={`/student/khoahoc/${course.ma}`}
              onClick={() => setIsOpen(false)}
            >
              <BookOpen size={17} />
              <span>
                {course.ten}
                <small>Khóa học · {course.nhom}</small>
              </span>
            </Link>
          ))}
          {matchingFiles.map((file) => (
            <Link
              key={file.ma}
              to={`/student/tailieu?timkiem=${encodeURIComponent(file.ten)}`}
              onClick={() => setIsOpen(false)}
            >
              <FileText size={17} />
              <span>
                {file.ten}
                <small>Tài liệu · {file.loai}</small>
              </span>
            </Link>
          ))}
          {!matchingCourses.length && !matchingFiles.length && (
            <p>Không tìm thấy khóa học hoặc tài liệu phù hợp.</p>
          )}
        </div>
      )}
    </div>
  );
}
