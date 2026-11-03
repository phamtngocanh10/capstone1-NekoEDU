import apiClient from './client'

export const updateProfile = (data) => apiClient.put('/auth/profile', data).then((response) => response.data)
export const changePassword = (data) => apiClient.post('/auth/change-password', data).then((response) => response.data)
export const logout = () => apiClient.post('/auth/logout').then((response) => response.data)
