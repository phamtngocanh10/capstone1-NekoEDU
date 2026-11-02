import apiClient from './client'

// Đổi endpoint cho khớp backend. Hiện các trang Manager đang dùng dữ liệu mẫu (data.js trong từng thư mục).
export const getGradeWindows = () => apiClient.get('/manager/grades/windows').then((r) => r.data)
export const saveGradeWindow = (courseId, body) => apiClient.put(`/manager/grades/windows/${courseId}`, body).then((r) => r.data)
export const getClassGrades = (classId) => apiClient.get(`/manager/grades/classes/${classId}`).then((r) => r.data)
export const saveClassGrades = (classId, body) => apiClient.put(`/manager/grades/classes/${classId}`, body).then((r) => r.data)
export const importGrades = (file) => { const f = new FormData(); f.append('file', file); return apiClient.post('/manager/grades/import', f).then((r) => r.data) }
