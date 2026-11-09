import { Link } from 'react-router-dom'

export function Card({ pad = true, className = '', children, ...rest }) {
  return (
    <section className={['u-card', pad && 'u-card--pad', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </section>
  )
}

// action: nhãn liên kết bên phải; to: đường dẫn; onAction: callback
export function CardHead({ title, sub, action, to, onAction, children }) {
  return (
    <div className="u-card__head">
      <div>
        <h3 className="u-card__title">{title}</h3>
        {sub && <p className="u-card__sub">{sub}</p>}
      </div>
      {children}
      {action && (to ? <Link to={to} className="u-link">{action}</Link> : <button type="button" className="u-link" onClick={onAction}>{action}</button>)}
    </div>
  )
}
