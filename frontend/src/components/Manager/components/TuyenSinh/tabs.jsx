import { Sparkles } from 'lucide-react'
import { Avatar, Btn, Card, CardHead, Chip, DataTable, MiniStat, Progress } from '../../../../common/ui'
import { useManager } from '../../layout/ManagerContext'
import { Donut, HBars, LineChart, VBars } from './charts'
import { ActionRow, Conf } from './parts'
import * as D from './data'
import { useAdmissions as useAdmissionsData } from './data'
import { useNavigate } from 'react-router-dom'
import { reviewProposal } from '../../../../api/admissions'
import { operationError } from '../../../../api/finance'

function toneOfProb(probability) {
  if (probability >= 70) return D.G
  if (probability >= 45) return D.A
  return D.R
}

export function TabTongQuan({ onTab }) {
  const D = useAdmissionsData()
  const { notify } = useManager()
  const items = D.PROPOSALS
  const forecasts = D.FORECASTS.length ? D.FORECASTS : [
    { tab: 'khoa', caption: 'Khóa tiếp theo', accent: D.D },
    { tab: 'thang', caption: 'Tháng tiếp theo', accent: D.G },
    { tab: 'nam', caption: 'Năm tiếp theo', accent: D.A },
  ]
  async function updateProposal(id, state) {
    try { await reviewProposal(id, state); await D.refresh(); notify(state === 'accepted' ? 'Đã chấp nhận đề xuất của AI' : 'Đã bỏ qua đề xuất của AI') }
    catch (error) { notify(operationError(error)) }
  }

  function acceptProposal(id) {
    updateProposal(id, 'accepted')
  }
  return (
    <>
      <div className="u-grid u-grid--4">
        {D.OVERVIEW_KPIS.map((k) => <MiniStat key={k.label} label={k.label} value={k.value} delta={k.delta} accent={k.accent} lg />)}
      </div>
      <div className="ts-cards">
        {forecasts.map((f) => (
          <div key={f.tab} className="ts-fc" style={{ '--accent': f.accent }}>
            <small>{f.caption}</small>
            <h3>{f.value ?? '—'}</h3>
            <span className="up">{f.delta}</span>
            <p>AI đề xuất: {f.ai ?? 'Chưa có dữ liệu dự báo'}</p>
            <div className="u-row"><Conf value={f.conf} /><Btn variant="soft" size="md" onClick={() => onTab(f.tab)}>Xem chi tiết</Btn></div>
          </div>
        ))}
      </div>
      <div className="ts-two">
        <Card>
          <CardHead title="Tỉ lệ tái đăng ký theo khóa học">
            <span className="u-bad" style={{ fontSize: 10.8, fontWeight: 700 }}>Mục tiêu 70% (vạch đỏ)</span>
          </CardHead>
          <HBars items={D.REENROLL} target={70} />
        </Card>
        <Card>
          <CardHead title="Tỉ lệ nghỉ học 6 tháng gần đây" />
          <LineChart points={D.DROPOUT_TREND} min={6} max={10} unit="%" />
        </Card>
      </div>
      <Card>
        <CardHead title="Đề xuất của AI đang chờ bạn"><span className="u-faint" style={{ fontSize: 10.8 }}>Nguồn: {[...new Set(items.map((item) => item.source))].join(', ') || 'Chưa có dữ liệu đề xuất'}</span></CardHead>
        {items.length === 0 && <p className="u-faint">Không còn đề xuất nào đang chờ.</p>}
        {items.map((p) => (
          <div key={p.id} className="ts-ai">
            <span className="u-iconcircle"><Sparkles size={14} /></span>
            <div><strong>{p.title}</strong><small>{p.why}</small></div>
            <div className="u-row">
              <Conf value={p.conf} />
              {p.state === 'accepted' ? <Chip tone="green">Đã chấp nhận</Chip> : (
                <>
                  <Btn size="md" onClick={() => acceptProposal(p.id)}>Chấp nhận</Btn>
                  <Btn variant="ghost" size="md" onClick={() => updateProposal(p.id, 'skip')}>Bỏ qua</Btn>
                </>
              )}
            </div>
          </div>
        ))}
      </Card>
    </>
  )
}

