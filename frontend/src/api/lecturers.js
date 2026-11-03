import apiClient from './client'

// Đổi endpoint cho khớp backend. Hiện các trang Manager đang dùng dữ liệu mẫu (data.js trong từng thư mục).
export const getLecturers = (params) => apiClient.get('/manager/lecturers', { params }).then((response) => response.data)
export const getLecturer = (id) => apiClient.get(`/manager/lecturers/${id}`).then((response) => response.data)
export const createLecturer = (body) => apiClient.post('/manager/lecturers', body).then((response) => response.data)
export const updateLecturer = (id, body) => apiClient.put(`/manager/lecturers/${id}`, body).then((response) => response.data)
export const assignClass = (id, body) => apiClient.post(`/manager/lecturers/${id}/assignments`, body).then((response) => response.data)
export const stopTeaching = (id, body) => apiClient.post(`/manager/lecturers/${id}/stop`, body).then((response) => response.data)
