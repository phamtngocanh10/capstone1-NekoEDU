// Biểu đồ SVG/CSS nhẹ, không cần thư viện ngoài (dữ liệu mẫu → thay bằng dữ liệu API).

// Thanh ngang. target: vạch mục tiêu (cùng đơn vị với value)
export function HBars({ items, max = 100, target, unit = '%' }) {
  return (
    <div className="ts-hbars">
      {target != null && <i className="ts-target" style={{ left: `calc(124px + (100% - 192px) * ${target / max})` }} />}
      {items.map((item) => (
        <div key={item.label} className="ts-hbar">
          <span>{item.label}</span>
          <div className="u-progress u-progress--lg" style={{ '--bar': item.color }}>
            <span style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <b>{item.value}{unit}</b>
        </div>
      ))}
    </div>
  )
}

// Cột đứng. height: tổng chiều cao biểu đồ (px)
export function VBars({ items, max, height = 190 }) {
  return (
    <div className="ts-vbars" style={{ height }}>
      {items.map((item) => (
        <div key={item.label} className="ts-vbar">
          <b>{item.value}</b>
          <i style={{ height: Math.round((item.value / max) * (height - 56)), background: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// Đường xu hướng. points: [{ label, value }]
export function LineChart({ points, min, max, color = 'var(--danger)', unit = '' }) {
  const width = 560
  const height = 200
  const padding = { left: 24, right: 24, top: 30, bottom: 30 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const getX = (index) => padding.left + (index * chartWidth) / (points.length - 1)
  const getY = (value) => padding.top + (1 - (value - min) / (max - min)) * chartHeight
  const linePoints = points.map((point, index) => `${getX(index)},${getY(point.value)}`).join(' ')

  return (
    <svg className="ts-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ đường xu hướng">
      {[0, 0.5, 1].map((position) => (
        <line
          key={position}
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + position * chartHeight}
          y2={padding.top + position * chartHeight}
          stroke="var(--divider)"
        />
      ))}
      <polyline fill="none" stroke={color} strokeWidth="2" points={linePoints} />
      {points.map((point, index) => (
        <g key={point.label}>
          <circle cx={getX(index)} cy={getY(point.value)} r="4" fill="#fff" stroke={color} strokeWidth="2" />
          <text x={getX(index)} y={getY(point.value) - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">{point.value}{unit}</text>
          <text x={getX(index)} y={height - 8} textAnchor="middle" fontSize="10.5" fill="var(--text-faint)">{point.label}</text>
        </g>
      ))}
    </svg>
  )
}

// Biểu đồ vành khuyên. segments: [{ value, color }]
export function Donut({ segments, size = 150, thickness = 20, center }) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  let offset = 0
  return (
    <div className="ts-donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Biểu đồ vành khuyên">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--divider)" strokeWidth={thickness} />
        {segments.map((segment) => {
          const length = (segment.value / total) * circumference
          const startOffset = offset
          offset += length
          return (
            <circle
              key={segment.color}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-startOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )
        })}
      </svg>
      <div className="ts-donut__c">{center}</div>
    </div>
  )
}