export function TabKhoa() {
  const D = useAdmissionsData()
  const columns = [
    { key: 'name', label: 'Khóa học', width: '22%', render: (r) => <strong>{r.name}</strong> },
    { key: 'now', label: 'Hiện tại', width: '11%' }, { key: 'rate', label: 'Tái đăng ký', width: '16%' }, { key: 'fresh', label: 'HV mới', width: '10%' },
    { key: 'pred', label: 'Dự kiến', width: '11%', render: (r) => <strong style={{ color: 'var(--primary-2)' }}>{r.pred}</strong> },
    { key: 'classes', label: 'Lớp đề xuất', width: '15%' },
    { key: 'trust', label: 'Tin cậy', width: '15%', render: (r) => <Chip tone={r.trust === 'Cao' ? 'green' : 'amber'}>{r.trust}</Chip> },
  ]
  return (
    <>
      <div className="u-grid u-grid--4">
        <MiniStat label="Học viên dự kiến" value={D.COURSE_FORECAST.length ? D.COURSE_FORECAST.reduce((sum, row) => sum + row.pred, 0) : '—'} accent={D.G} lg />
        <MiniStat label="Tái đăng ký dự kiến" value="—" accent={D.D} lg />
        <MiniStat label="Học viên mới dự kiến" value="—" accent={D.A} lg />
        <MiniStat label="Lớp đề xuất" value="—" accent={D.B} lg />
      </div>
      <div className="ts-main">
        <Card>
          <CardHead title="Dự báo theo khóa học" />
          <DataTable columns={columns} rows={D.COURSE_FORECAST} rowKey="name" chevron={false} />
          <table className="u-table"><tbody><tr className="ts-total"><td style={{ width: '22%' }}>Tổng</td><td style={{ width: '11%' }}>—</td><td style={{ width: '16%' }}>—</td><td style={{ width: '10%' }}>—</td><td style={{ width: '11%' }}>{D.COURSE_FORECAST.length ? D.COURSE_FORECAST.reduce((sum, row) => sum + row.pred, 0) : '—'}</td><td style={{ width: '15%' }}>—</td><td style={{ width: '15%' }}><Chip tone="blue">—</Chip></td></tr></tbody></table>
        </Card>
        <Card>
          <CardHead title="Căn cứ của AI" />
          <ul className="ts-why">{D.BASIS.map((b) => <li key={b.t}><strong>{b.t}</strong><small>{b.d}</small></li>)}</ul>
        </Card>
      </div>
      <Card>
        <CardHead title="Hành động đề xuất cho khóa tiếp theo" />
        {D.NEXT_COURSE_ACTIONS.map((action) => <ActionRow key={action.title} {...action} />)}
      </Card>
    </>
  )
}

export function TabThang() {
  const D = useAdmissionsData()
  const columns = [
    { key: 'w', label: 'Tuần', width: '20%', render: (r) => <strong>{r.w}</strong> },
    { key: 'lead', label: 'Lead dự kiến', width: '14%' }, { key: 'enroll', label: 'Ghi danh dự kiến', width: '16%', render: (r) => <strong style={{ color: 'var(--primary-2)' }}>{r.enroll}</strong> },
    { key: 'act', label: 'Hành động đề xuất', width: '50%' },
  ]
  return (
    <>
      <div className="u-grid u-grid--4">
        <MiniStat label="Ghi danh dự kiến" value={D.MONTHS.length ? D.MONTHS.reduce((sum, row) => sum + row.value, 0) : '—'} accent={D.D} lg />
        <MiniStat label="Lead dự kiến" value="—" accent={D.G} lg />
        <MiniStat label="Ngân sách marketing đề xuất" value="—" accent={D.A} lg />
        <MiniStat label="Chi phí / lead dự kiến" value="—" accent={D.B} lg />
      </div>
      <div className="ts-main" style={{ gridTemplateColumns: 'minmax(0,1fr) 400px' }}>
        <Card>
          <CardHead title="Học viên mới theo tháng">
            <span className="u-link">Cột nhạt: AI dự báo</span>
          </CardHead>
          <VBars items={D.MONTHS.map((month, index) => ({ ...month, color: index === 5 ? '#9fd0ee' : D.B }))} max={44} />
        </Card>
        <Card>
          <CardHead title="Dự báo theo khóa" />
          <HBars items={D.BY_COURSE_T10} max={30} unit=" HV" />
          <p className="u-link" style={{ marginTop: 18 }}>{D.MONTHS.length ? `${D.MONTHS.reduce((sum, row) => sum + row.value, 0)} học viên` : 'Chưa có dữ liệu dự báo'}</p>
        </Card>
      </div>
      <Card>
        <CardHead title="Dự báo theo tuần và hành động đề xuất" />
        <DataTable columns={columns} rows={D.WEEKS} rowKey="w" chevron={false} />
        <table className="u-table"><tbody><tr className="ts-total"><td style={{ width: '20%' }}>Tổng</td><td style={{ width: '14%' }}>—</td><td style={{ width: '16%' }}>—</td><td /></tr></tbody></table>
      </Card>
    </>
  )
}

