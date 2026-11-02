import { Link } from 'react-router-dom'
import { CloudUpload } from 'lucide-react'

export function BackLink({ to, children }) {
  return <Link to={to} className="u-back">← {children}</Link>
}

// tone: amber | red | blue
export function Notice({ tone = 'amber', title, children, className = '' }) {
  return (
    <div className={`u-notice u-notice--${tone} ${className}`.trim()}>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  )
}

// items: [{ label, value }]
export function InfoGrid({ items, cols = 2 }) {
  return (
    <dl className="u-info" style={{ '--cols': cols }}>
      {items.map((it) => (
        <div key={it.label}>
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// Vùng kéo thả / chọn tệp. onFiles nhận FileList.
export function DropZone({ title = 'Kéo thả tệp vào đây', hint, light, icon: Icon = CloudUpload, onFiles, accept, multiple }) {
  return (
    <label className={light ? 'u-drop u-drop--light' : 'u-drop'}>
      <Icon size={20} />
      {title}
      {hint && <small>{hint}</small>}
      <input
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => e.target.files?.length && onFiles?.(e.target.files)}
      />
    </label>
  )
}
