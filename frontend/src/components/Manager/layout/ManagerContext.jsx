import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { getProfile } from '../../../api/auth'

const ManagerContext = createContext(null)

const INITIAL_USER = {
  name: '',
  role: 'Manager',
  email: '', phone: '', address: '', joined: '',
}

export function ManagerProvider({ children, initialUser = INITIAL_USER }) {
  const [user, setUser] = useState(() => {
    if (initialUser !== INITIAL_USER) return initialUser
    try {
      const account = JSON.parse(localStorage.getItem('neko-auth-user'))
      return account?.role === 'Manager' ? { ...INITIAL_USER, ...account } : initialUser
    } catch { return initialUser }
  })
  const [pwOpen, setPwOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [header, setHeader] = useState(null) // tiêu đề riêng của trang con, đặt bằng usePageHeader()

  useEffect(() => {
    let mounted = true
    getProfile().then(account => { if (mounted) setUser(account) })
      .catch(error => { if (mounted) setToast(error.message) })
    return () => { mounted = false }
  }, [])

  const updateUser = useCallback((changes) => {
    setUser((currentUser) => {
      const next = { ...currentUser, ...changes }
      localStorage.setItem('neko-auth-user', JSON.stringify(next))
      return next
    })
  }, [])
  const openPasswordModal = useCallback(() => setPwOpen(true), [])
  const closePasswordModal = useCallback(() => setPwOpen(false), [])
  const notify = useCallback((message) => setToast(message), [])
  const clearToast = useCallback(() => setToast(null), [])

  const value = useMemo(
    () => ({
      user,
      updateUser,
      pwOpen,
      openPasswordModal,
      closePasswordModal,
      toast,
      notify,
      clearToast,
      header,
      setHeader,
    }),
    [user, updateUser, pwOpen, openPasswordModal, closePasswordModal, toast, notify, clearToast, header],
  )
  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useManager() {
  const context = useContext(ManagerContext)
  if (!context) throw new Error('useManager phải nằm trong <ManagerProvider>')
  return context
}

export const shortName = (name) => name.trim().split(/\s+/).slice(-2).join(' ')
// Chữ cái đầu của tên gọi ngắn ("Ngọc Anh" → N) — khớp avatar trên Header trong Figma
export const initialOf = (name) => shortName(name).charAt(0).toUpperCase()

// Trang con (hồ sơ, chi tiết...) gọi hook này để đặt tiêu đề + mô tả trên Header.
// eslint-disable-next-line react-refresh/only-export-components
export function usePageHeader(title, subtitle) {
  const { setHeader } = useManager()
  useLayoutEffect(() => {
    setHeader({ title, subtitle })
    return () => setHeader(null)
  }, [title, subtitle, setHeader])
}
