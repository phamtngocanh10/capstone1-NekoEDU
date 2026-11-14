import { createDemoData } from './duLieuMau.js';
import { isValidScore } from '../components/ChamDiem/xuLyDiem.js';
import { throwError, readDemoData, writeDemoData, ERROR_CODES, cloneData } from './luuTruMau.js';

function findClass(data, classId) {
  const classItem = data.classes.find((classDetails) => classDetails.id === String(classId));
  if (!classItem) throwError('Không tìm thấy lớp được phân công.', ERROR_CODES.NOT_FOUND);
  return classItem;
}

function findSession(data, sessionId) {
  const sessionItem = data.buoiHoc.find((session) => session.id === String(sessionId));
  if (!sessionItem) throwError('Không tìm thấy buổi hỗ trợ.', ERROR_CODES.NOT_FOUND);
  return sessionItem;
}

function getGrantState(grant) {
  if (['revoked', 'published'].includes(grant.state)) return grant.state;
  const now = Date.now();
  if (now < new Date(grant.opensAt).getTime()) return 'scheduled';
  if (now > new Date(grant.closesAt).getTime()) return 'expired';
  return 'open';
}

function findGrant(data, grantId, requireEditable = false) {
  const grant = data.grants.find((gradingGrant) => gradingGrant.id === String(grantId));
  if (!grant) throwError('Không tìm thấy quyền nhập điểm.', ERROR_CODES.NOT_FOUND);
  const pendingSubmission = data.submissions.find(
    (submission) => submission.grantId === grant.id && submission.status === 'PENDING'
  );
  const result = {
    ...grant,
    state: getGrantState(grant),
    pending: Boolean(pendingSubmission),
    submissionId: pendingSubmission?.id ?? null,
  };
  if (requireEditable && (result.state !== 'open' || result.pending)) {
    throwError(
      'Quyền nhập điểm chưa mở, đã đóng hoặc bảng điểm đang chờ duyệt.',
      ERROR_CODES.GRANT_CLOSED
    );
  }
  return result;
}

