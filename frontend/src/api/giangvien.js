// API mẫu cho toàn bộ luồng giảng viên và điểm danh dùng chung với Manager.
// Đổi VITE_API_BASE_URL trong .env.development; sửa endpoint theo backend.
// Mỗi hàm: bỏ comment dòng `return apiClient...` để dùng API thay mock.
// Backend trả JSON trực tiếp theo cấu trúc mock (không bọc thêm { data }).
// import apiClient from './client';
import {
  DANH_SACH_LOP,
  HOC_VIEN,
  DIEM_MAU,
  TRO_GIANG_MAU,
  NHAN_XET_MAU,
  TAI_LIEU_MAU,
  GIANG_VIEN,
} from '../components/Lecturer/components/dungchung/dulieu';
import { CLASSES as MANAGER_CLASSES } from '../components/Manager/components/KhoaHoc/data';
import { parseIso } from '../components/Manager/components/LichPhanCong/data';
import { getSchedule } from '../components/Manager/components/LichPhanCong/store';
import { getProfile, changePassword } from './auth';

const key = (name) => `neko-lecturer-v1:${name}`;
// Giữ tài liệu, nhận xét đã nhập ở phiên bản giao diện cũ khi đổi danh sách lớp.
const LOP_CU = { 'ielts-f2': 'kid-2a', 'ielts-advanced': 'kid-3b', 'ielts-f2-extra': 'kindy-3b', 'ielts-f3': 'kid-3a' };
function chuyenLopCu(value) {
  if (typeof value === 'string') return LOP_CU[value] ?? value.replace(/^kid-teen-/, 'kid-');
  if (Array.isArray(value)) return value.map(chuyenLopCu);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([name, item]) => [name, chuyenLopCu(item)]);
    return Object.fromEntries(entries);
  }
  return value;
}

function readPreviousGrades(name) {
  const [, classId] = name.split(':');
  const aliases = Object.entries(LOP_CU)
    .filter(([, currentId]) => currentId === classId)
    .map(([oldId]) => oldId);
  if (classId.startsWith('kid-')) aliases.push(classId.replace(/^kid-/, 'kid-teen-'));

  const previousGrades = [];
  for (const oldId of aliases) {
    const oldName = name.replace(`grades:${classId}:`, `grades:${oldId}:`);
    const saved = localStorage.getItem(key(oldName));
    if (saved) previousGrades.push(JSON.parse(saved));
  }
  previousGrades.sort((first, second) =>
    String(second.updatedAt || '').localeCompare(String(first.updatedAt || '')),
  );
  if (previousGrades[0]) return JSON.stringify(previousGrades[0]);
}

