import apiClient from './client'

export const getDashboard = () => apiClient.get('/manager/dashboard').then((response) => response.data)
export const getNotifications = () => apiClient.get('/notifications').then((response) => response.data)
export const markAllNotificationsRead = () => apiClient.post('/notifications/read-all').then((response) => response.data)
