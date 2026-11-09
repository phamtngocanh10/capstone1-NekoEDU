import { useNavigate, useParams } from 'react-router-dom'
import { Pills } from '../../../../common/ui'
import { usePageHeader } from '../../layout/ManagerContext'
import TaiKhoan from './TaiKhoan'
import MaTranQuyen from './MaTranQuyen'

const TABS = [{ value: '', label: 'Tài khoản' }, { value: 'vai-tro', label: 'Phân quyền theo vai trò' }]
const SUBTITLE = 'Ma trận quyền theo vai trò và quản lý tài khoản hệ thống'

// Figma 18.0–18.7 — Phân quyền & Cài đặt (đường dẫn /phanquyen/:tab)
export default function PhanQuyen() {
  const { tab = '' } = useParams()
  const navigate = useNavigate()
  const matrix = tab === 'vai-tro'
  usePageHeader(matrix ? 'Phân quyền theo vai trò' : 'Phân quyền & Cài đặt', SUBTITLE)
  return (
    <div className="u-page">
      <Pills items={TABS} value={matrix ? 'vai-tro' : ''} onChange={(v) => navigate(v ? `/phanquyen/${v}` : '/phanquyen')} large />
      {matrix ? <MaTranQuyen /> : <TaiKhoan />}
    </div>
  )
}
