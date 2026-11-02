import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// size: sm | md (mặc định) | lg | xl ; tone="danger" → vạch đỏ, tone="plain" → không có vạch màu ; bare → không có header (hộp thoại xác nhận)
export default function Dialog({ title, subtitle, onClose, size, tone, bare, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const cls = ['u-modal', size && `u-modal--${size}`, tone === 'danger' && 'u-modal--danger', tone === 'plain' && 'u-modal--plain', bare && 'u-modal--center']
    .filter(Boolean)
    .join(' ')
  const close = (
    <button type="button" className="u-modal__close" onClick={onClose} aria-label="Đóng">
      <X size={15} />
    </button>
  )

  return createPortal(
    <div className="u-overlay" onMouseDown={onClose}>
      <div className={cls} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        {bare ? close : (
          <header className="u-modal__head">
            <div>
              <h2 className="u-modal__title">{title}</h2>
              {subtitle && <p className="u-modal__sub">{subtitle}</p>}
            </div>
            {close}
          </header>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
