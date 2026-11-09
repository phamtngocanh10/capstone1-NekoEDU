import apiClient from './client'
import { getProfile, normalizeUser } from './auth'

export async function updateProfile(data) {
  await apiClient.put('/auth/profile', {
    full_name: data.name.trim(), email: data.email.trim(),
    phone: data.phone?.replace(/\s/g, '') || null, address: data.address?.trim() || null,
  })
  return getProfile()
}

export async function uploadAvatar(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post('/auth/avatar', form)
  return normalizeUser(data)
}

export async function avatarSource() {
  const { data } = await apiClient.get('/auth/avatar', { responseType: 'blob' })
  return URL.createObjectURL(data)
}

export { changePassword } from './auth'
export const logout = () => apiClient.post('/auth/logout').then((response) => response.data)
