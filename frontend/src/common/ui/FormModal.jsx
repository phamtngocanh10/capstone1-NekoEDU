import { Fragment, useState } from 'react'
import { Calendar } from 'lucide-react'
import Dialog from './Dialog'
import Btn from './Btn'
import { CheckRow, DayToggles, PasswordField, RadioChips, SelectField, TextAreaField, TextField } from './Fields'
import { DropZone } from './Misc'

const isEmpty = (v) => (Array.isArray(v) ? v.length === 0 : String(v ?? '').trim() === '')

/**
 * Modal form theo cấu hình. fields: [{ name, label, type, icon, placeholder, options, full, required, hint }]
 * type: text | date | number | password | select | radio | textarea | days | file | check
 */
export default function FormModal({
  title, subtitle, fields, initial = {}, submitLabel = 'Lưu', submitIcon: SubmitIcon,
  cancelVariant = 'muted', size, onSubmit, onClose,
}) {
  // fields có thể là mảng hoặc hàm (values) => mảng, dùng cho ô phụ thuộc nhau (vd. Khóa học → Lớp học).
  // f.resets: danh sách ô sẽ về giá trị đầu tiên khi ô này đổi.
  const build = (v) => (typeof fields === 'function' ? fields(v) : fields)
  const [values, setValues] = useState(() => ({
    ...Object.fromEntries(build({}).map((f) => [f.name, f.type === 'days' ? [] : ''])),
    ...initial,
  }))
  const [errors, setErrors] = useState({})
  const list = build(values)
  const set = (name, v) => {
    setValues((s) => {
      const next = { ...s, [name]: v }
      for (const r of build(s).find((f) => f.name === name)?.resets ?? []) {
        const first = build(next).find((f) => f.name === r)?.options?.[0]
        next[r] = first === undefined ? '' : typeof first === 'string' ? first : first.value
      }
      return next
    })
    setErrors((e) => ({ ...e, [name]: false }))
  }

  const submit = (e) => {
    e.preventDefault()
    const bad = Object.fromEntries(list.filter((f) => f.required && isEmpty(values[f.name])).map((f) => [f.name, true]))
    setErrors(bad)
    if (Object.keys(bad).length === 0) onSubmit(values)
  }

  const renderField = (f) => {
    const common = { label: f.label, required: f.required, full: f.full, hint: f.hint, error: errors[f.name] }
    const bind = { value: values[f.name], onChange: (e) => set(f.name, e.target.value) }
    switch (f.type) {
      case 'select':
        return <SelectField {...common} icon={f.icon} options={f.options} placeholder={f.placeholder} {...bind} />
      case 'radio':
        return <RadioChips key={f.name} label={f.label} options={f.options} cols={f.cols} full={f.full} value={values[f.name]} onChange={(v) => set(f.name, v)} />
      case 'textarea':
        return <TextAreaField {...common} full={f.full ?? true} placeholder={f.placeholder} {...bind} />
      case 'days':
        return <DayToggles key={f.name} label={f.label} full={f.full ?? true} value={values[f.name]} onChange={(v) => set(f.name, v)} />
      case 'file':
        return (
          <div key={f.name} className="u-field u-field--full">
            {f.label && <span className="u-field__label">{f.label}</span>}
            <DropZone light title={f.placeholder} hint={f.hint} onFiles={(files) => set(f.name, files[0].name)} />
            {values[f.name] && <span className="u-field__hint">Đã chọn: {values[f.name]}</span>}
          </div>
        )
      case 'check':
        return <div key={f.name} className="u-field u-field--full"><CheckRow checked={Boolean(values[f.name])} onChange={(v) => set(f.name, v)}>{f.label}</CheckRow></div>
      case 'password':
        return <PasswordField {...common} icon={f.icon} placeholder={f.placeholder} autoComplete="new-password" {...bind} />
      case 'date':
        return <TextField {...common} icon={f.icon ?? Calendar} placeholder={f.placeholder ?? 'dd/mm/yyyy'} inputMode="numeric" {...bind} />
      default:
        return <TextField {...common} icon={f.icon} type={f.type === 'number' ? 'number' : 'text'} placeholder={f.placeholder} {...bind} />
    }
  }

  return (
    <Dialog title={title} subtitle={subtitle} size={size} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="u-form">{list.map((f) => <Fragment key={f.name}>{renderField(f)}</Fragment>)}</div>
        <div className="u-modal__foot">
          <Btn variant={cancelVariant} size="sq" onClick={onClose}>Hủy</Btn>
          <button type="submit" className="u-btn u-btn--primary u-btn--sq">
            {SubmitIcon && <SubmitIcon size={15} />}
            {submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
