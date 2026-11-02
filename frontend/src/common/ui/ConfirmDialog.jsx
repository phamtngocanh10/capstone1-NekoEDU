import { TriangleAlert } from 'lucide-react'
import Dialog from './Dialog'
import Btn from './Btn'
import { Notice } from './Misc'

// Hộp thoại xác nhận hành động nguy hiểm (xóa hồ sơ...). notice: { title, text }
export default function ConfirmDialog({ icon: Icon = TriangleAlert, title, children, notice, confirmLabel, confirmIcon, onConfirm, onClose }) {
  return (
    <Dialog bare size="sm" tone="danger" title={title} onClose={onClose}>
      <span className="u-modal__icon"><Icon size={22} /></span>
      <h2 className="u-modal__title">{title}</h2>
      <p className="u-modal__sub">{children}</p>
      {notice && <Notice tone="amber" title={notice.title}>{notice.text}</Notice>}
      <div className="u-modal__foot">
        <Btn variant="muted" size="sq" onClick={onClose}>Hủy</Btn>
        <Btn variant="danger" size="sq" icon={confirmIcon} onClick={onConfirm}>{confirmLabel}</Btn>
      </div>
    </Dialog>
  )
}
