import apiClient from './client'

// Đổi endpoint cho khớp backend. Hiện trang Tổng quan đang dùng dữ liệu mẫu (data.js).
export const getDashboard = () => apiClient.get('/manager/dashboard').then((r) => r.data)
export const getNotifications = () => apiClient.get('/notifications').then((r) => r.data)
export const markAllNotificationsRead = () => apiClient.post('/notifications/read-all').then((r) => r.data)
