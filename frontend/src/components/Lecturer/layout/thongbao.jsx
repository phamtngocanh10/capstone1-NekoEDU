import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import useClickOutside from '../../../common/useClickOutside';

export default function ThongBao() {
  const [dangMo, setDangMo] = useState(false);
  const [daDoc, setDaDoc] = useState(false);
  const vungMenu = useRef(null);
  function dongMenu() {
    setDangMo(false);
  }
  useClickOutside(vungMenu, dongMenu, dangMo);
  return (
    <div className="menu-wrap" ref={vungMenu}>
      <button className="bell" aria-label="Thông báo" aria-expanded={dangMo} onClick={() => setDangMo(current => !current)}>
        <Bell size={17} />{!daDoc && <span className="badge">2</span>}
      </button>
      {dangMo && (
        <div className="popover lc-notification-menu">
          <div className="lc-toolbar">
            <strong className="u-grow">Thông báo</strong>
            <button className="lc-text-button" onClick={() => setDaDoc(true)}>Đánh dấu đã đọc</button>
          </div>
          <Link to="/lecturer/trogiang/yeucau" onClick={dongMenu}>Có yêu cầu nhập điểm từ trợ giảng</Link>
          <Link to="/lecturer/bangdiem" onClick={dongMenu}>Kiểm tra bảng điểm chờ xác nhận</Link>
        </div>
      )}
    </div>
  );
}
