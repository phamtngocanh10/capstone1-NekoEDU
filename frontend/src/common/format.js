// Định dạng tiền VND kiểu Việt Nam: 2400000 -> "2.400.000đ"
export const vnd = (n) => `${Number(n).toLocaleString('vi-VN')}đ`

// "dd/mm/yyyy" của hôm nay (dùng làm giá trị mặc định cho form)
export const todayText = () =>
  new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Bỏ dấu + chuẩn hoá để tìm kiếm tiếng Việt không phân biệt dấu/hoa thường
export const norm = (s = '') =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// Tải một file văn bản về máy (dùng cho xuất danh sách khi chưa có backend)
export function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: mime }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
