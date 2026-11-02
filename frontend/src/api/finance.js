import apiClient from './client'

// Đổi endpoint cho khớp backend. Hiện các trang Manager đang dùng dữ liệu mẫu (data.js trong từng thư mục).
export const getTuition = (params) => apiClient.get('/manager/tuition', { params }).then((r) => r.data)
export const getTuitionRisks = () => apiClient.get('/manager/tuition/risks').then((r) => r.data)
export const getPayments = (studentId) => apiClient.get(`/manager/students/${studentId}/payments`).then((r) => r.data)
export const collectPayment = (body) => apiClient.post('/manager/payments', body).then((r) => r.data)
export const getLedger = () => apiClient.get('/manager/ledger').then((r) => r.data)
export const addLedgerEntry = (body) => apiClient.post('/manager/ledger', body).then((r) => r.data)
export const closePayroll = (month) => apiClient.post(`/manager/payroll/${month}/close`).then((r) => r.data)
