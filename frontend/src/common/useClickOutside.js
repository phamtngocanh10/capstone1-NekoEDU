import { useEffect } from 'react'

// Gọi handler khi click ra ngoài phần tử ref hoặc bấm Esc (dùng cho dropdown).
export default function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler()
    }
    const onKey = (e) => e.key === 'Escape' && handler()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, handler, active])
}
