// tone: gray | green | red | amber | blue | sky
export default function Chip({ tone = 'gray', size, icon: Icon, className = '', children }) {
  const classes = ['u-chip', `u-chip--${tone}`, size && `u-chip--${size}`, className].filter(Boolean).join(' ')
  return (
    <span className={classes}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  )
}
