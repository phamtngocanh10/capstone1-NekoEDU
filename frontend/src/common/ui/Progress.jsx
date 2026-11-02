// color: biến CSS hoặc mã màu, vd. 'var(--success-fill)'
export default function Progress({ value, max = 100, color, large, label, style }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      className={large ? 'u-progress u-progress--lg' : 'u-progress'}
      style={{ ...(color ? { '--bar': color } : {}), ...style }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}
