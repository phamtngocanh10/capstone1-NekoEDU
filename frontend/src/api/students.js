import apiClient from './client'

export const getStudents = (params) => apiClient.get('/students', { params }).then((response) => response.data)
export const getStudent = (id) => apiClient.get(`/students/${id}`).then((response) => response.data)
export const createStudent = (body) => apiClient.post('/students', body).then((response) => response.data)
export const updateStudent = (id, body) => apiClient.patch(`/students/${id}`, body).then((response) => response.data)

// Manager form adapter includes guardian/account/enrollment in one SQL transaction.
export const getManagedStudents = () => apiClient.get('/manager/students').then((response) => response.data)
export const getManagedStudent = (id) => apiClient.get(`/manager/students/${encodeURIComponent(id)}`).then((response) => response.data)
export const saveManagedStudent = (body, id) => (id
  ? apiClient.patch(`/manager/students/${id}`, body)
  : apiClient.post('/manager/students', body)).then((response) => response.data)
export const deleteStudent = (id) => apiClient.delete(`/manager/students/${id}`).then((response) => response.data)
export const importStudents = (file) => {
  const body = new FormData()
  body.append('file', file)
  return apiClient.post('/manager/students/import', body).then((response) => response.data)
}
