import apiClient from './client'

export const getGradeWindows = () => apiClient.get('/manager/grades/windows').then((response) => response.data)
export const saveGradeWindow = (courseId, body) => apiClient.put(`/manager/grades/windows/${courseId}`, body).then((response) => response.data)
export const getClassGrades = (classId, test) => apiClient.get(`/manager/grades/classes/${classId}`, { params: { test } }).then((response) => response.data)
export const saveClassGrades = (classId, body) => apiClient.put(`/manager/grades/classes/${classId}`, body).then((response) => response.data)
export const reopenClassGrades = (classId, test) => apiClient.post(`/manager/grades/classes/${classId}/reopen`, { test }).then(response => response.data)
export const remindGrades = body => apiClient.post('/manager/grades/remind', body).then(response => response.data)
export const confirmGradesImport = body => apiClient.post('/manager/grades/import/confirm', body).then(response => response.data)
export function importGrades(file, body = {}) {
  const formData = new FormData()
  formData.append('file', file)
  for (const [key, value] of Object.entries(body)) if (value) formData.append(key, value)
  return apiClient.post('/manager/grades/import', formData).then((response) => response.data)
}
