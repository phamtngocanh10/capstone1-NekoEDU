import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus } from "lucide-react";
import {
  Btn,
  Card,
  CardHead,
  Chip,
  DataTable,
  Progress,
} from "../../../../common/ui";
import { useManager } from "../../layout/ManagerContext";
import { STATE } from "./data";
import { getGradeWindows, saveGradeWindow } from '../../../../api/grades';
import { useDuLieu } from '../../../Lecturer/components/dungchung/dungchung';
import ThietLapModal from "./ThietLapModal";

export default function DiemSo() {
  const navigate = useNavigate();
  const { notify } = useManager();
  const remote = useDuLieu(getGradeWindows);
  const cards = remote.data ?? [];
  useEffect(() => { if (remote.error) notify(remote.error); }, [remote.error, notify]);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const saveSettings = async (values) => {
    try {
      const { id, ...settings } = values;
      remote.setData(await saveGradeWindow(id, settings));
      setSelectedCourse(null);
      notify("Đã lưu thiết lập thời gian điểm số");
    } catch (error) { notify(error.message); }
  };

  const columns = [
    {
      key: "name",
      label: "Khóa học",
      width: "17%",
      render: (course) => <strong>{course.name}</strong>,
    },
    { key: "term", label: "Kỳ điểm", width: "11%" },
    {
      key: "window",
      label: "Thời gian nhập điểm (giảng viên)",
      width: "24%",
      className: "u-tight",
      render: (course) => (
        <span className="u-strong" style={{ fontWeight: 500 }}>
          {course.window}
        </span>
      ),
    },
    {
      key: "release",
      label: "Công bố cho học viên",
      width: "18%",
      className: "u-tight",
    },
    {
      key: "progress",
      label: "Tiến độ",
      width: "13%",
      render: (course) => (
        <div className="ds-prog">
          <Progress
            value={course.published}
            max={course.total}
            color={STATE[course.state].bar}
            label={`Đã công bố ${course.published}/${course.total}`}
          />
          <b>
            {course.published}/{course.total}
          </b>
        </div>
      ),
    },
    {
      key: "state",
      label: "Trạng thái",
      width: "12%",
      render: (course) => (
        <Chip tone={STATE[course.state].tone}>{STATE[course.state].label}</Chip>
      ),
    },
    {
      key: "actions",
      label: "Thao tác",
      width: "10%",
      render: (course) => (
        <span onClick={(e) => e.stopPropagation()}>
          {course.state === "closed" ? (
            <Btn
              variant="ghost"
              size="md"
              onClick={() => setSelectedCourse(course)}
            >
              Mở lại
            </Btn>
          ) : (
            <Btn variant="soft" size="md" onClick={() => setSelectedCourse(course)}>
              Thiết lập
            </Btn>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="u-page">
      <div className="u-grid u-grid--4">
        {cards.map((course) => (
          <button
            key={course.id}
            type="button"
            className="ds-course"
            style={{ "--accent": course.accent }}
            onClick={() => navigate(`/diemdanh/khoahoc/${course.id}`)}
          >
            <div className="ds-course__top">
              <span className="u-stat__icon">
                <BookOpen size={16} />
              </span>
              <div>
                <strong>{course.name}</strong>
                <small>{course.meta}</small>
              </div>
            </div>
            <div className="ds-course__row">
              <Chip tone={STATE[course.state].tone}>{STATE[course.state].label}</Chip>
              <span>Hạn {course.deadline}</span>
            </div>
            <span className="u-muted" style={{ fontSize: 11 }}>
              Đã công bố {course.published} / {course.total} lớp
            </span>
            <Progress
              value={course.published}
              max={course.total}
              color={STATE[course.state].bar}
              label="Tiến độ công bố"
            />
          </button>
        ))}
      </div>

      <Card>
        <CardHead title="Lịch nhập điểm theo khóa học">
          <Btn icon={Plus} size="md" disabled={!cards.length} onClick={() => setSelectedCourse(cards[0])}>
            Thiết lập thời gian
          </Btn>
        </CardHead>
        <DataTable
          columns={columns}
          rows={cards}
          chevron={false}
          onRowClick={(course) => navigate(`/diemdanh/khoahoc/${course.id}`)}
        />
      </Card>
      <p className="u-faint" style={{ fontSize: 11.5, padding: "0 8px" }}>
        Giảng viên tự nhập và xác nhận điểm trong thời gian bạn thiết lập · Nhấn
        vào khóa học để xem tiến độ từng lớp
      </p>

      {selectedCourse && (
        <ThietLapModal
          course={selectedCourse}
          courses={cards}
          onSubmit={saveSettings}
          onClose={() => setSelectedCourse(null)}
        />
      )}
    </div>
  );
}
