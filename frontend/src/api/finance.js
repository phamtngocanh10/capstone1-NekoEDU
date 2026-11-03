import apiClient from './client'

// Đổi endpoint cho khớp backend. Hiện các trang Manager đang dùng dữ liệu mẫu (data.js trong từng thư mục).
export const getTuition = (params) => apiClient.get('/manager/tuition', { params }).then((response) => response.data)
export const getTuitionRisks = () => apiClient.get('/manager/tuition/risks').then((response) => response.data)
export const getPayments = (studentId) => apiClient.get(`/manager/students/${studentId}/payments`).then((response) => response.data)
export const collectPayment = (body) => apiClient.post('/manager/payments', body).then((response) => response.data)
export const getLedger = () => apiClient.get('/manager/ledger').then((response) => response.data)
export const addLedgerEntry = (body) => apiClient.post('/manager/ledger', body).then((response) => response.data)
export const closePayroll = (month) => apiClient.post(`/manager/payroll/${month}/close`).then((response) => response.data)
