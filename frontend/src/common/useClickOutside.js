import { useEffect } from 'react'

// Gọi handler khi click ra ngoài phần tử ref hoặc bấm Esc (dùng cho dropdown).
export default function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return
    function handleMouseDown(event) {
      if (ref.current && !ref.current.contains(event.target)) handler()
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') handler()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [ref, handler, active])
}
