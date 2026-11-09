import apiClient from './client'

export const getAdmissionForecast = (scope) => apiClient.get(`/manager/admissions/forecast/${scope}`).then((response) => response.data)
export const getRetention = () => apiClient.get('/manager/admissions/retention').then((response) => response.data)
export const getDropout = () => apiClient.get('/manager/admissions/dropout').then((response) => response.data)
export const reviewProposal = (id, decision, note = '') => apiClient.post(`/manager/ai-alerts/${id}/review`, { decision, note }).then((response) => response.data)
