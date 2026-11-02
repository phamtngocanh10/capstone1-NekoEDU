// Biểu đồ SVG/CSS nhẹ, không cần thư viện ngoài (dữ liệu mẫu → thay bằng dữ liệu API).

// Thanh ngang. target: vạch mục tiêu (cùng đơn vị với value)
export function HBars({ items, max = 100, target, unit = '%' }) {
  return (
    <div className="ts-hbars">
      {target != null && <i className="ts-target" style={{ left: `calc(124px + (100% - 192px) * ${target / max})` }} />}
      {items.map((it) => (
        <div key={it.label} className="ts-hbar">
          <span>{it.label}</span>
          <div className="u-progress u-progress--lg" style={{ '--bar': it.color }}><span style={{ width: `${(it.value / max) * 100}%` }} /></div>
          <b>{it.value}{unit}</b>
        </div>
      ))}
    </div>
  )
}

// Cột đứng. height: tổng chiều cao biểu đồ (px)
export function VBars({ items, max, height = 190 }) {
  return (
    <div className="ts-vbars" style={{ height }}>
      {items.map((it) => (
        <div key={it.label} className="ts-vbar">
          <b>{it.value}</b>
          <i style={{ height: Math.round((it.value / max) * (height - 56)), background: it.color }} />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  )
}

// Đường xu hướng. points: [{ label, value }]
export function LineChart({ points, min, max, color = 'var(--danger)', unit = '' }) {
  const W = 560, H = 200, p = { l: 24, r: 24, t: 30, b: 30 }
  const x = (i) => p.l + (i * (W - p.l - p.r)) / (points.length - 1)
  const y = (v) => p.t + (1 - (v - min) / (max - min)) * (H - p.t - p.b)
  return (
    <svg className="ts-line" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ đường xu hướng">
      {[0, 0.5, 1].map((g) => <line key={g} x1={p.l} x2={W - p.r} y1={p.t + g * (H - p.t - p.b)} y2={p.t + g * (H - p.t - p.b)} stroke="var(--divider)" />)}
      <polyline fill="none" stroke={color} strokeWidth="2" points={points.map((pt, i) => `${x(i)},${y(pt.value)}`).join(' ')} />
      {points.map((pt, i) => (
        <g key={pt.label}>
          <circle cx={x(i)} cy={y(pt.value)} r="4" fill="#fff" stroke={color} strokeWidth="2" />
          <text x={x(i)} y={y(pt.value) - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">{pt.value}{unit}</text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--text-faint)">{pt.label}</text>
        </g>
      ))}
    </svg>
  )
}

// Biểu đồ vành khuyên. segments: [{ value, color }]
export function Donut({ segments, size = 150, thickness = 20, center }) {
  const r = (size - thickness) / 2
  const C = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0)
  let offset = 0
  return (
    <div className="ts-donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Biểu đồ vành khuyên">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--divider)" strokeWidth={thickness} />
        {segments.map((s) => {
          const len = (s.value / total) * C
          const el = <circle key={s.color} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          offset += len
          return el
        })}
      </svg>
      <div className="ts-donut__c">{center}</div>
    </div>
  )
}
