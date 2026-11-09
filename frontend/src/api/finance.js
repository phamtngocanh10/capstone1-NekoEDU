import apiClient from './client'

export const getTuition = (params) => apiClient.get('/manager/tuition', { params }).then((response) => response.data)
export const getTuitionRisks = () => apiClient.get('/manager/tuition/risks').then((response) => response.data)
export const remindTuitionRisk = (id) => apiClient.post(`/manager/tuition/risks/${id}/remind`).then((response) => response.data)
export const getPayments = (studentId) => apiClient.get(`/manager/students/${studentId}/payments`).then((response) => response.data)
export const collectPayment = (body) => apiClient.post('/manager/payments', body).then((response) => response.data)
export const getLedger = () => apiClient.get('/manager/ledger').then((response) => response.data)
export const addLedgerEntry = (body) => apiClient.post('/manager/ledger', body).then((response) => response.data)
export const closePayroll = (month) => apiClient.post(`/manager/payroll/${month}/close`).then((response) => response.data)

export const operationError = (error) => error.response?.data?.message || error.message || 'Không thể kết nối máy chủ'
export function sqlDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parts = String(value).split('/')
  if (parts.length !== 3) throw new Error('Ngày phải có dạng dd/mm/yyyy')
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
}
export async function encodeFiles(files = []) {
  return Promise.all(files.filter(Boolean).map(async (file) => {
    if (!(file instanceof File)) throw new Error('Vui lòng chọn lại tệp chứng từ từ máy tính')
    if (file.size < 1 || file.size > 20 * 1024 * 1024) throw new Error('Tệp phải từ 1 byte đến 20 MB')
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1])
      reader.onerror = () => reject(new Error('Không đọc được tệp'))
      reader.readAsDataURL(file)
    })
    return { name: file.name, mime: file.type || 'application/octet-stream', content }
  }))
}
