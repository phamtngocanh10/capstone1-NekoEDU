import apiClient from './client'

// Đổi endpoint cho khớp backend. Hiện các trang Manager đang dùng dữ liệu mẫu (data.js trong từng thư mục).
export const getAnnouncements = () => apiClient.get('/manager/announcements').then((r) => r.data)
export const getAnnouncement = (id) => apiClient.get(`/manager/announcements/${id}`).then((r) => r.data)
export const createAnnouncement = (body) => apiClient.post('/manager/announcements', body).then((r) => r.data)
