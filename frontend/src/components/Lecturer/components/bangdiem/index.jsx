import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { BackLink, Btn, Card, Chip, Dialog } from "../../../../common/ui/index";
import { useGiangVien, useTieuDeTrang } from "../../layout/ngucanh";
import { apiGiangVien } from "../../../../api/giangvien";
import { KY_NANG, BAI_KIEM_TRA } from "../dungchung/dulieu";
import { useLopGiangDay } from "../../layout/dulieulophoc";
import {
  ChonLop,
  LoiDuLieu,
  DangTai,
  HocVien,
  BangDuLieu,
  diemTrungBinh,
  useDuLieu,
} from "../dungchung/dungchung";
import { TaiDanhSach, xuatExcel } from "../lophoc/taidanhsach";

const GRADE_STATUS = {
  draft: { tone: "gray", label: "Bản nháp", action: "Tiếp tục nhập" },
  pending: { tone: "amber", label: "Chờ xác nhận", action: "Xác nhận" },
  published: { tone: "green", label: "Đã công bố", action: "Xem lại" },
};

function countCompletedRows(rows) {
  return rows.filter((row) => diemTrungBinh(row.scores) !== null).length;
}

function isInvalidScore(value) {
  if (value === "") return false;
  const score = Number(value);
  return score < 0 || score > 9 || (score * 2) % 1 !== 0;
}

function getRank(average) {
  if (average === null) return "—";
  if (Number(average) >= 7) return "Giỏi";
  if (Number(average) >= 6) return "Khá";
  return "TB";
}

function moveScoreFocus(event) {
  const steps = { Enter: 1, ArrowDown: KY_NANG.length, ArrowUp: -KY_NANG.length };
  const step = steps[event.key];
  if (!step) return;

  event.preventDefault();
  const table = event.currentTarget.closest("table");
  const inputs = Array.from(table.querySelectorAll("input[type=number]"));
  const currentIndex = inputs.indexOf(event.currentTarget);
  inputs[currentIndex + step]?.focus();
}

