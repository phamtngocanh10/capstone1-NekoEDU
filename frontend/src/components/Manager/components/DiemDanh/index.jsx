import { useState } from "react";
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
import { STATE, scoreStore, updateCard } from "./data";
import ThietLapModal from "./ThietLapModal";

export default function DiemSo() {
  const navigate = useNavigate();
  const { notify } = useManager();
  const cards = scoreStore.use();
  const [setup, setSetup] = useState(null);

  const save = (v) => {
    updateCard(v.id, {
      term: v.term,
      window: v.window,
      deadline: v.deadline,
      release: v.release,
      note: v.note,
    });
    setSetup(null);
    notify("Đã lưu thiết lập thời gian điểm số");
  };

  const columns = [
    {
      key: "name",
      label: "Khóa học",
      width: "17%",
      render: (c) => <strong>{c.name}</strong>,
    },
    { key: "term", label: "Kỳ điểm", width: "11%" },
    {
      key: "window",
      label: "Thời gian nhập điểm (giảng viên)",
      width: "24%",
      className: "u-tight",
      render: (c) => (
        <span className="u-strong" style={{ fontWeight: 500 }}>
          {c.window}
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
      render: (c) => (
        <div className="ds-prog">
          <Progress
            value={c.published}
            max={c.total}
            color={STATE[c.state].bar}
            label={`Đã công bố ${c.published}/${c.total}`}
          />
          <b>
            {c.published}/{c.total}
          </b>
        </div>
      ),
    },
    {
      key: "state",
      label: "Trạng thái",
      width: "12%",
      render: (c) => (
        <Chip tone={STATE[c.state].tone}>{STATE[c.state].label}</Chip>
      ),
    },
    {
      key: "actions",
      label: "Thao tác",
      width: "10%",
      render: (c) => (
        <span onClick={(e) => e.stopPropagation()}>
          {c.state === "closed" ? (
            <Btn
              variant="ghost"
              size="md"
              onClick={() => {
                updateCard(c.id, { state: "open" });
                notify(`Đã mở lại nhập điểm khóa ${c.name}`);
              }}
            >
              Mở lại
            </Btn>
          ) : (
            <Btn variant="soft" size="md" onClick={() => setSetup(c)}>
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
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            className="ds-course"
            style={{ "--accent": c.accent }}
            onClick={() => navigate(`/diemdanh/khoahoc/${c.id}`)}
          >
            <div className="ds-course__top">
              <span className="u-stat__icon">
                <BookOpen size={16} />
              </span>
              <div>
                <strong>{c.name}</strong>
                <small>{c.meta}</small>
              </div>
            </div>
            <div className="ds-course__row">
              <Chip tone={STATE[c.state].tone}>{STATE[c.state].label}</Chip>
              <span>Hạn {c.deadline}</span>
            </div>
            <span className="u-muted" style={{ fontSize: 11 }}>
              Đã công bố {c.published} / {c.total} lớp
            </span>
            <Progress
              value={c.published}
              max={c.total}
              color={STATE[c.state].bar}
              label="Tiến độ công bố"
            />
          </button>
        ))}
      </div>

      <Card>
        <CardHead title="Lịch nhập điểm theo khóa học">
          <Btn icon={Plus} size="md" onClick={() => setSetup(cards[0])}>
            Thiết lập thời gian
          </Btn>
        </CardHead>
        <DataTable
          columns={columns}
          rows={cards}
          chevron={false}
          onRowClick={(c) => navigate(`/diemdanh/khoahoc/${c.id}`)}
        />
      </Card>
      <p className="u-faint" style={{ fontSize: 11.5, padding: "0 8px" }}>
        Giảng viên tự nhập và xác nhận điểm trong thời gian bạn thiết lập · Nhấn
        vào khóa học để xem tiến độ từng lớp
      </p>

      {setup && (
        <ThietLapModal
          course={setup}
          onSubmit={save}
          onClose={() => setSetup(null)}
        />
      )}
    </div>
  );
}
