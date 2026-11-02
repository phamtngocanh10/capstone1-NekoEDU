import { useNavigate, useParams } from 'react-router-dom'
import { Avatar, BackLink, Btn, Card, Chip, DataTable, Pager } from '../../../../common/ui'
import { downloadText } from '../../../../common/format'
import { usePageHeader, useManager } from '../../layout/ManagerContext'
import { findClass } from '../KhoaHoc/data'
import { SCORE_ROWS, avg, grade } from './data'

// Figma 13.3 — Bảng điểm lớp
export default function BangDiemLop() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const { notify } = useManager()
  usePageHeader('Bảng điểm lớp', 'Điểm từng học viên của lớp')
  const cls = findClass(classId)
  const rows = SCORE_ROWS.map((r) => ({ ...r, tb: avg(r.s) }))
  const classAvg = avg(rows.map((r) => r.tb))

  const exportXlsx = () => {
    downloadText(`Bang-diem-${cls.id}.csv`, ['Mã HV,Họ tên,Nghe,Nói,Đọc,Viết,Trung bình', ...rows.map((r) => [r.id, r.name, ...r.s, r.tb].join(','))].join('\n'))
    notify('Đã xuất bảng điểm (CSV — bản .xlsx do backend tạo)')
  }

  const columns = [
    { key: 'name', label: 'Học viên', width: '28%', render: (r) => <div className="u-person"><Avatar name={r.name} initial="first" tone="soft" /><div><strong>{r.name}</strong><small>{r.id}</small></div></div> },
    ...['Nghe', 'Nói', 'Đọc', 'Viết'].map((label, i) => ({ key: label, label, width: '11%', render: (r) => r.s[i].toFixed(1) })),
    { key: 'tb', label: 'Trung bình', width: '12%', render: (r) => <strong style={{ color: 'var(--primary-2)', fontSize: 13.5 }}>{r.tb.toFixed(1)}</strong> },
    { key: 'grade', label: 'Xếp loại', width: '12%', render: (r) => { const [label, tone] = grade(r.tb); return <Chip tone={tone}>{label}</Chip> } },
  ]

  return (
    <div className="u-page">
      <BackLink to="/diemdanh">Điểm số</BackLink>
      <Card className="ds-head">
        <div className="u-grow">
          <h2>{cls.name} · Bảng điểm giữa kỳ</h2>
          <Chip tone="green">Đã công bố</Chip>
          <p>GV {cls.teacher} · 12 học viên · Xác nhận 11/09/2026, 16:00 · Công bố 13/09/2026, 08:00</p>
          <p className="ds-em ds-em--blue">Điểm trung bình lớp {classAvg.toFixed(1)} / 10 · Thời gian nhập điểm đã đóng (12/09/2026 23:59)</p>
        </div>
        <Btn variant="soft" onClick={() => navigate(`/diemdanh/nhap-diem?lop=${encodeURIComponent(cls.name)}`)}>Nhập hộ điểm</Btn>
        <Btn variant="ghost" onClick={() => notify('Đã mở lại nhập điểm cho giảng viên')}>Mở lại cho giảng viên</Btn>
        <Btn variant="ghost" onClick={exportXlsx}>Xuất Excel</Btn>
      </Card>
      <Card>
        <DataTable columns={columns} rows={rows} chevron={false} />
        <Pager text="Hiển thị 8 / 12 học viên · Điểm do giảng viên nhập và xác nhận; Manager chỉ đặt thời gian, nhập hộ khi cần" pages={2} />
      </Card>
    </div>
  )
}
