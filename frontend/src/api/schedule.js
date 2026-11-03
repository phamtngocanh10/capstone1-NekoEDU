import apiClient from './client'

// Đổi endpoint cho khớp backend. Hiện các trang Manager đang dùng dữ liệu mẫu (data.js trong từng thư mục).
export const getWeekSchedule = (weekStart) => apiClient.get('/manager/schedule', { params: { weekStart } }).then((response) => response.data)
export const getSlotDetail = (date, slot) => apiClient.get('/manager/schedule/slot', { params: { date, slot } }).then((response) => response.data)
export const cancelLesson = (id, body) => apiClient.post(`/manager/lessons/${id}/cancel`, body).then((response) => response.data)
