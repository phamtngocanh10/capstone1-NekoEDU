export const STATUS = {
  overdue: { label: 'Quá hạn', tone: 'red' },
  soon: { label: 'Sắp đến hạn', tone: 'amber' },
  paid: { label: 'Đã thanh toán', tone: 'green' },
}
export const FILTERS = [
  { value: 'all', label: 'Tất cả' }, { value: 'overdue', label: 'Quá hạn' }, { value: 'soon', label: 'Sắp đến hạn' }, { value: 'paid', label: 'Đã thanh toán' },
]
