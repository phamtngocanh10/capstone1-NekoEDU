import { useState } from "react";
import { BookOpen, Calendar } from "lucide-react";
import {
  Btn,
  CheckRow,
  Dialog,
  RadioChips,
  SelectField,
  TextField,
} from "../../../../common/ui";
import { COURSE_CARDS } from "./data";

const toLong = (s) =>
  s.replace(/^(\d{2}\/\d{2}) (\d{2}:\d{2})$/, "$1/2026 · $2");
export const toShort = (s) =>
  s.replace(/^(\d{2}\/\d{2})\/\d{4} · (\d{2}:\d{2})$/, "$1 $2");

export default function ThietLapModal({ course, onSubmit, onClose }) {
  const [id, setId] = useState(course.id);
  const [term, setTerm] = useState(`${course.term}/2026`);
  const [open, setOpen] = useState(toLong(course.window.split(" → ")[0]));
  const [close, setClose] = useState(toLong(course.window.split(" → ")[1]));
  const [mode, setMode] = useState(
    course.release.startsWith("Hẹn") ? "timed" : "confirm",
  );
  const [release, setRelease] = useState("21/09/2026 · 08:00");
  const [remind, setRemind] = useState(true);
  const [autoLock, setAutoLock] = useState(true);

  return (
    <Dialog
      title="Thiết lập thời gian điểm số"
      subtitle="Đặt thời gian giảng viên nhập điểm và thời điểm công bố cho học viên"
      onClose={onClose}
    >
      <div className="u-form">
        <SelectField
          label="Khóa học"
          icon={BookOpen}
          options={COURSE_CARDS.map((c) => ({ value: c.id, label: c.name }))}
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <SelectField
          label="Kỳ điểm"
          icon={Calendar}
          options={["Giữa kỳ T9/2026", "Cuối kỳ T9/2026"]}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <div className="u-field u-field--full">
          <span
            className="u-field__label"
            style={{ color: "var(--primary-2)" }}
          >
            Thời gian giảng viên nhập điểm
          </span>
        </div>
        <TextField
          label="Mở lúc"
          icon={Calendar}
          value={open}
          onChange={(e) => setOpen(e.target.value)}
        />
        <TextField
          label="Đóng lúc"
          icon={Calendar}
          value={close}
          onChange={(e) => setClose(e.target.value)}
        />
        <RadioChips
          label="Công bố điểm cho học viên"
          full
          cols={2}
          value={mode}
          onChange={setMode}
          options={[
            { value: "confirm", label: "Ngay khi giảng viên xác nhận" },
            { value: "timed", label: "Hẹn giờ" },
          ]}
        />
        <TextField
          label="Giờ công bố (khi chọn Hẹn giờ)"
          icon={Calendar}
          full
          disabled={mode !== "timed"}
          value={release}
          onChange={(e) => setRelease(e.target.value)}
        />
        <div className="u-field u-field--full" style={{ gap: 10 }}>
          <CheckRow checked={remind} onChange={setRemind}>
            Nhắc giảng viên trước hạn 1 ngày
          </CheckRow>
          <CheckRow checked={autoLock} onChange={setAutoLock}>
            Tự động khóa nhập điểm khi hết hạn
          </CheckRow>
        </div>
      </div>
      <div className="u-modal__foot">
        <Btn variant="ghost" size="sq" onClick={onClose}>
          Hủy
        </Btn>
        <Btn
          size="sq"
          onClick={() =>
            onSubmit({
              id,
              term: term.replace("/2026", ""),
              window: `${toShort(open)} → ${toShort(close)}`,
              deadline: close.slice(0, 5),
              release:
                mode === "confirm"
                  ? "Ngay khi GV xác nhận"
                  : `Hẹn giờ ${toShort(release)}`,
              note: `Đóng lúc ${close.replace(" · ", " ")}`,
            })
          }
        >
          Lưu thiết lập
        </Btn>
      </div>
    </Dialog>
  );
}
