import { Link } from 'react-router-dom'

// variant: primary | soft | ghost | muted | danger | danger-soft | outline-danger | icon
// size: md | sm | xs | sq (nút trong modal)
export default function Btn({ variant = 'primary', size, to, icon: Icon, iconRight: IconRight, className = '', children, ...props }) {
  const cls = ['u-btn', `u-btn--${variant}`, size && `u-btn--${size}`, className].filter(Boolean).join(' ')
  const px = size === 'xs' || size === 'sm' ? 13 : 15
  const inner = (
    <>
      {Icon && <Icon size={px} />}
      {children}
      {IconRight && <IconRight size={px} />}
    </>
  )
  if (to) return <Link to={to} className={cls} {...props}>{inner}</Link>
  return <button type="button" className={cls} {...props}>{inner}</button>
}
