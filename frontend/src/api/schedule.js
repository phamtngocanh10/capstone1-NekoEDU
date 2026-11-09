import apiClient from './client'

export const getWeekSchedule = (weekStart) => apiClient.get('/manager/schedule', { params: { weekStart } }).then((response) => response.data)
export const getScheduleRange = (start, end) => apiClient.get('/manager/schedule', { params: { start, end } }).then(response => response.data)
export const getSlotDetail = (date, slot) => apiClient.get('/manager/schedule/slot', { params: { date, slot } }).then((response) => response.data)
export const cancelLesson = (id, body) => apiClient.post(`/manager/lessons/${id}/cancel`, body).then((response) => response.data)
