import { ChevronRight } from 'lucide-react'

// columns: [{ key, label, width, align, render(row), className }]
// onRowClick: bấm cả dòng (kèm mũi tên khi chevron = true).
// maxHeight: giới hạn chiều cao (px) — quá thì cuộn trong bảng, tiêu đề cột đứng yên.
export default function DataTable({ columns, rows, rowKey = 'id', onRowClick, chevron = Boolean(onRowClick), empty = 'Không có dữ liệu phù hợp', rowClass, maxHeight }) {
  const columnCount = columns.length + (chevron ? 1 : 0)
  return (
    <div className={maxHeight ? 'u-table-wrap is-scroll' : 'u-table-wrap'} style={maxHeight ? { maxHeight } : undefined}>
      <table className="u-table">
        <colgroup>
          {columns.map((column) => <col key={column.key} style={column.width ? { width: column.width } : undefined} />)}
          {chevron && <col style={{ width: 36 }} />}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key} style={{ textAlign: column.align }}>{column.label}</th>)}
            {chevron && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columnCount} className="u-table__empty">{empty}</td></tr>
          )}
          {rows.map((row) => (
            <tr
              key={row[rowKey]}
              className={[onRowClick && 'is-click', rowClass?.(row)].filter(Boolean).join(' ') || undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} className={column.className} style={{ textAlign: column.align }}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
              {chevron && <td className="u-table__chev"><ChevronRight size={16} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
