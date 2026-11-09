// Chân bảng: "Hiển thị x / y ..." bên trái, số trang bên phải.
export default function Pager({ text, pages = 0, page = 1, onPage }) {
  return (
    <div className="u-foot">
      <span>{text}</span>
      {pages > 1 && (
        <div className="u-pager">
          <button type="button" onClick={() => onPage?.(Math.max(1, page - 1))} aria-label="Trang trước">‹</button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={n === page ? 'is-active' : ''} onClick={() => onPage?.(n)}>{n}</button>
          ))}
        </div>
      )}
    </div>
  )
}