function read(name, fallback) {
  try {
    let raw = localStorage.getItem(key(name));
    if (!raw && name.startsWith('grades:')) {
      raw = readPreviousGrades(name);
    }
    return chuyenLopCu(raw ? JSON.parse(raw) : fallback);
  }
  catch {
    return fallback;
  }
}
function write(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    throw new Error('Không thể lưu dữ liệu demo. Bộ nhớ trình duyệt đã đầy hoặc bị chặn.');
  }
  return value;
}
const encoded = encodeURIComponent;
export const apiGiangVien = {
  async profile() {
    // return apiClient.get('/auth/me').then(response => response.data);
    const account = await getProfile();
    return { ...GIANG_VIEN, ...account, ...read('profile', {}), id: account.id, role: account.role };
  },
  async saveProfile(payload) {
    // return apiClient.put('/auth/profile', payload).then(response => response.data);
    const account = await apiGiangVien.profile();
    const saved = write('profile', { ...account, ...payload });
    localStorage.setItem('neko-auth-user', JSON.stringify(saved));
    return saved;
  },
  async changePassword(payload) {
    // API và dữ liệu frontend dùng chung với Manager, xem src/api/auth.js.
    return changePassword(payload);
  },
  async classes() {
    // return apiClient.get('/lecturer/classes').then(response => response.data);
    return DANH_SACH_LOP;
  },
  async roster(classId) {
    // return apiClient.get(`/classes/${encoded(classId)}/students`).then(response => response.data);
    const selectedClass = DANH_SACH_LOP.find(item => item.id === classId)
      ?? MANAGER_CLASSES.find(item => item.id === classId);
    if (!selectedClass) throw new Error('Không tìm thấy lớp học.');
    return HOC_VIEN.slice(0, selectedClass.size);
  },
  async sessions(date) {
    // return apiClient.get('/lecturer/sessions', { params: { date } }).then(response => response.data);
    const sessions = Object.values(getSchedule(parseIso(date))).flat();
    const lecturerSessions = [];
    for (const session of sessions) {
      const selectedClass = DANH_SACH_LOP.find(item => item.name === session.name);
      if (selectedClass) lecturerSessions.push({ ...session, classId: selectedClass.id });
    }
    return lecturerSessions;
  },
  async attendance(sessionId) {
    // return apiClient.get(`/sessions/${encoded(sessionId)}/attendance`).then(response => response.data);
    const saved = read(`attendance:${sessionId}`, null);
    if (saved) return saved;
    const date = sessionId?.split('|')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return null;
    const sessions = Object.values(getSchedule(parseIso(date))).flat();
    const session = sessions.find(lesson => lesson.id === sessionId);
    if (!session || session.status !== 'attended') return null;
    const roster = await apiGiangVien.roster(session.classId);
    const present = Number.parseInt(session.att, 10) || 0;
    const records = roster.map((student, index) => ({
      studentId: student.id,
      status: index < present ? 'present' : 'absent',
      note: '',
    }));
    return { classId: session.classId, date, records, savedAt: `${date}T08:00:00` };
  },
  async saveAttendance(sessionId, payload) {
    // return apiClient.put(`/sessions/${encoded(sessionId)}/attendance`, payload).then(response => response.data);
    return write(`attendance:${sessionId}`, { ...payload, savedAt: new Date().toISOString() });
  },
  async grades(classId, test) {
    // return apiClient.get(`/classes/${encoded(classId)}/grades`, { params: { test } }).then(response => response.data);
    const roster = await this.roster(classId);
    const published = classId === 'kid-2a' && test === 'Kiểm tra giữa kỳ';
    const rows = roster.map((student, index) => ({
      studentId: student.id,
      scores: published ? DIEM_MAU[index % DIEM_MAU.length] : DIEM_MAU[index] ?? ['', '', '', ''],
      note: '',
    }));
    return read(`grades:${classId}:${test}`, {
      status: published ? 'published' : 'draft',
      rows,
      updatedAt: '2026-09-14T08:12:00',
    });
  },
  async saveGrades(classId, test, payload) {
    // return apiClient.put(`/classes/${encoded(classId)}/grades`, { test, ...payload }).then(response => response.data);
    return write(`grades:${classId}:${test}`, { ...payload, updatedAt: new Date().toISOString() });
  },
  async comments(classId) {
    // return apiClient.get(`/classes/${encoded(classId)}/comments`).then(response => response.data);
    return read('comments', NHAN_XET_MAU).filter(comment => comment.classId === classId);
  },
  async addComment(payload) {
    // return apiClient.post('/lecturer/comments', payload).then(response => response.data);
    const comment = { ...payload, id: crypto.randomUUID(), date: new Date().toISOString() };
    write('comments', [comment, ...read('comments', NHAN_XET_MAU)]);
    return comment;
  },
  async assistants() {
    // return apiClient.get('/lecturer/assistants').then(response => response.data);
    return read('assistants', TRO_GIANG_MAU);
  },
  async assistantCandidates() {
    // return apiClient.get('/lecturer/assistant-candidates').then(response => response.data);
    return TRO_GIANG_MAU;
  },
  async gradingWindow(classId) {
    // return apiClient.get(`/classes/${encoded(classId)}/grading-window`).then(response => response.data);
    return { opensAt: '2026-09-10T00:00', closesAt: '2026-09-16T23:59', test: 'Giữa kỳ T9' };
  },
  async saveAssistant(payload) {
    // return apiClient.put(`/lecturer/assistants/${encoded(payload.id)}`, payload).then(response => response.data);
    const assistants = read('assistants', TRO_GIANG_MAU);
    const otherAssistants = assistants.filter(assistant =>
      !(assistant.id === payload.id && assistant.classId === payload.classId),
    );
    return write('assistants', [...otherAssistants, payload]);
  },
  async assistantSubmission(assistantId, classId) {
    // return apiClient.get(`/lecturer/assistants/${encoded(assistantId)}/submission`, { params: { classId } }).then(response => response.data);
    const test = 'Bài luyện Writing Task 2';
    const grade = await this.grades(classId, test);
    const rows = grade.rows.map((row, studentIndex) => {
      const scores = row.scores.map((score, skillIndex) => {
        if (studentIndex < 3 && skillIndex === 3) return Math.min(9, Number(score || 6) + 0.5);
        return score === '' ? 6 : score;
      });
      return {
        ...row,
        scores,
        note: studentIndex < 3 ? 'Đã chấm lại bài Writing' : '',
      };
    });
    return { test, rows };
  },
  async reviewSubmission(assistantId, classId, payload) {
    // return apiClient.post(`/lecturer/assistants/${encoded(assistantId)}/review`, { classId, ...payload }).then(response => response.data);
    const assistants = await this.assistants();
    const assistant = assistants.find(item => item.id === assistantId && item.classId === classId);
    if (!assistant?.pending) throw new Error('Yêu cầu này đã được xử lý.');
    if (payload.approve) {
      const current = await this.grades(classId, payload.test);
      if (current.status === 'published') throw new Error('Bảng điểm đã công bố, không thể ghi đè.');
      await this.saveGrades(classId, payload.test, { ...current, rows: payload.rows, status: 'pending' });
    }
    return this.saveAssistant({ ...assistant, pending: false, returned: !payload.approve, returnReason: payload.reason || '' });
  },
  async documents() {
    // return apiClient.get('/lecturer/documents').then(response => response.data);
    return read('documents', TAI_LIEU_MAU);
  },
  async uploadDocument(file, payload) {
    // const form = new FormData(); form.append('file', file); form.append('metadata', JSON.stringify(payload));
    // return apiClient.post('/lecturer/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(response => response.data);
    const id = crypto.randomUUID();
    await blobOperation('readwrite', store => store.put(file, id));
    const document = {
      ...payload,
      id,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      date: new Date().toISOString().slice(0, 10),
      downloads: 0,
      events: ['Tải lên tài liệu: ' + new Date().toLocaleString('vi-VN')],
    };
    write('documents', [document, ...read('documents', TAI_LIEU_MAU)]);
    return document;
  },
  async updateDocument(doc) {
    // return apiClient.put(`/lecturer/documents/${encoded(doc.id)}`, doc).then(response => response.data);
    const documents = read('documents', TAI_LIEU_MAU);
    write('documents', documents.map(document => document.id === doc.id ? doc : document));
    return doc;
  },
  async deleteDocument(id) {
    // return apiClient.delete(`/lecturer/documents/${encoded(id)}`);
    await blobOperation('readwrite', store => store.delete(id));
    const documents = read('documents', TAI_LIEU_MAU);
    write('documents', documents.filter(document => document.id !== id));
  },
  async downloadDocument(id) {
    // return apiClient.get(`/lecturer/documents/${encoded(id)}/download`, { responseType: 'blob' }).then(response => response.data);
    const file = await blobOperation('readonly', store => store.get(id));
    if (!file) throw new Error('Tài liệu mẫu chưa có tệp đính kèm. Hãy tải một tài liệu mới lên để sử dụng chức năng tải xuống.');
    return file;
  },
};

function blobOperation(mode, operation) {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open('neko-lecturer-files', 1);
    openRequest.onupgradeneeded = () => openRequest.result.createObjectStore('files');
    openRequest.onerror = () => reject(new Error('Không thể mở bộ nhớ tài liệu.'));
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      const transaction = database.transaction('files', mode);
      const request = operation(transaction.objectStore('files'));
      transaction.oncomplete = () => {
        database.close();
        resolve(request.result);
      };
      transaction.onerror = () => {
        database.close();
        reject(new Error('Không thể lưu hoặc đọc tệp tài liệu.'));
      };
    };
  });
}
