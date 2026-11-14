import apiClient from './client'

const ROLE_NAMES = { MANAGER: 'Manager', LECTURER: 'Lecturer', TEACHING_ASSISTANT: 'Teaching Assistant' }
export const ROLE_HOME = { manager: '/tongquan', lecturer: '/lecturer/tongquan', 'teaching assistant': '/assistant/tongquan' }

export function normalizeUser(account) {
  const role = ROLE_NAMES[account?.role?.code]
  if (!role) throw new Error('Vai trò này chưa được hỗ trợ trên giao diện.')
  const created = account.created_at ? new Date(account.created_at) : null
  return {
    id: String(account.id), username: account.username, name: account.full_name,
    staffId: account.profile?.type === 'STAFF' ? String(account.profile.id) : account.staffId ?? null,
    role, email: account.email ?? '', phone: account.phone ?? '',
    address: account.address ?? '', avatarUrl: account.avatar_url ?? null,
    joined: created && !Number.isNaN(created.getTime())
      ? created.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' }) : '',
  }
}

export async function login({ username, password }) {
  const { data } = await apiClient.post('/auth/login', { username: username.trim(), password })
  const user = normalizeUser(data.user)
  return { access_token: data.access_token, user }
}

export async function getProfile() {
  const { data } = await apiClient.get('/auth/me')
  const user = normalizeUser(data)
  localStorage.setItem('neko-auth-user', JSON.stringify(user))
  return user
}

export async function changePassword({ currentPassword, newPassword }) {
  await apiClient.patch('/auth/password', {
    current_password: currentPassword, new_password: newPassword, confirm_password: newPassword,
  })
  localStorage.removeItem('access_token')
  localStorage.removeItem('neko-auth-user')
  return { requiresLogin: true }
}
