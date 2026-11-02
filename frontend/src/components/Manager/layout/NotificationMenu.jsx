import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CreditCard, GraduationCap } from 'lucide-react'
import useClickOutside from '../../../common/useClickOutside'

const ICONS = { fee: [CreditCard, 'fee'], score: [GraduationCap, 'score'], info: [Bell, 'info'] }

// Dữ liệu mẫu — thay bằng getNotifications() (src/api/dashboard.js) khi có backend.
// Huy hiệu đếm tất cả thông báo chưa đọc (5); popover chỉ hiện 3 thông báo mới nhất như Figma.
const INITIAL = [
  { id: 1, type: 'fee', title: 'Nhắc nhở: học phí tháng 9 sắp đến hạn (20/09)', time: '1 giờ trước', unread: true },
  { id: 2, type: 'score', title: 'Bảng điểm giữa kỳ của Minh Anh đã được cập nhật', time: '3 giờ trước', unread: true },
  { id: 3, type: 'info', title: 'Trung tâm nghỉ lễ Quốc khánh 2/9, học bù ngày 6/9', time: '1 tuần trước', unread: false },
  { id: 4, type: 'info', title: 'Đơn xin nghỉ học mới của Nguyễn Minh Khang', time: '1 tuần trước', unread: true },
  { id: 5, type: 'info', title: 'Có 4 lead tuyển sinh mới từ website', time: '2 tuần trước', unread: true },
  { id: 6, type: 'info', title: 'Lịch dạy tuần sau đã được cập nhật', time: '2 tuần trước', unread: true },
]

export default function NotificationMenu() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(INITIAL)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  const unread = items.filter((n) => n.unread).length
  const markAll = () => setItems((l) => l.map((n) => ({ ...n, unread: false })))

  return (
    <div className="menu-wrap" ref={ref}>
      <button className="bell" aria-label="Thông báo" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell size={17} />
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>

      {open && (
        <>
          <div className="np-scrim" onClick={() => setOpen(false)} />
          <div className="np" role="dialog" aria-label="Thông báo">
            <div className="np__head">
              <strong>Thông báo</strong>
              <button type="button" className="u-link" onClick={markAll}>Đánh dấu đã đọc</button>
            </div>
            {items.slice(0, 3).map(({ id, type, title, time, unread: u }) => {
              const [Icon, tone] = ICONS[type]
              return (
                <div key={id} className="np__item">
                  <span className={`np__icon np__icon--${tone}`}><Icon size={15} /></span>
                  <div>
                    <strong>{title}</strong>
                    <small>{time}</small>
                  </div>
                  {u && <i className="np__dot" aria-label="Chưa đọc" />}
                </div>
              )
            })}
            <Link to="/thongbao" className="np__foot u-link" onClick={() => setOpen(false)}>
              Xem tất cả thông báo
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