export default function BangDiem() {
  const classes = useLopGiangDay();
  const [params, setParams] = useSearchParams();
  const classId = params.get("classId") || classes[0].id;
  const test = params.get("test") || BAI_KIEM_TRA[0];
  const [exportOpen, setExportOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const gradesRequest = useDuLieu(
    async () =>
      Promise.all(
        classes.map(async (classItem) => ({
          classItem,
          grade: await apiGiangVien.grades(classItem.id, test),
        })),
      ),
    [test],
  );
  const rosterRequest = useDuLieu(() => apiGiangVien.roster(classId), [classId]);
  const selectedClass = classes.find((classItem) => classItem.id === classId);

  function handleClassChange(value) {
    setParams({ classId: value, test });
  }

  function handleTestChange(event) {
    setParams({ classId, test: event.target.value });
  }

  function handleUploadDone() {
    setUploadOpen(false);
    gradesRequest.reload();
  }

  if (!selectedClass) return <DangTai error="Không tìm thấy lớp học." />;
  const query = new URLSearchParams({ classId, test }).toString();
  return (
    <div className="u-page lc-page">
      <Card>
        <h3>Nhập điểm mới</h3>
        <p className="u-muted lc-section-title">
          Chọn lớp và bài kiểm tra, sau đó chọn cách nhập điểm phù hợp
        </p>
        <div className="lc-toolbar">
          <ChonLop value={classId} onChange={handleClassChange} />
          <select
            className="lc-select"
            aria-label="Bài kiểm tra"
            value={test}
            onChange={handleTestChange}
          >
            {BAI_KIEM_TRA.map((testName) => (
              <option key={testName}>{testName}</option>
            ))}
          </select>
        </div>
        <div className="lc-grid lc-grid--three lc-methods">
          <div className="lc-method">
            <FileSpreadsheet size={25} />
            <h3>Nhập trực tiếp</h3>
            <p>Nhập điểm từng học viên trên bảng, điểm Tổng tự tính</p>
            <Btn to={`/lecturer/bangdiem/nhap?${query}`}>Nhập điểm</Btn>
          </div>
          <div className="lc-method">
            <Upload size={25} />
            <h3>Tải file Excel lên</h3>
            <p>Dùng file .xlsx theo mẫu, kiểm tra lỗi trước khi nhập</p>
            <Btn variant="soft" onClick={() => setUploadOpen(true)}>
              Chọn file
            </Btn>
          </div>
          <div className="lc-method">
            <Download size={25} />
            <h3>Tải danh sách / mẫu</h3>
            <p>Tải danh sách hoặc mẫu điền sẵn tên học viên</p>
            <Btn variant="soft" onClick={() => setExportOpen(true)}>
              Tải xuống
            </Btn>
          </div>
        </div>
      </Card>
      <Card>
        <h3 className="lc-section-title">Trạng thái bảng điểm theo lớp</h3>
        {!gradesRequest.data ? (
          <DangTai error={gradesRequest.error} retry={gradesRequest.reload} />
        ) : (
          <BangDuLieu
            headings={[
              "Lớp học",
              "Bài kiểm tra",
              "Tiến độ",
              "Trạng thái",
              "Thao tác",
            ]}
          >
            {gradesRequest.data.map(({ classItem, grade }) => {
              const status = GRADE_STATUS[grade.status];
              const page = grade.status === "published" ? "xem" : "nhap";
              const query = new URLSearchParams({ classId: classItem.id, test });

              return (
                <tr key={classItem.id}>
                  <td><strong>{classItem.name}</strong></td>
                  <td>{test}</td>
                  <td>{countCompletedRows(grade.rows)}/{grade.rows.length}</td>
                  <td><Chip tone={status?.tone}>{status?.label}</Chip></td>
                  <td>
                    <Btn variant="soft" to={`/lecturer/bangdiem/${page}?${query}`}>
                      {status?.action ?? "Tiếp tục nhập"}
                    </Btn>
                  </td>
                </tr>
              );
            })}
          </BangDuLieu>
        )}
        <p className="lc-info">
          Điểm được công bố sau khi giảng viên kiểm tra và xác nhận bảng điểm.
        </p>
      </Card>
      {exportOpen &&
        (rosterRequest.data ? (
          <TaiDanhSach
            cls={selectedClass}
            roster={rosterRequest.data}
            onClose={() => setExportOpen(false)}
          />
        ) : (
          <Dialog title="Tải danh sách" onClose={() => setExportOpen(false)}>
            <DangTai error={rosterRequest.error} retry={rosterRequest.reload} />
          </Dialog>
        ))}
      {uploadOpen && (
        <TaiFileDiem
          classId={classId}
          test={test}
          onClose={() => setUploadOpen(false)}
          onDone={handleUploadDone}
        />
      )}
    </div>
  );
}

export function NhapDiem({ readonly = false }) {
  const classes = useLopGiangDay();
  const [params] = useSearchParams();
  const classId = params.get("classId") || classes[0].id;
  const test = params.get("test") || BAI_KIEM_TRA[0];
  const selectedClass = classes.find((classItem) => classItem.id === classId);
  useTieuDeTrang(
    readonly ? "Bảng điểm đã công bố" : "Nhập điểm trực tiếp",
    `${selectedClass?.name ?? ""} · ${test} · Thang điểm 0–9.0`,
  );
  const dataRequest = useDuLieu(
    async () => ({
      roster: await apiGiangVien.roster(classId),
      grade: await apiGiangVien.grades(classId, test),
    }),
    [classId, test],
  );
  const [grade, setGrade] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { notify } = useGiangVien();

  // Tạo bản điểm có thể chỉnh sửa sau khi tải dữ liệu hoặc đổi lớp/bài kiểm tra.
  useEffect(() => {
    setGrade(dataRequest.data?.grade ?? null);
    setHasChanges(false);
  }, [dataRequest.data]);

  const isReadOnly = readonly || grade?.status === "published" || Boolean(grade?.confirmedAt);

  async function saveGrades(status = "draft", silent = false) {
    if (!grade || isReadOnly) return;
    setIsSaving(true);
    setError("");
    try {
      if (grade.rows.some((row) => row.scores.some(isInvalidScore))) {
        throw new Error("Điểm phải từ 0 đến 9, theo bước 0.5.");
      }
      if (
        status !== "draft" &&
        countCompletedRows(grade.rows) !== grade.rows.length
      ) {
        throw new Error(
          "Nhập đủ điểm hợp lệ cho tất cả học viên trước khi xác nhận.",
        );
      }
      const result = await apiGiangVien.saveGrades(classId, test, {
        ...grade,
        status,
      });
      setGrade(result);
      setHasChanges(false);
      if (!silent) {
        notify(
          status === "published"
            ? result.status === 'published' ? "Đã xác nhận và công bố bảng điểm" : "Đã xác nhận bảng điểm, chờ thời gian công bố"
            : "Đã lưu nháp bảng điểm",
        );
      }
      if (status === "published") setReviewOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }
  useEffect(() => {
    if (!hasChanges || isSaving || isReadOnly) return;
    // Mỗi lần nhập sẽ hủy bộ đếm cũ và đợi thêm 30 giây trước khi lưu nháp.
    const timer = setTimeout(() => saveGrades("draft", true), 30000);
    return () => clearTimeout(timer);
  }, [grade, hasChanges, isSaving, isReadOnly]);

  useEffect(() => {
    function warnBeforeLeave(event) {
      if (!hasChanges) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [hasChanges]);

  function updateStudent(studentId, changes) {
    // Luôn tạo object/array mới để React nhận biết dữ liệu đã thay đổi.
    setGrade((currentGrade) => ({
      ...currentGrade,
      rows: currentGrade.rows.map((row) =>
        row.studentId === studentId ? { ...row, ...changes } : row,
      ),
    }));
    setHasChanges(true);
  }

  function updateScore(row, skillIndex, value) {
    const scores = [...row.scores];
    scores[skillIndex] = value === "" ? "" : Number(value);
    updateStudent(row.studentId, { scores });
  }

  function handleCancel(event) {
    if (hasChanges && !window.confirm("Rời trang và bỏ các thay đổi chưa lưu?")) {
      event.preventDefault();
    }
  }

  function handleReview() {
    if (countCompletedRows(grade.rows) !== grade.rows.length) {
      setError("Cần nhập đủ điểm hợp lệ trước khi xem lại và xác nhận.");
      return;
    }
    setError("");
    setReviewOpen(true);
  }

  function handleUploadDone() {
    setUploadOpen(false);
    dataRequest.reload();
  }

  if (!selectedClass) return <DangTai error="Không tìm thấy lớp học." />;
  if (!dataRequest.data || !grade) {
    return <DangTai error={dataRequest.error} retry={dataRequest.reload} />;
  }

  const { roster } = dataRequest.data;
  let saveMessage = `Đã lưu: ${new Date(grade.updatedAt).toLocaleString("vi-VN")}`;
  if (hasChanges) saveMessage = "Có thay đổi chưa lưu";
  if (isReadOnly) saveMessage = "Bảng điểm chỉ đọc";

  const renderScoreTable = (readOnly) => (
    <BangDuLieu
      headings={["STT", "Học viên", ...KY_NANG, "Tổng", "Xếp loại", "Ghi chú"]}
    >
      {grade.rows.map((row, index) => {
        const student = roster.find((student) => student.id === row.studentId);
        const average = diemTrungBinh(row.scores);
        return (
          <tr key={row.studentId}>
            <td>{index + 1}</td>
            <td>
              <HocVien student={student ?? { id: row.studentId, name: "Học viên" }} />
            </td>
            {row.scores.map((value, skillIndex) => (
              <td key={skillIndex}>
                {readOnly ? (
                  value === "" ? "—" : value
                ) : (
                  <input
                    type="number"
                    className="lc-score-input"
                    min="0"
                    max="9"
                    step="0.5"
                    value={value}
                    aria-label={`${KY_NANG[skillIndex]} ${student?.name}`}
                    aria-invalid={isInvalidScore(value)}
                    onKeyDown={moveScoreFocus}
                    onChange={(event) => updateScore(row, skillIndex, event.target.value)}
                  />
                )}
              </td>
            ))}
            <td>
              <strong>{average ?? "—"}</strong>
            </td>
            <td>{getRank(average)}</td>
            <td>
              {readOnly ? (
                row.note || "—"
              ) : (
                <input
                  className="lc-input"
                  aria-label={`Ghi chú ${student?.name}`}
                  placeholder="Thêm ghi chú…"
                  value={row.note}
                  onChange={(event) =>
                    updateStudent(row.studentId, { note: event.target.value })
                  }
                />
              )}
            </td>
          </tr>
        );
      })}
    </BangDuLieu>
  );
  return (
    <div className="u-page lc-page">
      <BackLink to="/lecturer/bangdiem">Bảng điểm</BackLink>
      <div className="lc-toolbar">
        <div className="u-grow">
          <h2>
            {selectedClass.name} — {test}
          </h2>
          <p className="u-muted">{saveMessage}</p>
        </div>
        {!isReadOnly && (
          <>
            <Btn variant="soft" onClick={() => setExportOpen(true)}>
              Tải mẫu / danh sách
            </Btn>
            <Btn variant="soft" onClick={() => setUploadOpen(true)}>
              Tải file Excel lên
            </Btn>
          </>
        )}
        <Btn variant="soft" onClick={() => window.print()}>
          In / Lưu PDF
        </Btn>
      </div>
      <LoiDuLieu>{error}</LoiDuLieu>
      <p className="lc-info">
        {isReadOnly
          ? grade.status === 'published' ? "Đã công bố — bảng điểm không thể sửa." : "Đã xác nhận — đang chờ giờ công bố."
          : "Nhập 0–9.0 (bước 0.5) cho từng kỹ năng. Điểm Tổng tự tính. Tự lưu sau 30 giây ngừng nhập."}{" "}
        · Đã nhập{" "}
        {countCompletedRows(grade.rows)}/{roster.length}
      </p>
      <Card pad={false}>{renderScoreTable(isReadOnly)}</Card>
      {!isReadOnly && (
        <div className="lc-toolbar lc-bottom-actions">
          <span className="u-grow u-muted">Chưa công bố cho học viên</span>
          <Btn
            variant="ghost"
            to="/lecturer/bangdiem"
            onClick={handleCancel}
          >
            Hủy
          </Btn>
          <Btn variant="soft" disabled={isSaving} onClick={() => saveGrades()}>
            Lưu nháp
          </Btn>
          <Btn disabled={isSaving} onClick={handleReview}>
            Xem lại & Xác nhận
          </Btn>
        </div>
      )}
      {reviewOpen && (
        <Dialog
          size="xl"
          title={`Xác nhận bảng điểm — ${selectedClass.name}`}
          subtitle={test}
          onClose={() => setReviewOpen(false)}
        >
          <div className="lc-dialog-body">
            {renderScoreTable(true)}
            <LoiDuLieu>{error}</LoiDuLieu>
            <p className="lc-info">
              Sau khi xác nhận, bảng điểm được công bố và chuyển sang chế độ chỉ
              đọc.
            </p>
          </div>
          <div className="lc-dialog-footer">
            <Btn variant="ghost" onClick={() => setReviewOpen(false)}>
              Hủy
            </Btn>
            <Btn disabled={isSaving} onClick={() => saveGrades("published")}>
              Xác nhận bảng điểm
            </Btn>
          </div>
        </Dialog>
      )}
      {exportOpen && (
        <TaiDanhSach
          cls={selectedClass}
          roster={roster}
          onClose={() => setExportOpen(false)}
        />
      )}
      {uploadOpen && (
        <TaiFileDiem
          classId={classId}
          test={test}
          onClose={() => setUploadOpen(false)}
          onDone={handleUploadDone}
        />
      )}
    </div>
  );
}

export function TaiFileDiem({ classId, test, onClose, onDone }) {
  const classes = useLopGiangDay();
  const selectedClass = classes.find((classItem) => classItem.id === classId);
  const dataRequest = useDuLieu(
    async () => ({
      roster: await apiGiangVien.roster(classId),
      grade: await apiGiangVien.grades(classId, test),
    }),
    [classId, test],
  );
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [skipErrors, setSkipErrors] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  async function parseExcelFile(file) {
    if (!file) return;
    setIsProcessing(true);
    setError("");
    setRows([]);
    setFileName(file.name);
    try {
      if (
        !file.name.toLowerCase().endsWith(".xlsx") ||
        file.size > 5 * 1024 * 1024
      ) {
        throw new Error("Chọn tệp .xlsx tối đa 5 MB.");
      }
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.getWorksheet("Bảng điểm") ?? workbook.worksheets[0];
      if (!worksheet || worksheet.rowCount > 1000) {
        throw new Error("Tệp rỗng hoặc vượt quá 1000 dòng.");
      }

      // Tìm cột theo tiêu đề để vẫn đọc đúng khi vị trí các cột thay đổi.
      const header = worksheet.getRow(1).values;
      const columnIndexes = ["Mã học viên", "Họ và tên", ...KY_NANG].map((label) =>
        header.findIndex(
          (value) => String(value).trim().toLowerCase() === label.toLowerCase(),
        ),
      );
      if (columnIndexes.some((index) => index < 1)) {
        throw new Error(
          "Thiếu cột. Hãy tải mẫu từ hệ thống và giữ nguyên dòng tiêu đề.",
        );
      }

      const [idColumn, nameColumn, ...scoreColumns] = columnIndexes;
      const parsedRows = [];
      const seenIds = new Set();
      worksheet.eachRow((row, number) => {
        if (number === 1) return;
        const studentId = row.getCell(idColumn).text.trim();
        if (
          !studentId &&
          scoreColumns.every((column) => row.getCell(column).value === null)
        ) {
          return;
        }
        const student = dataRequest.data.roster.find((student) => student.id === studentId);
        const scores = scoreColumns.map((column) => {
          const value = row.getCell(column).value;
          if (value === null) return "";
          if (typeof value === "number") return value;
          return NaN;
        });

        let problem = "";
        if (!student) problem = "Mã HV không có trong lớp";
        else if (seenIds.has(studentId)) problem = "Trùng mã học viên";
        else if (diemTrungBinh(scores) === null) {
          problem = "Điểm thiếu hoặc ngoài 0–9, bước 0.5";
        }

        seenIds.add(studentId);
        parsedRows.push({
          number,
          studentId,
          name: student?.name ?? row.getCell(nameColumn).text,
          scores,
          problem,
        });
      });
      if (!parsedRows.length) throw new Error("Không có dòng dữ liệu trong tệp.");
      setRows(parsedRows);
    } catch (err) {
      setError(err.message || "Không đọc được tệp Excel.");
    } finally {
      setIsProcessing(false);
    }
  }

  const validRows = rows.filter((row) => !row.problem);
  const hasErrors = validRows.length !== rows.length;
  const importDisabled =
    isProcessing || !validRows.length || (!skipErrors && hasErrors) ||
    dataRequest.data?.grade.status === "published";

  async function importScores() {
    setIsProcessing(true);
    setError("");
    try {
      const grade = dataRequest.data.grade;
      if (grade.status === "published") {
        throw new Error("Bảng điểm đã công bố, không thể ghi đè.");
      }
      const nextRows = grade.rows.map((row) => {
        const imported = validRows.find((importedRow) => importedRow.studentId === row.studentId);
        const hasNoScores = row.scores.every((value) => value === "");
        if (imported && (overwriteExisting || hasNoScores)) {
          return { ...row, scores: imported.scores };
        }
        return row;
      });
      await apiGiangVien.saveGrades(classId, test, {
        ...grade,
        status: "draft",
        rows: nextRows,
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function downloadErrors() {
    try {
      const errorRows = rows
        .filter((row) => row.problem)
        .map((row) => [row.number, row.studentId, row.problem]);
      await xuatExcel("Loi-nhap-diem", ["Dòng", "Mã HV", "Lỗi"], errorRows);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Dialog
      size="xl"
      title="Tải file điểm lên"
      subtitle={`${selectedClass?.name} · ${test}`}
      onClose={onClose}
    >
      <div className="lc-dialog-body">
        {!dataRequest.data ? (
          <DangTai error={dataRequest.error} retry={dataRequest.reload} />
        ) : (
          <>
            <label className="lc-upload-link">
              Chọn hoặc kéo thả file .xlsx (tối đa 5 MB)
              <input
                type="file"
                accept=".xlsx"
                disabled={isProcessing}
                onChange={(event) => parseExcelFile(event.target.files[0])}
              />
              {fileName && <strong>{fileName}</strong>}
            </label>
            {rows.length > 0 && (
              <>
                <p className="lc-info">
                  Đọc được {rows.length} dòng · Hợp lệ {validRows.length} · Lỗi{" "}
                  {rows.length - validRows.length}
                </p>
                <BangDuLieu
                  headings={["Dòng", "Mã HV", "Họ tên", ...KY_NANG, "Kết quả"]}
                >
                  {rows.map((row) => (
                    <tr key={row.number}>
                      <td>{row.number}</td>
                      <td>{row.studentId}</td>
                      <td>{row.name}</td>
                      {row.scores.map((score, skillIndex) => (
                        <td key={skillIndex}>{Number.isNaN(score) ? "Không hợp lệ" : score}</td>
                      ))}
                      <td className={row.problem ? "lc-error-text" : ""}>
                        {row.problem || "Hợp lệ"}
                      </td>
                    </tr>
                  ))}
                </BangDuLieu>
                <label className="lc-check">
                  <input
                    type="checkbox"
                    checked={overwriteExisting}
                    onChange={(event) => setOverwriteExisting(event.target.checked)}
                  />
                  Ghi đè điểm đã nhập trước đó
                </label>
                <label className="lc-check">
                  <input
                    type="checkbox"
                    checked={skipErrors}
                    onChange={(event) => setSkipErrors(event.target.checked)}
                  />
                  Bỏ qua dòng lỗi, chỉ nhập dòng hợp lệ
                </label>
                <Btn variant="soft" onClick={downloadErrors}>
                  Tải file lỗi (.xlsx)
                </Btn>
              </>
            )}
          </>
        )}
        <LoiDuLieu>{error}</LoiDuLieu>
      </div>
      <div className="lc-dialog-footer">
        <Btn variant="ghost" onClick={onClose}>
          Hủy
        </Btn>
        <Btn disabled={importDisabled} onClick={importScores}>
          {isProcessing ? "Đang xử lý…" : `Nhập ${validRows.length} dòng hợp lệ`}
        </Btn>
      </div>
    </Dialog>
  );
}