export function TabNam() {
  const D = useAdmissionsData()
  const columns = [
    { key: 'q', label: 'Quý', width: '25%', render: (r) => <strong style={{ color: 'var(--primary-2)' }}>{r.q}</strong> },
    { key: 'hv', label: 'HV mới', width: '25%', render: (r) => <strong style={{ color: 'var(--primary-2)' }}>{r.hv}</strong> }, { key: 'cls', label: 'Lớp', width: '25%' }, { key: 'gv', label: 'GV', width: '25%' },
  ]
  return (
    <>
      <div className="u-grid u-grid--4">
        <MiniStat label="Học viên mới dự kiến" value={D.YEAR.length ? D.YEAR.reduce((sum, row) => sum + row.value, 0) : '—'} accent={D.B} lg />
        <MiniStat label="Tăng trưởng dự kiến" value="—" accent={D.G} lg />
        <MiniStat label="Doanh thu dự kiến" value="—" accent={D.A} lg />
        <MiniStat label="Lớp cần mở thêm" value="—" accent={D.D} lg />
      </div>
      <div className="ts-main" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
        <Card><CardHead title="Học viên mới theo tháng (AI dự báo)"><span className="u-warn" style={{ fontSize: 10.8, fontWeight: 700 }}>Cam: mùa cao điểm</span></CardHead><VBars items={D.YEAR} max={70} /></Card>
        <Card><CardHead title="Kế hoạch theo quý" /><DataTable columns={columns} rows={D.QUARTERS} rowKey="q" chevron={false} /></Card>
      </div>
      <Card>
        <CardHead title="Đề xuất chiến lược năm tiếp theo" />
        {D.STRATEGY.map((action) => <ActionRow key={action.title} {...action} />)}
      </Card>
    </>
  )
}

