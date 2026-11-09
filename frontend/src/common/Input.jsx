export default function Input({ label, icon: Icon, ...props }) {
  return (
    <label className="field">
      {label && <span className="field__label">{label}</span>}
      <span className="field__box">
        {Icon && <Icon size={16} />}
        <input {...props} />
      </span>
    </label>
  )
}
