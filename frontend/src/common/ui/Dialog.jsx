import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// size: sm | md (mặc định) | lg | xl ; tone="danger" → vạch đỏ, tone="plain" → không có vạch màu ; bare → không có header (hộp thoại xác nhận)
export default function Dialog({ title, subtitle, onClose, size, tone, bare, children }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement
    const focusableSelector = 'a[href], button, input:not([type="hidden"]), select, textarea, [contenteditable="true"], [tabindex]'
    function focusableElements() {
      return [...dialog.querySelectorAll(focusableSelector)].filter(element =>
        element.tabIndex >= 0 && !element.disabled
        && !element.closest('[hidden], [inert], [aria-hidden="true"]')
        && element.getClientRects().length > 0
        && getComputedStyle(element).visibility !== 'hidden')
    }
    function handleKeyDown(event) {
      const dialogs = document.querySelectorAll('[data-ui-dialog]')
      if (dialogs[dialogs.length - 1] !== dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      } else if (event.key === 'Tab') {
        const elements = focusableElements()
        const first = elements[0]
        const last = elements.at(-1)
        if (!first) {
          event.preventDefault()
          dialog.focus({ preventScroll: true })
        } else if (!elements.includes(document.activeElement)) {
          event.preventDefault()
          const target = event.shiftKey ? last : first
          target.focus({ preventScroll: true })
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus({ preventScroll: true })
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus({ preventScroll: true })
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const elements = focusableElements()
    const initial = elements.find(element => element.matches('[autofocus], [data-autofocus]'))
      || elements.find(element => element.matches('input, select, textarea, [contenteditable="true"]'))
      || elements[0] || dialog
    initial.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (trigger?.isConnected && typeof trigger.focus === 'function') trigger.focus({ preventScroll: true })
    }
  }, [])

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
      <div ref={dialogRef} data-ui-dialog tabIndex={-1} className={classes} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
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
