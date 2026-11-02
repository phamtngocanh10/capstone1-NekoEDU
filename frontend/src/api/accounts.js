import apiClient from './client'

// Đổi endpoint cho khớp backend. Hiện các trang Manager đang dùng dữ liệu mẫu (data.js trong từng thư mục).
export const getAccounts = () => apiClient.get('/manager/accounts').then((r) => r.data)
export const createAccount = (body) => apiClient.post('/manager/accounts', body).then((r) => r.data)
export const lockAccount = (id, body) => apiClient.post(`/manager/accounts/${id}/lock`, body).then((r) => r.data)
export const unlockAccount = (id) => apiClient.post(`/manager/accounts/${id}/unlock`).then((r) => r.data)
export const deleteAccount = (id) => apiClient.delete(`/manager/accounts/${id}`).then((r) => r.data)
export const getRolePermissions = (role) => apiClient.get(`/manager/roles/${encodeURIComponent(role)}/permissions`).then((r) => r.data)
export const saveRolePermissions = (role, body) => apiClient.put(`/manager/roles/${encodeURIComponent(role)}/permissions`, body).then((r) => r.data)
