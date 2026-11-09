import apiClient from './client';
import { getProfile, changePassword } from './auth';
import { updateProfile } from './profile';

const data = request => request.then(response => response.data);
const id = encodeURIComponent;
export const apiGiangVien = {
  profile: getProfile,
  saveProfile: updateProfile,
  changePassword,
  classes: () => data(apiClient.get('/lecturer/classes')),
  roster: (classId, date) => data(apiClient.get(`/lecturer/classes/${id(classId)}/students`, { params: { date } })),
  sessions: date => data(apiClient.get('/lecturer/sessions', { params: { date } })),
  session: sessionId => data(apiClient.get(`/lecturer/sessions/${id(sessionId)}`)),
  attendance: sessionId => data(apiClient.get(`/lecturer/sessions/${id(sessionId)}/attendance`)),
  saveAttendance: (sessionId, payload) => data(apiClient.put(`/lecturer/sessions/${id(sessionId)}/attendance`, payload)),
  grades: (classId, test) => data(apiClient.get(`/lecturer/classes/${id(classId)}/grades`, { params: { test } })),
  saveGrades: (classId, test, payload) => data(apiClient.put(`/lecturer/classes/${id(classId)}/grades`, { ...payload, test })),
  comments: classId => data(apiClient.get(`/lecturer/classes/${id(classId)}/comments`)),
  addComment: payload => data(apiClient.post('/lecturer/comments', payload)),
  assistants: () => data(apiClient.get('/lecturer/assistants')),
  assistantCandidates: () => data(apiClient.get('/lecturer/assistant-candidates')),
  gradingWindow: classId => data(apiClient.get(`/lecturer/classes/${id(classId)}/grading-window`)),
  saveAssistant: payload => data(apiClient.put('/lecturer/assistants', payload)),
  assistantSubmission: (assistantId, classId) => data(apiClient.get(`/lecturer/assistants/${id(assistantId)}/submission`, { params: { classId } })),
  reviewSubmission: (assistantId, classId, payload) => data(apiClient.post(`/lecturer/assistants/${id(assistantId)}/review`, { ...payload, classId })),
  documents: () => data(apiClient.get('/lecturer/documents')),
  uploadDocument(file, payload) {
    const form = new FormData();
    form.append('file', file);
    form.append('metadata', JSON.stringify(payload));
    return data(apiClient.post('/lecturer/documents', form));
  },
  updateDocument: document => data(apiClient.put(`/lecturer/documents/${id(document.id)}`, document)),
  deleteDocument: documentId => data(apiClient.delete(`/lecturer/documents/${id(documentId)}`)),
  downloadDocument: documentId => data(apiClient.get(`/lecturer/documents/${id(documentId)}/download`, { responseType: 'blob' })),
};
