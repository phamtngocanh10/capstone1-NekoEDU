import { createDemoData } from './duLieuMau.js';

export const ERROR_CODES = Object.freeze({
  INVALID_DATA: 'DU_LIEU_KHONG_HOP_LE',
  NOT_FOUND: 'KHONG_TIM_THAY',
  ATTENDANCE_NOT_AVAILABLE: 'CHUA_THE_DIEM_DANH',
  GRANT_CLOSED: 'QUYEN_DA_DONG',
  VERSION_CONFLICT: 'PHIEN_BAN_CU',
  DUPLICATE_REQUEST: 'YEU_CAU_TRUNG',
  STORAGE_FAILED: 'KHONG_THE_LUU',
});

export const DEMO_STORAGE_KEY = 'neko-trogiang-demo-v1';
export const cloneData = (data) => JSON.parse(JSON.stringify(data));
let inMemoryData = null;

function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function writeDemoData(data, requirePersistence = false) {
  const copy = cloneData(data);
  const storage = getStorage();
  const throwStorageError = () =>
    throwError(
      'Không lưu được dữ liệu mẫu trên trình duyệt. Các thay đổi chưa được lưu; hãy kiểm tra quyền lưu trữ hoặc dung lượng rồi thử lại.',
      ERROR_CODES.STORAGE_FAILED
    );
  if (storage) {
    try {
      storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(copy));
    } catch {
      if (requirePersistence) throwStorageError();
    }
  } else if (requirePersistence && typeof window !== 'undefined') {
    throwStorageError();
  }
  inMemoryData = copy;
}

function isValidDemoData(data) {
  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
  const isObjectList = (value) => Array.isArray(value) && value.every(isObject);
  const isString = (value) => typeof value === 'string';
  if (!isObject(data) || data.phienBan !== 1) return false;
  const lists = ['classes', 'periods', 'grants', 'requests', 'submissions', 'buoiHoc', 'thongBao'];
  const mapKeys = ['hocVienTheoLop', 'banNhapTheoQuyen', 'diemDanhTheoBuoi'];
  if (
    !lists.every((name) => isObjectList(data[name])) ||
    !mapKeys.every((name) => isObject(data[name]))
  )
    return false;

  const classIds = new Set(data.classes.map((classItem) => classItem.id));
  const hasValidStudents = data.classes.every(
    (classItem) =>
      isString(classItem.id) &&
      isString(classItem.name) &&
      isString(classItem.time) &&
      Array.isArray(classItem.days) &&
      Array.isArray(classItem.permissions) &&
      isObjectList(data.hocVienTheoLop[classItem.id]) &&
      data.hocVienTheoLop[classItem.id].every(
        (student) => isString(student.id) && isString(student.name) && isString(student.code)
      )
  );
  const hasValidSessions = data.buoiHoc.every(
    (sessionItem) =>
      isString(sessionItem.id) &&
      classIds.has(sessionItem.classId) &&
      isString(sessionItem.iso) &&
      isString(sessionItem.time) &&
      isString(sessionItem.startTime) &&
      Array.isArray(sessionItem.permissions)
  );
  const hasValidGrants = data.grants.every(
    (grant) =>
      isString(grant.id) &&
      classIds.has(grant.classId) &&
      Number.isFinite(new Date(grant.opensAt).getTime()) &&
      Number.isFinite(new Date(grant.closesAt).getTime())
  );
  const hasValidDrafts = Object.values(data.banNhapTheoQuyen).every(
    (draft) =>
      isObject(draft) &&
      isObjectList(draft.rows) &&
      draft.rows.every(
        (row) => isString(row.studentId) && Array.isArray(row.scores) && row.scores.length === 4
      )
  );
  const hasValidAttendance = Object.values(data.diemDanhTheoBuoi).every(
    (attendance) =>
      isObject(attendance) &&
      isObjectList(attendance.records) &&
      attendance.records.every((row) => isString(row.studentId))
  );
  return (
    hasValidStudents && hasValidSessions && hasValidGrants && hasValidDrafts && hasValidAttendance
  );
}

export function readDemoData() {
  const storage = getStorage();
  if (storage) {
    try {
      const data = JSON.parse(storage.getItem(DEMO_STORAGE_KEY) || 'null');
      if (isValidDemoData(data)) {
        inMemoryData = data;
        return cloneData(data);
      }
      // Bản lưu sai cấu trúc: giữ bản đang dùng hoặc tạo lại dữ liệu mẫu.
      writeDemoData(inMemoryData ?? createDemoData());
    } catch {
      /* Bản lưu không đọc được: dùng bản trong bộ nhớ hoặc tạo lại dữ liệu mẫu. */
    }
  }
  if (!inMemoryData) writeDemoData(createDemoData());
  return cloneData(inMemoryData);
}

export function throwError(message, errorCode = ERROR_CODES.INVALID_DATA) {
  const error = new Error(message);
  error.code = errorCode;
  throw error;
}
