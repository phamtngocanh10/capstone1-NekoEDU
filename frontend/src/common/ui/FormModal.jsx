import { Fragment, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import Dialog from './Dialog'
import Btn from './Btn'
import { CheckRow, DayToggles, PasswordField, RadioChips, SelectField, TextAreaField, TextField } from './Fields'
import { DropZone } from './Misc'

function isEmpty(value) {
  if (Array.isArray(value)) return value.length === 0
  return String(value ?? '').trim() === ''
}

/**
 * Modal form theo cấu hình. fields: [{ name, label, type, icon, placeholder, options, full, required, hint }]
 * type: text | date | number | password | select | radio | textarea | days | file | check
 */
export default function FormModal({
  title, subtitle, fields, initial = {}, submitLabel = 'Lưu', submitIcon: SubmitIcon,
  cancelVariant = 'muted', size, onSubmit, onClose,
}) {
  // fields có thể là mảng hoặc hàm (values) => mảng, dùng cho ô phụ thuộc nhau (vd. Khóa học → Lớp học).
  // field.resets: danh sách ô sẽ về giá trị đầu tiên khi ô này đổi.
  function getFields(currentValues) {
    return typeof fields === 'function' ? fields(currentValues) : fields
  }

  const [values, setValues] = useState(() => {
    const defaults = {}
    for (const field of getFields({})) {
      defaults[field.name] = field.type === 'days' ? [] : ''
    }
    return { ...defaults, ...initial }
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)
  const visibleFields = getFields(values)

  function updateField(name, value) {
    setValues((currentValues) => {
      const nextValues = { ...currentValues, [name]: value }
      const changedField = getFields(currentValues).find((field) => field.name === name)

      for (const dependentName of changedField?.resets ?? []) {
        const dependentField = getFields(nextValues).find((field) => field.name === dependentName)
        const firstOption = dependentField?.options?.[0]
        let defaultValue = ''
        if (typeof firstOption === 'string') defaultValue = firstOption
        else if (firstOption !== undefined) defaultValue = firstOption.value
        nextValues[dependentName] = defaultValue
      }
      return nextValues
    })
    setErrors((currentErrors) => ({ ...currentErrors, [name]: false }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (inFlight.current) return
    const requiredErrors = {}
    for (const field of visibleFields) {
      if (field.required && isEmpty(values[field.name])) requiredErrors[field.name] = true
    }
    setErrors(requiredErrors)
    if (Object.keys(requiredErrors).length !== 0) return
    inFlight.current = true
    setSubmitting(true)
    try { await onSubmit(values) }
    finally { inFlight.current = false; setSubmitting(false) }
  }

  const renderField = (field) => {
    const common = { label: field.label, required: field.required, full: field.full, hint: field.hint, error: errors[field.name] }
    const bind = { value: values[field.name], onChange: (e) => updateField(field.name, e.target.value) }
    switch (field.type) {
      case 'select':
        return <SelectField {...common} icon={field.icon} options={field.options} placeholder={field.placeholder} {...bind} />
      case 'radio':
        return <RadioChips key={field.name} label={field.label} options={field.options} cols={field.cols} full={field.full} value={values[field.name]} onChange={(value) => updateField(field.name, value)} />
      case 'textarea':
        return <TextAreaField {...common} full={field.full ?? true} placeholder={field.placeholder} {...bind} />
      case 'days':
        return <DayToggles key={field.name} label={field.label} full={field.full ?? true} value={values[field.name]} onChange={(value) => updateField(field.name, value)} />
      case 'file':
        return (
          <div key={field.name} className="u-field u-field--full">
            {field.label && <span className="u-field__label">{field.label}</span>}
            <DropZone light title={field.placeholder} hint={field.hint} onFiles={(files) => files[0] && updateField(field.name, files[0])} />
            {values[field.name] && <span className="u-field__hint">Đã chọn: {values[field.name]?.name ?? values[field.name]}</span>}
          </div>
        )
      case 'check':
        return <div key={field.name} className="u-field u-field--full"><CheckRow checked={Boolean(values[field.name])} onChange={(value) => updateField(field.name, value)}>{field.label}</CheckRow></div>
      case 'password':
        return <PasswordField {...common} icon={field.icon} placeholder={field.placeholder} autoComplete="new-password" {...bind} />
      case 'date':
        return <TextField {...common} icon={field.icon ?? Calendar} placeholder={field.placeholder ?? 'dd/mm/yyyy'} inputMode="numeric" {...bind} />
      default:
        return <TextField {...common} icon={field.icon} type={field.type === 'number' ? 'number' : 'text'} placeholder={field.placeholder} {...bind} />
    }
  }

  return (
    <Dialog title={title} subtitle={subtitle} size={size} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="u-form">{visibleFields.map((field) => <Fragment key={field.name}>{renderField(field)}</Fragment>)}</div>
        <div className="u-modal__foot">
          <Btn variant={cancelVariant} size="sq" onClick={onClose}>Hủy</Btn>
          <button type="submit" className="u-btn u-btn--primary u-btn--sq" disabled={submitting}>
            {SubmitIcon && <SubmitIcon size={15} />}
            {submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
