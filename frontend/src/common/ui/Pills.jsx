// items: [{ value, label }] — bộ lọc dạng viên thuốc
export default function Pills({ items, value, onChange, large, className = '' }) {
  return (
    <div className={['u-pills', large && 'u-pills--lg', className].filter(Boolean).join(' ')} role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={value === item.value ? 'u-pill is-active' : 'u-pill'}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// Nhóm nút chọn 1 trong n dạng phân đoạn (vd. Tất cả | Theo lớp | Theo học viên)
export function Segmented({ items, value, onChange }) {
  return (
    <div className="u-seg">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={value === item.value ? `is-active ${item.danger ? 'is-danger' : ''}` : ''}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
