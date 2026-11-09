import { Search } from 'lucide-react'

export default function SearchBox({ value, onChange, placeholder = 'Tìm kiếm...', small, className = '' }) {
  return (
    <label className={['u-search', small && 'u-search--sm', className].filter(Boolean).join(' ')}>
      <Search size={small ? 14 : 15} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  )
}
