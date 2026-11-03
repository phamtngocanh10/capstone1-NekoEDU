import { Link } from 'react-router-dom'

// variant: primary | soft | ghost | muted | danger | danger-soft | outline-danger | icon
// size: md | sm | xs | sq (nút trong modal)
export default function Btn({ variant = 'primary', size, to, icon: Icon, iconRight: IconRight, className = '', children, ...props }) {
  const classes = ['u-btn', `u-btn--${variant}`, size && `u-btn--${size}`, className].filter(Boolean).join(' ')
  const iconSize = size === 'xs' || size === 'sm' ? 13 : 15
  const inner = (
    <>
      {Icon && <Icon size={iconSize} />}
      {children}
      {IconRight && <IconRight size={iconSize} />}
    </>
  )
  if (to) return <Link to={to} className={classes} {...props}>{inner}</Link>
  return <button type="button" className={classes} {...props}>{inner}</button>
}
