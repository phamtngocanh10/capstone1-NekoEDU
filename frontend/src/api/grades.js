import apiClient from './client'

// Đổi endpoint cho khớp backend. Hiện các trang Manager đang dùng dữ liệu mẫu (data.js trong từng thư mục).
export const getGradeWindows = () => apiClient.get('/manager/grades/windows').then((response) => response.data)
export const saveGradeWindow = (courseId, body) => apiClient.put(`/manager/grades/windows/${courseId}`, body).then((response) => response.data)
export const getClassGrades = (classId) => apiClient.get(`/manager/grades/classes/${classId}`).then((response) => response.data)
export const saveClassGrades = (classId, body) => apiClient.put(`/manager/grades/classes/${classId}`, body).then((response) => response.data)
export function importGrades(file) {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.post('/manager/grades/import', formData).then((response) => response.data)
}
