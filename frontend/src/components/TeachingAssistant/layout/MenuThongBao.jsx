import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import useBamNgoai from '../../../common/useClickOutside';
import { useManager as useNguCanhTaiKhoan } from '../../Manager/layout/ManagerContext';
import { dinhDangNgayGio, useTaiDuLieu } from '../components/DungChung';
import { duLieuTroGiang } from '../duLieuTroGiang';

function ThongBaoTomTat({ thongBao, dongMenu }) {
  return (
    <Link
      className={`ta-notification-preview ${!thongBao.read ? 'is-unread' : ''}`}
      to="/assistant/thongbao"
      onClick={dongMenu}
    >
      <span className="ta-notification-preview__icon"><Bell size={15} /></span>
      <span>
        <strong>{thongBao.title}</strong>
        <small>{dinhDangNgayGio(thongBao.time)}</small>
      </span>
      {!thongBao.read && <i />}
    </Link>
  );
}

export default function MenuThongBao() {
  const [dangMo, datDangMo] = useState(false);
  const vungMenu = useRef(null);
  const duLieuThongBao = useTaiDuLieu(duLieuTroGiang.layThongBao, [dangMo]);
  const { notify: hienThongBao } = useNguCanhTaiKhoan();
  const danhSach = duLieuThongBao.duLieu?.items ?? [];
  const soChuaDoc = duLieuThongBao.duLieu?.unread ?? 0;
  const nhanThongBao = `Thông báo${soChuaDoc ? `, ${soChuaDoc} chưa đọc` : ''}`;

  function dongMenu() {
    datDangMo(false);
  }

  useBamNgoai(vungMenu, dongMenu, dangMo);

  async function docTatCaThongBao() {
    try {
      await duLieuTroGiang.danhDauTatCaDaDoc();
      duLieuThongBao.taiLai();
    } catch (loi) {
      hienThongBao(loi.message);
    }
  }

  return (
    <div className="menu-wrap" ref={vungMenu}>
      <button
        className="bell"
        aria-label={nhanThongBao}
        aria-expanded={dangMo}
        onClick={() => datDangMo(giaTri => !giaTri)}
      >
        <Bell size={17} />
        {soChuaDoc > 0 && <span className="badge">{soChuaDoc > 99 ? '99+' : soChuaDoc}</span>}
      </button>

      {dangMo && (
        <div className="popover ta-notification-popover">
          <div className="ta-notification-popover__head">
            <strong>Thông báo</strong>
            {soChuaDoc > 0 && (
              <button className="u-link" onClick={docTatCaThongBao}>Đọc tất cả</button>
            )}
          </div>
          {duLieuThongBao.loi && <p role="alert">{duLieuThongBao.loi}</p>}
          {!duLieuThongBao.loi && !danhSach.length && (
            <p>{duLieuThongBao.dangTai ? 'Đang tải thông báo…' : 'Bạn chưa có thông báo mới.'}</p>
          )}
          {danhSach.slice(0, 4).map(thongBao => (
            <ThongBaoTomTat key={thongBao.id} thongBao={thongBao} dongMenu={dongMenu} />
          ))}
          <Link className="ta-notification-popover__foot" to="/assistant/thongbao" onClick={dongMenu}>
            Xem tất cả thông báo <ChevronRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}
