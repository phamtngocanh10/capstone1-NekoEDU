import apiClient from './client'

export const getLevels = () => apiClient.get('/levels').then((response) => response.data)
