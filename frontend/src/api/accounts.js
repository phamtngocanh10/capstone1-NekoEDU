import apiClient from './client'

export const getAccounts = () => apiClient.get('/manager/accounts').then((response) => response.data)
export const createAccount = (body) => apiClient.post('/manager/accounts', body).then((response) => response.data)
export const updateAccount = (id, body) => apiClient.put(`/manager/accounts/${id}`, body).then((response) => response.data)
export const lockAccount = (id, body) => apiClient.post(`/manager/accounts/${id}/lock`, body).then((response) => response.data)
export const unlockAccount = (id) => apiClient.post(`/manager/accounts/${id}/unlock`).then((response) => response.data)
export const deleteAccount = (id) => apiClient.delete(`/manager/accounts/${id}`).then((response) => response.data)
export const getRolePermissions = (role, params) => apiClient.get(`/manager/roles/${encodeURIComponent(role)}/permissions`, { params }).then((response) => response.data)
export const saveRolePermissions = (role, body) => apiClient.put(`/manager/roles/${encodeURIComponent(role)}/permissions`, body).then((response) => response.data)
