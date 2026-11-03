import apiClient from './client'

// Đổi endpoint cho khớp backend. Hiện các trang Manager đang dùng dữ liệu mẫu (data.js trong từng thư mục).
export const getAdmissionForecast = (scope) => apiClient.get(`/manager/admissions/forecast/${scope}`).then((response) => response.data)
export const getRetention = () => apiClient.get('/manager/admissions/retention').then((response) => response.data)
export const getDropout = () => apiClient.get('/manager/admissions/dropout').then((response) => response.data)
