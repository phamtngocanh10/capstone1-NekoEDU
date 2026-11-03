import { Sparkles } from 'lucide-react'
import { Btn, Chip } from '../../../../common/ui'

export const Conf = ({ value }) => <Chip tone="sky">Độ tin cậy {value}%</Chip>

// Hàng đề xuất có nút hành động (điều hướng sang trang liên quan)
export function ActionRow({ title, why, conf, label, to }) {
  return (
    <div className="ts-ai">
      <span className="u-iconcircle"><Sparkles size={14} /></span>
      <div><strong>{title}</strong><small>{why}</small></div>
      <div className="u-row">
        <Conf value={conf} />
        <Btn variant="soft" size="md" to={to}>{label}</Btn>
      </div>
    </div>
  )
}
