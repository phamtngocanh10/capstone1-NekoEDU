// Export the SQL-fetched rows in the format selected in the existing dialog.
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
const download = (name, bytes, type) => {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Browser canvas embeds Vietnamese text using the same installed fonts as the UI.
// Each PDF page contains an actual JPEG image; no renamed CSV or external service.
async function pdfBytes(headers, rows, title) {
  const pages = []
  const perPage = 32
  for (let start = 0; start < Math.max(rows.length, 1); start += perPage) {
    const canvas = document.createElement('canvas')
    canvas.width = 1684
    canvas.height = 1190
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#17243c'
    context.font = 'bold 28px Arial'
    context.fillText(title || 'Danh sách học viên', 45, 55)
    const width = (canvas.width - 90) / Math.max(headers.length, 1)
    context.font = 'bold 17px Arial'
    headers.forEach((value, column) => context.fillText(String(value), 45 + column * width, 100, width - 12))
    context.font = '16px Arial'
    rows.slice(start, start + perPage).forEach((row, index) => {
      const y = 135 + index * 30
      context.fillStyle = index % 2 ? '#f4f6fa' : '#fff'
      context.fillRect(40, y - 22, canvas.width - 80, 30)
      context.fillStyle = '#17243c'
      row.forEach((value, column) => context.fillText(String(value ?? ''), 45 + column * width, y, width - 12))
    })
    pages.push(Uint8Array.from(atob(canvas.toDataURL('image/jpeg', 0.94).split(',')[1]), (character) => character.charCodeAt(0)))
  }
  const encoder = new TextEncoder()
  const chunks = []
  const offsets = [0]
  let length = 0
  const append = (value) => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value
    chunks.push(bytes)
    length += bytes.length
  }
  const object = (id, content) => { offsets[id] = length; append(`${id} 0 obj\n`); append(content); append('\nendobj\n') }
  append('%PDF-1.4\n')
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ')}] >>`)
  pages.forEach((jpeg, index) => {
    const pageId = 3 + index * 3
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Img ${pageId + 1} 0 R >> >> /Contents ${pageId + 2} 0 R >>`)
    offsets[pageId + 1] = length
    append(`${pageId + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width 1684 /Height 1190 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)
    append(jpeg)
    append('\nendstream\nendobj\n')
    const commands = 'q 842 0 0 595 0 0 cm /Img Do Q'
    object(pageId + 2, `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`)
  })
  const xref = length
  append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`)
  offsets.slice(1).forEach((offset) => append(`${String(offset).padStart(10, '0')} 00000 n \n`))
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)
  const bytes = new Uint8Array(length)
  let cursor = 0
  chunks.forEach((chunk) => { bytes.set(chunk, cursor); cursor += chunk.length })
  return bytes
}

export async function exportStudentFile({ name, format, headers, rows, withLogo }) {
  const title = withLogo ? 'NEKO EDU · Danh sách học viên' : ''
  if (format === 'xlsx') {
    const module = await import('exceljs')
    const workbook = new module.default.Workbook()
    const sheet = workbook.addWorksheet('Học viên')
    if (title) { sheet.addRow([title]); sheet.mergeCells(1, 1, 1, headers.length) }
    sheet.addRow(headers)
    rows.forEach((row) => sheet.addRow(row))
    sheet.columns.forEach((column) => { column.width = 24 })
    const header = sheet.getRow(title ? 2 : 1)
    header.font = { bold: true }
    download(name, await workbook.xlsx.writeBuffer(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  } else if (format === 'pdf') {
    download(name, await pdfBytes(headers, rows, title), 'application/pdf')
  } else {
    download(name, '\ufeff' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
  }
}

export const studentImportHeaders = ['fullName', 'birth', 'gender', 'address', 'parentPhone', 'parentName', 'parentRelationship', 'email', 'course', 'className', 'fee', 'password', 'note']
