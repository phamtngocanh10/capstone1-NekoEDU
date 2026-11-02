import { useId, useState } from 'react'
import { Check, ChevronDown, Eye, EyeOff } from 'lucide-react'

const optionOf = (o) => (typeof o === 'string' ? { value: o, label: o } : o)

function Shell({ label, required, full, hint, htmlFor, children }) {
  return (
    <div className={full ? 'u-field u-field--full' : 'u-field'}>
      {label && <label className="u-field__label" htmlFor={htmlFor}>{label}{required && <b> *</b>}</label>}
      {children}
      {hint && <span className="u-field__hint">{hint}</span>}
    </div>
  )
}

export function TextField({ label, icon: Icon, required, full, hint, error, trailing, small, ...input }) {
  const id = useId()
  return (
    <Shell label={label} required={required} full={full} hint={hint} htmlFor={id}>
      <div className={['u-control', error && 'u-control--error', small && 'u-control--sm'].filter(Boolean).join(' ')}>
        {Icon && <Icon size={16} />}
        <input id={id} {...input} />
        {trailing}
      </div>
    </Shell>
  )
}

export function PasswordField(props) {
  const [show, setShow] = useState(false)
  return (
    <TextField
      {...props}
      type={show ? 'text' : 'password'}
      trailing={
        <button type="button" className="u-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      }
    />
  )
}

// options: ['A', 'B'] hoặc [{ value, label }]
export function SelectField({ label, icon: Icon, options, required, full, hint, error, placeholder, small, ...select }) {
  const id = useId()
  return (
    <Shell label={label} required={required} full={full} hint={hint} htmlFor={id}>
      <div className={['u-control', error && 'u-control--error', small && 'u-control--sm'].filter(Boolean).join(' ')}>
        {Icon && <Icon size={16} />}
        <select id={id} {...select}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(optionOf).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} />
      </div>
    </Shell>
  )
}

export function TextAreaField({ label, required, full = true, error, ...area }) {
  const id = useId()
  return (
    <Shell label={label} required={required} full={full} htmlFor={id}>
      <div className={['u-control u-control--area', error && 'u-control--error'].filter(Boolean).join(' ')}>
        <textarea id={id} rows={2} {...area} />
      </div>
    </Shell>
  )
}

// Chọn 1 trong n dạng thẻ (Giới tính, Hình thức thanh toán, Vai trò...). options: [{ value, label, danger? }]
export function RadioChips({ label, options, value, onChange, cols = options.length, full }) {
  return (
    <Shell label={label} full={full}>
      <div className="u-radios" style={{ '--cols': cols }} role="radiogroup" aria-label={label}>
        {options.map(optionOf).map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={['u-radio-card', value === o.value && 'is-on', o.danger && 'is-danger'].filter(Boolean).join(' ')}
            onClick={() => onChange(o.value)}
          >
            <span className="u-radio" />
            {o.label}
          </button>
        ))}
      </div>
    </Shell>
  )
}

export const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export function DayToggles({ label, value = [], onChange, full = true, shape = 'circle' }) {
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])
  return (
    <Shell label={label} full={full}>
      <div className="u-days">
        {WEEKDAYS.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={value.includes(d)}
            className={['u-day', shape === 'box' && 'u-day--box', value.includes(d) && 'is-on'].filter(Boolean).join(' ')}
            onClick={() => toggle(d)}
          >
            {d}
          </button>
        ))}
      </div>
    </Shell>
  )
}

// tone: warn | danger (đổi màu khi tick)
export function CheckRow({ checked, onChange, disabled, tone, children }) {
  return (
    <label className={['u-check', tone && `u-check--${tone}`].filter(Boolean).join(' ')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      <span className="u-check__box"><Check size={12} strokeWidth={3} /></span>
      {children}
    </label>
  )
}

export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={checked ? 'u-switch is-on' : 'u-switch'} onClick={() => onChange(!checked)} />
  )
}
