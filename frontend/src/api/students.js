import apiClient from './client'

// Đổi endpoint cho khớp backend. Hiện các trang Manager đang dùng dữ liệu mẫu (data.js trong từng thư mục).
export const getStudents = (params) => apiClient.get('/manager/students', { params }).then((r) => r.data)
export const getStudent = (id) => apiClient.get(`/manager/students/${id}`).then((r) => r.data)
export const createStudent = (body) => apiClient.post('/manager/students', body).then((r) => r.data)
export const updateStudent = (id, body) => apiClient.put(`/manager/students/${id}`, body).then((r) => r.data)
export const deleteStudent = (id) => apiClient.delete(`/manager/students/${id}`).then((r) => r.data)
// Backend nên trả file .xlsx/.pdf thật (responseType: 'blob'); bản mock hiện tải CSV.
export const exportStudents = (params) => apiClient.get('/manager/students/export', { params, responseType: 'blob' }).then((r) => r.data)
