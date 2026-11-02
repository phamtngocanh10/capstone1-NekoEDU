// items: [{ value, label }] — bộ lọc dạng viên thuốc
export default function Pills({ items, value, onChange, large, className = '' }) {
  return (
    <div className={['u-pills', large && 'u-pills--lg', className].filter(Boolean).join(' ')} role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          className={value === it.value ? 'u-pill is-active' : 'u-pill'}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

// Nhóm nút chọn 1 trong n dạng phân đoạn (vd. Tất cả | Theo lớp | Theo học viên)
export function Segmented({ items, value, onChange }) {
  return (
    <div className="u-seg">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          className={value === it.value ? `is-active ${it.danger ? 'is-danger' : ''}` : ''}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
