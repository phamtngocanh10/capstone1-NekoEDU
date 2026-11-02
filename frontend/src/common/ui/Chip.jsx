// tone: gray | green | red | amber | blue | sky
export default function Chip({ tone = 'gray', size, icon: Icon, className = '', children }) {
  const cls = ['u-chip', `u-chip--${tone}`, size && `u-chip--${size}`, className].filter(Boolean).join(' ')
  return (
    <span className={cls}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  )
}