function buildWorkspace(data) {
  return cloneData({
    staffId: data.staffId,
    classes: data.classes,
    periods: data.periods,
    requests: data.requests,
    submissions: data.submissions,
    grants: data.grants.map((grant) => findGrant(data, grant.id)),
  });
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throwError('Ngày hỗ trợ không hợp lệ.');
  const date = new Date(`${value}T12:00:00+07:00`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throwError('Ngày hỗ trợ không hợp lệ.');
  return date.getTime();
}

function buildSessionSummary(data, sessionItem) {
  const records = data.diemDanhTheoBuoi[sessionItem.id]?.records ?? [];
  const presentCount = records.filter((record) =>
    ['present', 'late'].includes(record.status)
  ).length;
  return {
    ...sessionItem,
    status:
      sessionItem.sessionStatus === 'CANCELLED'
        ? 'cancelled'
        : records.length === sessionItem.students
          ? 'attended'
          : 'upcoming',
    att: `${presentCount}/${sessionItem.students}`,
  };
}

function buildAttendance(data, sessionId) {
  const sessionItem = findSession(data, sessionId);
  const savedData = data.diemDanhTheoBuoi[sessionItem.id];
  const canEditAttendance =
    sessionItem.sessionStatus !== 'CANCELLED' &&
    Date.now() >= new Date(`${sessionItem.iso}T${sessionItem.startTime}:00+07:00`).getTime();
  return {
    sessionId: sessionItem.id,
    classId: sessionItem.classId,
    date: sessionItem.iso,
    status: sessionItem.sessionStatus,
    editable: canEditAttendance,
    savedAt: savedData?.savedAt ?? null,
    rows: data.hocVienTheoLop[sessionItem.classId].map((student) => {
      const record = savedData?.records.find((row) => row.studentId === student.id);
      return {
        studentId: student.id,
        name: student.name,
        code: student.code,
        status: record?.status ?? '',
        note: record?.note ?? '',
      };
    }),
  };
}

function buildGradeDraft(data, grantId) {
  const grant = findGrant(data, grantId);
  const draft = data.banNhapTheoQuyen[grant.id];
  return {
    grantId: grant.id,
    classId: grant.classId,
    className: grant.className,
    assessmentId: grant.assessmentId,
    title: grant.title,
    teacher: grant.teacher,
    opensAt: grant.opensAt,
    closesAt: grant.closesAt,
    state: grant.state,
    pending: grant.pending,
    editable: grant.state === 'open' && !grant.pending,
    version: draft?.version ?? null,
    updatedAt: draft?.updatedAt ?? null,
    rows: data.hocVienTheoLop[grant.classId].map((student) => {
      const gradeRow = draft?.rows.find((row) => row.studentId === student.id);
      return {
        studentId: student.id,
        name: student.name,
        code: student.code,
        scores: gradeRow ? [...gradeRow.scores] : ['', '', '', ''],
        note: gradeRow?.note ?? '',
      };
    }),
  };
}

function validateDraftVersion(data, grant, content) {
  const version = data.banNhapTheoQuyen[grant.id]?.version ?? null;
  if (content.version !== version)
    throwError(
      'Bản nháp đã thay đổi ở cửa sổ khác. Hãy tải lại trước khi lưu.',
      ERROR_CODES.VERSION_CONFLICT
    );
}

function validateGrades(data, grant, rows, requireComplete = false) {
  const studentIds = new Set(data.hocVienTheoLop[grant.classId].map((student) => student.id));
  if (!Array.isArray(rows) || rows.length !== studentIds.size)
    throwError('Danh sách điểm cần có đầy đủ học viên của lớp.');
  const seenStudentIds = new Set();
  return rows.map((row) => {
    if (!row || !studentIds.has(row.studentId) || seenStudentIds.has(row.studentId))
      throwError('Học viên không thuộc lớp hoặc bị trùng.');
    seenStudentIds.add(row.studentId);
    if (!Array.isArray(row.scores) || row.scores.length !== 4)
      throwError('Mỗi học viên cần bốn kỹ năng.');
    const scores = row.scores.map((score) => {
      if (!isValidScore(score, !requireComplete))
        throwError(
          requireComplete
            ? 'Cần nhập đủ bốn kỹ năng từ 0 đến 9, bước 0,5 trước khi gửi duyệt.'
            : 'Điểm phải từ 0 đến 9, theo bước 0,5.'
        );
      return score === '' || score === null || score === undefined ? '' : Number(score);
    });
    const note = String(row.note ?? '').trim();
    if (note.length > 500) throwError('Ghi chú điểm tối đa 500 ký tự.');
    return { studentId: row.studentId, scores, note };
  });
}

function updateGradeDraft(data, grantId, rows) {
  data.banNhapTheoQuyen[grantId] = {
    rows,
    version: String(Number(data.banNhapTheoQuyen[grantId]?.version ?? 0) + 1),
    updatedAt: new Date().toISOString(),
  };
}

const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const assistantData = {
  async getWorkspace() {
    return buildWorkspace(readDemoData());
  },

  async getSupportSchedule(startDate, endDate = startDate) {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (end < start || end - start > 62 * 86400000)
      throwError('Khoảng lịch hợp lệ tối đa 62 ngày.');
    const data = readDemoData();
    return cloneData(
      data.buoiHoc
        .filter((sessionItem) => sessionItem.iso >= startDate && sessionItem.iso <= endDate)
        .map((sessionItem) => buildSessionSummary(data, sessionItem))
    );
  },

  async getClassStudents(classId) {
    const data = readDemoData();
    const classItem = findClass(data, classId);
    return cloneData(data.hocVienTheoLop[classItem.id]);
  },

  async getAttendance(sessionId) {
    return cloneData(buildAttendance(readDemoData(), sessionId));
  },

  async saveAttendance(sessionId, content = {}) {
    const data = readDemoData();
    const attendance = buildAttendance(data, sessionId);
    if (!attendance.editable)
      throwError(
        'Chỉ có thể điểm danh buổi đã bắt đầu và chưa bị hủy.',
        ERROR_CODES.ATTENDANCE_NOT_AVAILABLE
      );
    const records = content.records;
    const studentIds = new Set(attendance.rows.map((row) => row.studentId));
    if (!Array.isArray(records) || records.length !== studentIds.size)
      throwError('Cần điểm danh đầy đủ học viên của buổi hỗ trợ.');
    const seenStudentIds = new Set();
    const validRecords = records.map((record) => {
      if (!record || !studentIds.has(record.studentId) || seenStudentIds.has(record.studentId))
        throwError('Học viên điểm danh không thuộc lớp hoặc bị trùng.');
      seenStudentIds.add(record.studentId);
      if (!['present', 'late', 'absent'].includes(record.status))
        throwError('Vui lòng chọn Có mặt, Đi trễ hoặc Vắng cho từng học viên.');
      const note = String(record.note ?? '').trim();
      if (note.length > 255) throwError('Ghi chú điểm danh tối đa 255 ký tự.');
      return { studentId: record.studentId, status: record.status, note };
    });
    data.diemDanhTheoBuoi[sessionId] = { records: validRecords, savedAt: new Date().toISOString() };
    writeDemoData(data, true);
    return cloneData(buildAttendance(data, sessionId));
  },

  async createGradingRequest(content = {}) {
    const data = readDemoData();
    const classItem = findClass(data, content.classId);
    const assessment = data.periods.find(
      (period) =>
        period.classId === classItem.id &&
        period.assessmentId === content.assessmentId &&
        period.status !== 'PUBLISHED'
    );
    if (!assessment) throwError('Kỳ điểm không thuộc lớp hoặc đã công bố.');
    const start = new Date(content.from).getTime();
    const end = new Date(content.to).getTime();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start >= end ||
      end <= Date.now() ||
      start < new Date(assessment.opensAt).getTime() ||
      end > new Date(assessment.closesAt).getTime()
    ) {
      throwError(
        'Thời gian yêu cầu phải nằm trong kỳ nhập điểm, còn hiệu lực và kết thúc sau lúc bắt đầu.'
      );
    }
    const note = String(content.note ?? '').trim();
    if (!note || note.length > 500) throwError('Vui lòng nhập lý do từ 1 đến 500 ký tự.');
    if (
      data.requests.some(
        (request) =>
          request.classId === classItem.id &&
          request.assessmentId === assessment.assessmentId &&
          request.status === 'PENDING'
      )
    ) {
      throwError('Đã có yêu cầu cho kỳ điểm này đang chờ duyệt.', ERROR_CODES.DUPLICATE_REQUEST);
    }
    const request = {
      id: createId('yeucau'),
      classId: classItem.id,
      className: classItem.name,
      assessmentId: assessment.assessmentId,
      title: assessment.title,
      teacher: classItem.teacher,
      from: new Date(start).toISOString(),
      to: new Date(end).toISOString(),
      note,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      reviewedAt: '',
      reviewNote: '',
    };
    data.requests.unshift(request);
    writeDemoData(data, true);
    return cloneData(request);
  },

  async getGradeDraft(grantId) {
    return cloneData(buildGradeDraft(readDemoData(), grantId));
  },

  async saveGradeDraft(grantId, content = {}) {
    const data = readDemoData();
    const grant = findGrant(data, grantId, true);
    validateDraftVersion(data, grant, content);
    const rows = validateGrades(data, grant, content.rows);
    updateGradeDraft(data, grant.id, rows);
    writeDemoData(data, true);
    return cloneData(buildGradeDraft(data, grant.id));
  },

  async submitGrades(grantId, content = {}) {
    const data = readDemoData();
    const grant = findGrant(data, grantId, true);
    validateDraftVersion(data, grant, content);
    const rows = validateGrades(data, grant, content.rows, true);
    const submission = {
      id: createId('bangdiem'),
      classId: grant.classId,
      className: grant.className,
      assessmentId: grant.assessmentId,
      title: grant.title,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      reviewedAt: '',
      reviewNote: '',
      studentCount: rows.length,
      grantId: grant.id,
    };
    updateGradeDraft(data, grant.id, rows);
    data.submissions.unshift(submission);
    writeDemoData(data, true);
    return { id: submission.id, status: submission.status };
  },

  async getNotifications() {
    const data = readDemoData();
    return {
      items: cloneData(data.thongBao),
      unread: data.thongBao.filter((notification) => !notification.read).length,
    };
  },

  async markAllNotificationsRead() {
    const data = readDemoData();
    const unreadCount = data.thongBao.filter((notification) => !notification.read).length;
    data.thongBao.forEach((notification) => {
      notification.read = true;
    });
    writeDemoData(data, true);
    return { updated: unreadCount };
  },
};

export async function getAttendanceSession({ sessionId, classId, date }) {
  const data = readDemoData();
  const targetDate = sessionId ? findSession(data, sessionId).iso : date;
  parseDate(targetDate);
  const sessions = data.buoiHoc
    .filter((sessionItem) => sessionItem.iso === targetDate)
    .map((sessionItem) => buildSessionSummary(data, sessionItem));
  const selectedSession = sessionId
    ? sessions.find((sessionItem) => sessionItem.id === String(sessionId))
    : sessions.find(
        (sessionItem) =>
          (!classId || sessionItem.classId === String(classId)) &&
          sessionItem.permissions.includes('attendance') &&
          sessionItem.status !== 'cancelled'
      );
  return cloneData({
    sessions,
    selectedSession,
    attendance: selectedSession ? buildAttendance(data, selectedSession.id) : null,
  });
}

export async function resetDemoData() {
  const data = createDemoData();
  writeDemoData(data, true);
  return buildWorkspace(data);
}
