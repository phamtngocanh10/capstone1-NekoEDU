import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// size: sm | md (mặc định) | lg | xl ; tone="danger" → vạch đỏ, tone="plain" → không có vạch màu ; bare → không có header (hộp thoại xác nhận)
export default function Dialog({ title, subtitle, onClose, size, tone, bare, children }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const classes = ['u-modal', size && `u-modal--${size}`, tone === 'danger' && 'u-modal--danger', tone === 'plain' && 'u-modal--plain', bare && 'u-modal--center']
    .filter(Boolean)
    .join(' ')
  const closeButton = (
    <button type="button" className="u-modal__close" onClick={onClose} aria-label="Đóng">
      <X size={15} />
    </button>
  )

  return createPortal(
    <div className="u-overlay" onMouseDown={onClose}>
      <div className={classes} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        {bare ? closeButton : (
          <header className="u-modal__head">
            <div>
              <h2 className="u-modal__title">{title}</h2>
              {subtitle && <p className="u-modal__sub">{subtitle}</p>}
            </div>
            {closeButton}
          </header>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
