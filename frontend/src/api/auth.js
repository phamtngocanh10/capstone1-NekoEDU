import apiClient from './client'

// Mẫu: mỗi module 1 file. Đổi endpoint/payload cho khớp backend.
export const login = (data) => apiClient.post('/auth/login', data).then((r) => r.data)
export const getProfile = () => apiClient.get('/auth/me').then((r) => r.data)
