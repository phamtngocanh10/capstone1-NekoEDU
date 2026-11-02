import apiClient from './client'

// Đổi endpoint cho khớp backend. Hiện các trang Manager đang dùng dữ liệu mẫu (data.js trong từng thư mục).
export const getCourses = () => apiClient.get('/manager/courses').then((r) => r.data)
export const getClasses = (params) => apiClient.get('/manager/classes', { params }).then((r) => r.data)
export const getClass = (id) => apiClient.get(`/manager/classes/${id}`).then((r) => r.data)
export const createClass = (body) => apiClient.post('/manager/classes', body).then((r) => r.data)
