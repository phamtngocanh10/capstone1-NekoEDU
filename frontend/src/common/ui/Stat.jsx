import Chip from './Chip'

// Thẻ số liệu có icon + vạch màu trên cùng (Tổng quan, Học viên, Học phí, Thu chi).
// accent: brand | blue | green | red | amber | sky ; tone: màu ô icon.
export function StatCard({ icon: Icon, label, value, accent = 'brand', tone, badge, delta, deltaTone = 'green', deltaIcon, onClick }) {
  return (
    <div className={`u-stat u-stat--${accent}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="u-stat__top">
        {Icon && <span className={`u-stat__icon ${tone ? `u-stat__icon--${tone}` : ''}`}><Icon size={17} /></span>}
        {badge}
      </div>
      <span className="u-stat__label">{label}</span>
      <div className="u-stat__bottom">
        <strong className="u-stat__value">{value}</strong>
        {delta && <Chip tone={deltaTone} icon={deltaIcon}>{delta}</Chip>}
      </div>
    </div>
  )
}

// Thẻ số liệu gọn: nhãn nhỏ + giá trị. accent: hiện vạch màu trên cùng.
export function MiniStat({ label, value, tone, accent, delta, deltaTone = 'green', lg, children }) {
  const style = accent ? { '--accent': accent } : undefined
  const color = tone ? { color: `var(--${tone})` } : undefined
  return (
    <div className={`u-mini ${accent ? 'u-mini--accent' : ''}`} style={style}>
      <span className="u-mini__label">{label}</span>
      <div className="u-mini__row">
        <strong className={`u-mini__value ${lg ? 'u-mini__value--lg' : ''}`} style={color}>{value}</strong>
        {delta && <Chip tone={deltaTone}>{delta}</Chip>}
        {children}
      </div>
    </div>
  )
}
