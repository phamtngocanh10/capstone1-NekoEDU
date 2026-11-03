// initial: 'first' (chữ cái đầu họ) | 'last' (chữ cái đầu tên) — Figma dùng cả hai kiểu tuỳ màn hình.
const getInitial = (name, mode) => {
  const words = name.trim().split(/\s+/)
  return (mode === 'last' ? words[words.length - 1] : words[0]).charAt(0).toUpperCase()
}

export default function Avatar({ name = '?', size = 30, tone, initial = 'first', className = '' }) {
  const classes = ['u-avatar', tone && `u-avatar--${tone}`, className].filter(Boolean).join(' ')
  return <span className={classes} style={{ '--s': `${size}px` }}>{getInitial(name, initial)}</span>
}
