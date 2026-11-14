import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Search, X } from 'lucide-react';
import useClickOutside from '../../../common/useClickOutside.js';
import { assistantData } from '../data/duLieuTroGiang';
import { hasPermission, filterByQuery, useAsyncData } from '../components/shared/DungChung';
import { useAssistant } from './NguCanhTroGiang';

function ClassSearchResult({ classDetails, closeSearch }) {
  return (
    <Link to={`/assistant/lophoc/${classDetails.id}`} onClick={closeSearch}>
      <BookOpen size={16} />
      <span>
        <strong>{classDetails.name}</strong>
        <small>
          {classDetails.code} · {classDetails.teacher}
        </small>
      </span>
      <ChevronRight size={14} />
    </Link>
  );
}

function StudentSearchResult({ student, closeSearch }) {
  const initial = student.name?.trim().split(/\s+/).at(-1)?.charAt(0);
  const studentSearchTerm = encodeURIComponent(student.code || student.name);

  return (
    <Link
      to={`/assistant/lophoc/${student.classId}?student=${studentSearchTerm}`}
      onClick={closeSearch}
    >
      <span className="ta-search-initial">{initial}</span>
      <span>
        <strong>{student.name}</strong>
        <small>
          {student.code} · {student.className}
        </small>
      </span>
      <ChevronRight size={14} />
    </Link>
  );
}

function useStudentSearch(classes, isLoadEnabled) {
  const assignmentKey = classes
    .map((classItem) => `${classItem.id}:${classItem.size ?? 0}`)
    .sort()
    .join(',');
  const studentSource = useAsyncData(async () => {
    if (!isLoadEnabled) return [];
    const lists = await Promise.all(
      classes.map(async (classDetails) => {
        const students = await assistantData.getClassStudents(classDetails.id);
        return students.map((details) => ({
          ...details,
          classId: classDetails.id,
          className: classDetails.name,
        }));
      })
    );
    return lists.flat();
  }, [isLoadEnabled, assignmentKey]);

  // Gõ tiếp chỉ lọc danh sách đã đọc; không tạo bản sao dữ liệu cho mỗi từ khóa.
  const validClassIds = new Set(classes.map((classDetails) => String(classDetails.id)));
  return {
    items: isLoadEnabled
      ? (studentSource.data ?? []).filter((student) => validClassIds.has(String(student.classId)))
      : [],
    loading: isLoadEnabled && classes.length > 0 && studentSource.loading,
    loadError: isLoadEnabled ? studentSource.error : '',
  };
}

export default function GlobalSearch() {
  const { data, query, setQuery } = useAssistant();
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);
  const viewableClasses = data.classes.filter((classDetails) =>
    hasPermission(classDetails, 'roster')
  );
  const hasSearchTerm = Boolean(query.trim());
  const studentList = useStudentSearch(viewableClasses, isOpen && hasSearchTerm);

  useClickOutside(searchRef, () => setIsOpen(false), isOpen);
  const matchingClasses = hasSearchTerm
    ? filterByQuery(
        data.classes,
        query,
        (classDetails) => `${classDetails.name} ${classDetails.code}`
      ).slice(0, 4)
    : [];
  const matchingStudents = hasSearchTerm
    ? filterByQuery(studentList.items, query, (student) => `${student.name} ${student.code}`).slice(
        0,
        5
      )
    : [];
  const hasResults = matchingClasses.length > 0 || matchingStudents.length > 0;

  function closeSearch() {
    setIsOpen(false);
    setQuery('');
  }

  function handleSearchChange(event) {
    setQuery(event.target.value);
    setIsOpen(true);
  }

  return (
    <div className="ta-global-search" ref={searchRef}>
      <label className="search">
        <Search size={15} />
        <input
          placeholder="Tìm học viên, lớp học..."
          aria-label="Tìm học viên, lớp học"
          value={query}
          onChange={handleSearchChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
          }}
        />
        {query && (
          <button type="button" onClick={closeSearch} aria-label="Xóa tìm kiếm">
            <X size={13} />
          </button>
        )}
      </label>

      {isOpen && hasSearchTerm && (
        <div className="ta-search-results" role="region" aria-label="Kết quả tìm kiếm">
          {matchingClasses.length > 0 && <small>Lớp học</small>}
          {matchingClasses.map((classDetails) => (
            <ClassSearchResult
              key={classDetails.id}
              classDetails={classDetails}
              closeSearch={closeSearch}
            />
          ))}
          {matchingStudents.length > 0 && <small>Học viên</small>}
          {matchingStudents.map((student) => (
            <StudentSearchResult
              key={`${student.classId}-${student.id}`}
              student={student}
              closeSearch={closeSearch}
            />
          ))}
          {studentList.loading && <p role="status">Đang tìm học viên…</p>}
          {studentList.loadError && <p role="alert">{studentList.loadError}</p>}
          {!hasResults && !studentList.loading && !studentList.loadError && (
            <p>Không tìm thấy học viên hoặc lớp phù hợp.</p>
          )}
        </div>
      )}
    </div>
  );
}
