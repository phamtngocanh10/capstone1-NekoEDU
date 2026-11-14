import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { GraduationCap, Menu, RotateCcw, ShieldCheck, X } from 'lucide-react';
import {
  ManagerProvider as CungCapTaiKhoan,
  useManager as useNguCanhTaiKhoan,
} from '../../Manager/layout/ManagerContext';
import ThongBaoNgan from '../../../common/Toast';
import { CungCapTroGiang, useTroGiang } from './NguCanhTroGiang';
import { CAC_MUC_MENU, layThongTinTrang } from './menu';
import MenuThongBao from './MenuThongBao';
import TimKiemChung from './TimKiemChung';
import MenuTaiKhoan from './MenuTaiKhoan';
import DoiMatKhauMau from './DoiMatKhauMau';
import { KHOA_TAI_KHOAN_MAU, layTaiKhoanMau } from './duLieuTaiKhoan';
import { khoiPhucDuLieuMau } from '../duLieuTroGiang';
import '../../../styles/assistant-shell.css';
import '../../../styles/assistant-workflows.css';

function ThanhBen({ dangMo, mucHienTai }) {
  return (
    <aside className={`sidebar ta-sidebar ${dangMo ? 'is-open' : ''}`}>
      <Link to="/assistant/tongquan" className="sidebar__brand">
        <span className="logo"><GraduationCap size={20} /></span>
        <span><strong>NEKO EDU</strong><small>English Center Platform</small></span>
      </Link>
      <div className="sidebar__role">
        <strong>Teaching Assistant</strong>
        <small>Trợ giảng</small>
      </div>
      <nav className="sidebar__nav" aria-label="Điều hướng trợ giảng">
        {CAC_MUC_MENU.map(({ duongDan, nhan, bieuTuong: BieuTuong }) => (
          <div key={duongDan}>
            <NavLink to={`/assistant/${duongDan}`} className="nav-item">
              <BieuTuong size={17} /><span>{nhan}</span>
            </NavLink>
            {duongDan === 'chamdiem' && mucHienTai?.duongDan === 'chamdiem' && (
              <NavLink to="/assistant/chamdiem/yeucau" className="ta-nav-sub">
                <span />Yêu cầu của tôi
              </NavLink>
            )}
          </div>
        ))}
      </nav>
      <div className="ta-sidebar-note">
        <ShieldCheck size={16} />
        <p>Đồng hành cùng giảng viên,<br />hỗ trợ mỗi buổi học.</p>
      </div>
    </aside>
  );
}

function KhungTrang({ sauKhoiPhuc }) {
  const [dangMoMenu, datDangMoMenu] = useState(false);
  const [dangKhoiPhuc, datDangKhoiPhuc] = useState(false);
  const { pathname: duongDan } = useLocation();
  const { duLieu } = useTroGiang();
  const {
    header: tieuDeRieng,
    pwOpen: dangMoDoiMatKhau,
    closePasswordModal: dongDoiMatKhau,
    toast: thongBaoNgan,
    clearToast: xoaThongBaoNgan,
    notify: hienThongBao,
  } = useNguCanhTaiKhoan();
  const thongTinTrang = layThongTinTrang(duongDan, duLieu.classes.length);
  const tieuDe = tieuDeRieng?.title ?? thongTinTrang.tieuDe;
  const moTa = tieuDeRieng?.subtitle ?? thongTinTrang.moTa;

  useEffect(() => { datDangMoMenu(false); }, [duongDan]);
  useEffect(() => {
    if (!dangMoMenu) return;
    function xuLyPhim(suKien) {
      if (suKien.key === 'Escape') datDangMoMenu(false);
    }
    document.addEventListener('keydown', xuLyPhim);
    return () => document.removeEventListener('keydown', xuLyPhim);
  }, [dangMoMenu]);

  async function khoiPhucMau() {
    if (dangKhoiPhuc || !window.confirm('Khôi phục lịch, điểm danh, yêu cầu và bảng điểm mẫu? Các thay đổi mẫu hiện tại sẽ được thay thế; hồ sơ vẫn được giữ.')) return;
    datDangKhoiPhuc(true);
    try {
      await khoiPhucDuLieuMau();
      hienThongBao('Đã khôi phục dữ liệu mẫu để bạn thử lại các chức năng.');
      sauKhoiPhuc();
    } catch (loi) {
      hienThongBao(loi.message || 'Chưa khôi phục được dữ liệu mẫu.');
      datDangKhoiPhuc(false);
    }
  }

  return (
    <div className="app-shell ta-shell">
      {dangMoMenu && (
        <button className="ta-nav-backdrop" aria-label="Đóng menu" onClick={() => datDangMoMenu(false)} />
      )}
      <ThanhBen dangMo={dangMoMenu} mucHienTai={thongTinTrang.mucHienTai} />
      <div className="app-body">
        <header className="header ta-header">
          <button
            className="ta-menu-button"
            aria-label={dangMoMenu ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={dangMoMenu}
            onClick={() => datDangMoMenu(giaTri => !giaTri)}
          >
            {dangMoMenu ? <X size={21} /> : <Menu size={21} />}
          </button>
          <div className="ta-header__title">
            <div className="ta-title-line">
              <h1>{tieuDe}</h1>
              <span className="ta-demo-badge">Dữ liệu mẫu</span>
            </div>
            {moTa && <p>{moTa}</p>}
          </div>
          <div className="header__right">
            <TimKiemChung />
            <MenuThongBao />
            <MenuTaiKhoan />
          </div>
        </header>
        <div className="ta-demo-note" role="note">
          <span>Các thao tác trong bản mẫu được lưu trên trình duyệt này, không gửi lên máy chủ.</span>
          <button className="ta-reset-demo" type="button" disabled={dangKhoiPhuc} onClick={khoiPhucMau}>
            <RotateCcw size={12} />{dangKhoiPhuc ? 'Đang khôi phục…' : 'Khôi phục dữ liệu mẫu'}
          </button>
        </div>
        <main className="app-main ta-main"><Outlet /></main>
      </div>
      {dangMoDoiMatKhau && <DoiMatKhauMau dongBieuMau={dongDoiMatKhau} />}
      {thongBaoNgan && <ThongBaoNgan message={thongBaoNgan} onDone={xoaThongBaoNgan} />}
    </div>
  );
}

export default function BoCucTroGiang() {
  const [taiKhoanBanDau] = useState(layTaiKhoanMau);
  const [lanKhoiPhuc, datLanKhoiPhuc] = useState(0);

  return (
    <CungCapTaiKhoan
      initialUser={taiKhoanBanDau}
      taiHoSo={null}
      khoaLuuTaiKhoan={KHOA_TAI_KHOAN_MAU}
    >
      <CungCapTroGiang key={lanKhoiPhuc}>
        <KhungTrang sauKhoiPhuc={() => datLanKhoiPhuc(soLan => soLan + 1)} />
      </CungCapTroGiang>
    </CungCapTaiKhoan>
  );
}
