import { useEffect, useState } from 'react'
import { getAdmissionForecast } from '../../../../api/admissions'
import { operationError } from '../../../../api/finance'
import { useManager } from '../../layout/ManagerContext'

export const TABS = [
  { value: '', label: 'Tổng quan', title: 'Tuyển sinh' },
  { value: 'khoa', label: 'Khóa tiếp theo', title: 'Dự báo khóa tiếp theo' },
  { value: 'thang', label: 'Tháng tiếp theo', title: 'Dự báo tháng tiếp theo' },
  { value: 'nam', label: 'Năm tiếp theo', title: 'Dự báo năm tiếp theo' },
  { value: 'tai-dang-ky', label: 'Tái đăng ký', title: 'Tỉ lệ tái đăng ký' },
  { value: 'nghi-hoc', label: 'Nghỉ học', title: 'Tỉ lệ nghỉ học' },
]
export const SUBTITLE = 'Dự báo đã lưu và dữ liệu hoạt động của trung tâm'

export const G = 'var(--success-fill)', A = 'var(--warning-fill)', R = 'var(--danger)', B = 'var(--primary)', D = '#1a6fc9'

const EMPTY = {
  REENROLL: [], DROPOUT_TREND: [], OVERVIEW_KPIS: [
    { label: 'Tỉ lệ tái đăng ký', value: '—', accent: G },
    { label: 'Tỉ lệ nghỉ học', value: '—', accent: R },
    { label: 'Tỉ lệ chuyển đổi', value: '—', accent: D },
    { label: 'Tỉ lệ lấp đầy lớp', value: '—', accent: A },
  ],
  FORECASTS: [], PROPOSALS: [], COURSE_FORECAST: [], BASIS: [], NEXT_COURSE_ACTIONS: [],
  MONTHS: [], BY_COURSE_T10: [], WEEKS: [], YEAR: [], QUARTERS: [], STRATEGY: [],
  AT_RISK_ENROLL: [], REASONS: [], DROPOUT_BY_COURSE: [], DROPOUT_RISK: [], summary: {},
}
export function useAdmissions() {
  const { notify } = useManager()
  const [data, setData] = useState(EMPTY)
  async function refresh() {
    const result = await getAdmissionForecast('overview')
    setData({ ...EMPTY, ...result })
  }
  useEffect(() => { refresh().catch((error) => notify(operationError(error))) }, [])
  return { ...data, G, A, R, B, D, refresh }
}
