import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CreditCard, GraduationCap } from 'lucide-react'
import useClickOutside from '../../../common/useClickOutside'
import apiClient from '../../../api/client'
import { useManager } from './ManagerContext'

const ICONS = { fee: [CreditCard, 'fee'], score: [GraduationCap, 'score'], info: [Bell, 'info'] }

export default function NotificationMenu() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const { notify } = useManager()
  const reload = useCallback(async () => {
    const { data } = await apiClient.get('/notifications')
    setItems((Array.isArray(data) ? data : data.items ?? []).map(item => ({
      ...item, unread: item.unread ?? !item.read,
    })))
  }, [])
  useEffect(() => { reload().catch(error => notify(error.message)) }, [reload, notify, open])
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  const unreadCount = items.filter((notification) => notification.unread).length

  async function markAllAsRead() {
    try {
      await apiClient.post('/notifications/read-all')
      await reload()
    } catch (error) { notify(error.message) }
  }

  return (
    <div className="menu-wrap" ref={ref}>
      <button className="bell" aria-label="Thông báo" aria-expanded={open} onClick={() => setOpen((isOpen) => !isOpen)}>
        <Bell size={17} />
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>

      {open && (
        <>
          <div className="np-scrim" onClick={() => setOpen(false)} />
          <div className="np" role="dialog" aria-label="Thông báo">
            <div className="np__head">
              <strong>Thông báo</strong>
              <button type="button" className="u-link" onClick={markAllAsRead}>Đánh dấu đã đọc</button>
            </div>
            {items.slice(0, 3).map(({ id, type, title, time, unread }) => {
              const [Icon, tone] = ICONS[type] ?? ICONS.info
              return (
                <div key={id} className="np__item">
                  <span className={`np__icon np__icon--${tone}`}><Icon size={15} /></span>
                  <div>
                    <strong>{title}</strong>
                    <small>{time}</small>
                  </div>
                  {unread && <i className="np__dot" aria-label="Chưa đọc" />}
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