export function TabTaiDangKy() {
  const D = useAdmissionsData()
  const navigate = useNavigate()
  const { notify } = useManager()
  const columns = [
    { key: 'name', label: 'Học viên', width: '20%', render: (r) => <strong>{r.name}</strong> }, { key: 'cls', label: 'Lớp', width: '19%' }, { key: 'gpa', label: 'Điểm TB', width: '9%' }, { key: 'rate', label: 'Chuyên cần', width: '11%' },
    { key: 'prob', label: 'Khả năng đăng ký', width: '17%', render: (r) => <div className="ts-prob"><Progress value={r.prob} color={toneOfProb(r.prob)} label="Khả năng đăng ký" /><b style={{ color: toneOfProb(r.prob) }}>{r.prob}%</b></div> },
    { key: 'tip', label: 'Gợi ý', width: '17%', className: 'u-tight' },
    { key: 'act', label: '', width: '7%', render: (r) => <Btn variant="ghost" size="sm" onClick={() => navigate('/thongbao/soan', { state: { studentCode: r.id } })}>Nhắn tin</Btn> },
  ]
  return (
    <>
      <div className="u-grid u-grid--4">
        <MiniStat label="Tái đăng ký toàn trung tâm" value={D.summary.retentionRate == null ? '—' : `${D.summary.retentionRate}%`} accent={D.G} lg />
        <MiniStat label="Hoàn thành khóa" value={D.summary.completed ?? '—'} accent={D.D} lg />
        <MiniStat label="Đã đăng ký khóa tiếp" value={D.summary.reenrolled ?? '—'} accent={D.B} lg />
        <MiniStat label="Chưa đăng ký" value={D.summary.unregistered ?? '—'} accent={D.A} lg />
      </div>
      <div className="ts-two">
        <Card><CardHead title="Tái đăng ký theo khóa học"><span className="u-bad" style={{ fontSize: 10.8, fontWeight: 700 }}>Mục tiêu 70% (vạch đỏ)</span></CardHead><HBars items={D.REENROLL} target={70} /></Card>
        <Card>
          <CardHead title={`Học viên hoàn thành khóa (${D.summary.completed ?? 0})`} />
          <div className="ts-reasons">
            <Donut size={150} segments={[{ value: D.summary.reenrolled ?? 0, color: D.G }, { value: D.summary.unregistered ?? 0, color: D.A }]} center={<span>{D.summary.retentionRate == null ? '—' : `${D.summary.retentionRate}%`}</span>} />
            <div className="ts-legend">
              <div><i className="u-dot u-dot--green" />Đã đăng ký khóa tiếp<b>{D.summary.reenrolled ?? '—'}</b></div>
              <div><i className="u-dot u-dot--amber" />Chưa đăng ký<b>{D.summary.unregistered ?? '—'}</b></div>
              <div><i className="u-dot u-dot--red" />Nghỉ hẳn<b>{D.summary.dropoutCount ?? '—'}</b></div>
            </div>
          </div>
        </Card>
      </div>
      <Card><CardHead title="Học viên sắp hoàn thành khóa, chưa đăng ký khóa tiếp (AI xếp theo khả năng đăng ký)" /><DataTable columns={columns} rows={D.AT_RISK_ENROLL} chevron={false} /></Card>
    </>
  )
}

export function TabNghiHoc() {
  const D = useAdmissionsData()
  const { notify } = useManager()
  return (
    <>
      <div className="u-grid u-grid--4">
        <MiniStat label="Tỉ lệ nghỉ học" value={D.summary.dropoutRate == null ? '—' : `${D.summary.dropoutRate}%`} accent={D.R} lg />
        <MiniStat label="Học viên nghỉ học" value={D.summary.dropoutCount ?? '—'} accent={D.D} lg />
        <MiniStat label="Có nguy cơ nghỉ" value={D.summary.dropoutRisk ?? '—'} accent={D.A} lg />
        <MiniStat label="Đã xử lý cảnh báo" value={D.summary.resolved ?? '—'} accent={D.G} lg />
      </div>
      <div className="ts-two">
        <Card><CardHead title="Tỉ lệ nghỉ học 6 tháng gần đây" /><LineChart points={D.DROPOUT_TREND} min={6} max={10} unit="%" /></Card>
        <Card>
          <CardHead title="Lý do nghỉ học" />
          <div className="ts-reasons">
            <Donut size={150} segments={D.REASONS} center={<span>{D.summary.dropoutCount ?? '—'}<small>HV</small></span>} />
            <div className="ts-legend">{D.REASONS.map((r) => <div key={r.label}><i className="u-dot" style={{ background: r.color }} />{r.label}<b>{r.value}%</b></div>)}</div>
          </div>
        </Card>
      </div>
      <div className="ts-two">
        <Card><CardHead title="Tỉ lệ nghỉ học theo khóa" /><HBars items={D.DROPOUT_BY_COURSE} max={12} unit="%" /></Card>
        <Card>
          <CardHead title="Học viên có nguy cơ nghỉ (AI dự đoán)" />
          <ul className="u-list">
            {D.DROPOUT_RISK.map((r) => (
              <li key={r.id}>
                <Avatar name={r.name} size={30} tone="soft" />
                <div className="u-grow"><strong>{r.name}</strong><small>{r.why}</small></div>
                <Chip tone={r.level === 'Cao' ? 'red' : 'amber'}>{r.level}</Chip>
                <Btn variant="ghost" size="sm" onClick={() => reviewProposal(r.id, 'accepted', 'Đã ghi nhận cần liên hệ').then(() => D.refresh()).then(() => notify(`Đã ghi nhận cần liên hệ ${r.name}`)).catch((error) => notify(operationError(error)))}>Liên hệ</Btn>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
