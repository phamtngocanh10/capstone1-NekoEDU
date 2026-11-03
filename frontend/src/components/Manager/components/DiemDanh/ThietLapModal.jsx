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

function toInputDateTime(value) {
  return value.replace(
    /^(\d{2})\/(\d{2}) (\d{2}:\d{2})$/,
    "2026-$2-$1T$3",
  );
}

function toDisplayDateTime(value) {
  const [date, time] = value.split("T");
  return `${date.split("-").reverse().join("/")} · ${time}`;
}

function openDateTimePicker(event) {
  const input = event.currentTarget.querySelector("input");
  if (!input || input.disabled) return;
  input.focus();
  // Mở lịch khi bấm vào ô, thay vì chỉ bấm biểu tượng lịch.
  try {
    input.showPicker?.();
  } catch {
    input.focus();
  }
}

export const toShort = (s) =>
  s.replace(/^(\d{2}\/\d{2})\/\d{4} · (\d{2}:\d{2})$/, "$1 $2");

export default function ThietLapModal({ course, onSubmit, onClose }) {
  const [id, setId] = useState(course.id);
  const [term, setTerm] = useState(`${course.term}/2026`);
  const [open, setOpen] = useState(
    course.opensAt || toInputDateTime(course.window.split(" → ")[0]),
  );
  const [close, setClose] = useState(
    course.closesAt || toInputDateTime(course.window.split(" → ")[1]),
  );
  const [mode, setMode] = useState(
    course.release.startsWith("Hẹn") ? "timed" : "confirm",
  );
  const [release, setRelease] = useState(() => {
    if (course.publishesAt) return course.publishesAt;
    const initialRelease = course.release.startsWith("Hẹn giờ ")
      ? course.release.slice("Hẹn giờ ".length)
      : "21/09 08:00";
    return toInputDateTime(initialRelease);
  });
  const [remind, setRemind] = useState(true);
  const [autoLock, setAutoLock] = useState(true);

  function saveSettings(event) {
    event.preventDefault();
    const openText = toDisplayDateTime(open);
    const closeText = toDisplayDateTime(close);
    onSubmit({
      id,
      opensAt: open,
      closesAt: close,
      publishesAt: release,
      term: term.replace("/2026", ""),
      window: `${toShort(openText)} → ${toShort(closeText)}`,
      deadline: closeText.slice(0, 5),
      release: mode === "confirm"
        ? "Ngay khi GV xác nhận"
        : `Hẹn giờ ${toShort(toDisplayDateTime(release))}`,
      note: `Đóng lúc ${closeText.replace(" · ", " ")}`,
    });
  }

  return (
    <Dialog
      title="Thiết lập thời gian điểm số"
      subtitle="Đặt thời gian giảng viên nhập điểm và thời điểm công bố cho học viên"
      onClose={onClose}
    >
      <form onSubmit={saveSettings}>
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
            type="datetime-local"
            value={open}
            onControlClick={openDateTimePicker}
            onChange={(e) => setOpen(e.target.value)}
          />
          <TextField
            label="Đóng lúc"
            type="datetime-local"
            min={open}
            value={close}
            onControlClick={openDateTimePicker}
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
            type="datetime-local"
            full
            disabled={mode !== "timed"}
            value={release}
            onControlClick={openDateTimePicker}
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
            type="submit"
            disabled={!open || !close || (mode === "timed" && !release)}
          >
            Lưu thiết lập
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}
