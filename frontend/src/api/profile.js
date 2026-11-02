import apiClient from './client'

export const updateProfile = (data) => apiClient.put('/auth/profile', data).then((r) => r.data)
export const changePassword = (data) => apiClient.post('/auth/change-password', data).then((r) => r.data)
export const logout = () => apiClient.post('/auth/logout').then((r) => r.data)
