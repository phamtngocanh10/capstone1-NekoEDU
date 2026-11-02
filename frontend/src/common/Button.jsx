// variant: 'primary' | 'ghost'
export default function Button({ variant = 'primary', block, className = '', children, ...props }) {
  const cls = ['btn', `btn--${variant}`, block && 'btn--block', className].filter(Boolean).join(' ')
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  )
}
