import apiClient from './client'

export const getAnnouncements = () => apiClient.get('/manager/announcements').then((response) => response.data)
export const getAnnouncement = (id) => apiClient.get(`/manager/announcements/${id}`).then((response) => response.data)
export const createAnnouncement = (body) => apiClient.post('/manager/announcements', body).then((response) => response.data)
export const updateAnnouncement = (id, body) => apiClient.patch(`/manager/announcements/${id}`, body).then((response) => response.data)
export const getAnnouncementOptions = () => apiClient.get('/manager/announcements/options').then((response) => response.data)
export const sendAnnouncement = (id) => apiClient.post(`/manager/announcements/${id}/send`).then((response) => response.data)
export const remindAnnouncement = (id) => apiClient.post(`/manager/announcements/${id}/remind`).then((response) => response.data)
export const previewAnnouncement = (id) => apiClient.post(`/manager/announcements/${id}/preview`).then((response) => response.data)
export const replyAnnouncement = (id, content) => apiClient.post(`/manager/announcements/${id}/replies`, { content }).then((response) => response.data)
export async function downloadAnnouncementFile(file) {
  const response = await apiClient.get(`/manager/operations/files/${file.id}`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  URL.revokeObjectURL(url)
}
