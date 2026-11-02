import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react'

const ManagerContext = createContext(null)

// Dữ liệu mẫu — thay bằng getProfile() khi có backend.
const INITIAL_USER = {
  name: 'Phạm Thị Ngọc Anh',
  role: 'Manager',
  email: 'ngocanh@nekoedu.vn',
  phone: '0901 234 567',
  address: '25 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
  joined: '03/2023',
}

export function ManagerProvider({ children }) {
  const [user, setUser] = useState(INITIAL_USER)
  const [pwOpen, setPwOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [header, setHeader] = useState(null) // tiêu đề riêng của trang con, đặt bằng usePageHeader()

  const updateUser = useCallback((patch) => setUser((u) => ({ ...u, ...patch })), [])
  const openPasswordModal = useCallback(() => setPwOpen(true), [])
  const closePasswordModal = useCallback(() => setPwOpen(false), [])
  const notify = useCallback((message) => setToast(message), [])
  const clearToast = useCallback(() => setToast(null), [])

  const value = useMemo(
    () => ({ user, updateUser, pwOpen, openPasswordModal, closePasswordModal, toast, notify, clearToast, header, setHeader }),
    [user, updateUser, pwOpen, openPasswordModal, closePasswordModal, toast, notify, clearToast, header],
  )
  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useManager() {
  const ctx = useContext(ManagerContext)
  if (!ctx) throw new Error('useManager phải nằm trong <ManagerProvider>')
  return ctx
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
