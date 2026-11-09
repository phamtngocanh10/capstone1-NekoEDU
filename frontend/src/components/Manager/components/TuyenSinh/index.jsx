import { useNavigate, useParams } from 'react-router-dom'
import { Pills } from '../../../../common/ui'
import { usePageHeader } from '../../layout/ManagerContext'
import { SUBTITLE, TABS } from './data'
import { TabKhoa, TabNam, TabNghiHoc, TabTaiDangKy, TabThang, TabTongQuan } from './tabs'

// Figma 17.0–17.5 — Tuyển sinh: một trang, 6 tab (đường dẫn /tuyensinh/:tab)
export default function TuyenSinh() {
  const { tab = '' } = useParams()
  const navigate = useNavigate()
  const current = TABS.find((t) => t.value === tab) ?? TABS[0]
  usePageHeader(current.title, SUBTITLE)
  const go = (value) => navigate(value ? `/tuyensinh/${value}` : '/tuyensinh')

  return (
    <div className="u-page">
      <Pills items={TABS} value={current.value} onChange={go} large />
      {current.value === '' && <TabTongQuan onTab={go} />}
      {current.value === 'khoa' && <TabKhoa />}
      {current.value === 'thang' && <TabThang />}
      {current.value === 'nam' && <TabNam />}
      {current.value === 'tai-dang-ky' && <TabTaiDangKy />}
      {current.value === 'nghi-hoc' && <TabNghiHoc />}
    </div>
  )
}
