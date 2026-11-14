import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  ChevronRight,
  FileText,
  GraduationCap,
  HeartHandshake,
  LogOut,
  Menu,
  RotateCcw,
  Search,
  User,
  X,
} from 'lucide-react';
import useBamngoai from '../../../common/useClickOutside';
import Thongbaongan from '../../../common/Toast';
import { Cungcaphocvien, useHocvienphuhuynh } from './NguCanhHocVien';
import { cacmucmenu, laytieudetrang } from './menu';
import { dangxuathocvien } from './duLieuDangNhap';
import { dinhdangngay, loctheotukhoa } from '../components/tienIch';
import '../../../styles/student-parent.css';

function Thanhben({ dangMo: dangmo }) {
  return (
    <aside className={`sidebar sp-sidebar ${dangmo ? 'is-open' : ''}`}>
      <Link to="/student/trangchu" className="sidebar__brand">
        <span className="logo">
          <GraduationCap size={20} />
        </span>
        <div>
          <strong>NEKO EDU</strong>
          <small>English Center Platform</small>
        </div>
      </Link>
      <div className="sidebar__role">
        <strong>Student / Parent</strong>
        <small>Tài khoản dùng chung</small>
      </div>
      <nav className="sidebar__nav" aria-label="Điều hướng học viên và phụ huynh">
        {cacmucmenu.map(({ duongDan: duongdan, ten, bieuTuong: Bieutuong }) => (
          <NavLink to={`/student/${duongdan}`} className="nav-item" key={duongdan}>
            <Bieutuong size={17} />
            <span>{ten}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sp-sidebar-foot">
        <HeartHandshake size={18} />
        <p>
          Đồng hành cùng gia đình,
          <br />
          nuôi dưỡng mỗi tiến bộ.
        </p>
      </div>
    </aside>
  );
}

function Timkiemchung() {
  const { duLieu: dulieu, hocVien: hocvien, cacKhoaDangHoc: cackhoadanghoc } = useHocvienphuhuynh();
  const { pathname: duongdan } = useLocation();
  const [tukhoa, dattukhoa] = useState('');
  const [dangmo, datdangmo] = useState(false);
  const khung = useRef(null);
  useBamngoai(khung, () => datdangmo(false), dangmo);
  useEffect(() => {
    dattukhoa('');
    datdangmo(false);
  }, [duongdan, hocvien.ma]);
  const cacmakhoa = new Set(cackhoadanghoc.map((khoa) => khoa.ma));
  const cactep = dulieu.taiLieu.filter((tep) => cacmakhoa.has(tep.maKhoa));
  const cackhoatimthay = tukhoa.trim()
    ? loctheotukhoa(cackhoadanghoc, tukhoa, (khoa) => khoa.ten).slice(0, 3)
    : [];
  const cacteptimthay = tukhoa.trim()
    ? loctheotukhoa(cactep, tukhoa, (tep) => tep.ten).slice(0, 4)
    : [];
  return (
    <div className="sp-search" ref={khung}>
      <label className="search">
        <Search size={15} />
        <input
          type="search"
          aria-label="Tìm khóa học, tài liệu"
          placeholder="Tìm khóa học, tài liệu..."
          value={tukhoa}
          onChange={(sukien) => {
            dattukhoa(sukien.target.value);
            datdangmo(true);
          }}
          onFocus={() => datdangmo(true)}
        />
      </label>
      {dangmo && tukhoa.trim() && (
        <div className="sp-search-results" role="region" aria-label="Kết quả tìm kiếm">
          {cackhoatimthay.map((khoa) => (
            <Link key={khoa.ma} to={`/student/khoahoc/${khoa.ma}`} onClick={() => datdangmo(false)}>
              <BookOpen size={17} />
              <span>
                {khoa.ten}
                <small>Khóa học · {khoa.nhom}</small>
              </span>
            </Link>
          ))}
          {cacteptimthay.map((tep) => (
            <Link
              key={tep.ma}
              to={`/student/tailieu?timkiem=${encodeURIComponent(tep.ten)}`}
              onClick={() => datdangmo(false)}
            >
              <FileText size={17} />
              <span>
                {tep.ten}
                <small>Tài liệu · {tep.loai}</small>
              </span>
            </Link>
          ))}
          {!cackhoatimthay.length && !cacteptimthay.length && (
            <p>Không tìm thấy khóa học hoặc tài liệu phù hợp.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Menuthongbao() {
  const { cacThongBao: cacthongbao } = useHocvienphuhuynh();
  const [dangmo, datdangmo] = useState(false);
  const khung = useRef(null);
  useBamngoai(khung, () => datdangmo(false), dangmo);
  const sochuadoc = cacthongbao.filter((thongbao) => !thongbao.daDoc).length;
  return (
    <div className="menu-wrap" ref={khung}>
      <button
        type="button"
        className="bell"
        aria-label={`Thông báo, ${sochuadoc} chưa đọc`}
        aria-expanded={dangmo}
        onClick={() => datdangmo((giatri) => !giatri)}
      >
        <Bell size={19} />
        {sochuadoc > 0 && <span className="badge">{sochuadoc}</span>}
      </button>
      {dangmo && (
        <div className="popover sp-notice-popover">
          <strong>Thông báo mới</strong>
          {cacthongbao.slice(0, 3).map((thongbao) => (
            <Link
              to={`/student/thongbao/${thongbao.ma}`}
              key={thongbao.ma}
              onClick={() => datdangmo(false)}
            >
              <strong>{thongbao.tieuDe}</strong>
              <small>{dinhdangngay(thongbao.ngayGui)}</small>
            </Link>
          ))}
          <Link to="/student/thongbao" onClick={() => datdangmo(false)}>
            Xem tất cả thông báo <ChevronRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}

function Menutaikhoan() {
  const { duLieu: dulieu, thongBao: thongbao } = useHocvienphuhuynh();
  const chuyentrang = useNavigate();
  const [dangmo, datdangmo] = useState(false);
  const khung = useRef(null);
  useBamngoai(khung, () => datdangmo(false), dangmo);
  const taikhoan = dulieu.taiKhoan;
  function dangxuat() {
    try {
      dangxuathocvien();
      chuyentrang('/login', { replace: true });
    } catch (loi) {
      thongbao(loi.message);
    }
  }
  return (
    <div className="menu-wrap" ref={khung}>
      <button
        type="button"
        className="user"
        aria-label="Menu tài khoản"
        aria-haspopup="menu"
        aria-expanded={dangmo}
        onClick={() => datdangmo((giatri) => !giatri)}
      >
        <span className="avatar">
          {taikhoan.anhDaiDien ? (
            <img src={taikhoan.anhDaiDien} alt={taikhoan.ten} />
          ) : (
            taikhoan.ten.trim().split(/\s+/).at(-1).charAt(0)
          )}
        </span>
        <div>
          <strong>{taikhoan.ten.split(' ').slice(-2).join(' ')}</strong>
          <small>Học viên/PH</small>
        </div>
      </button>
      {dangmo && (
        <div className="popover sp-user-menu" role="menu">
          <div className="sp-user-summary">
            <strong>{taikhoan.ten}</strong>
            <small>{taikhoan.email}</small>
          </div>
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              datdangmo(false);
              chuyentrang('/student/thongtincanhan');
            }}
          >
            <User size={16} />
            Thông tin cá nhân
          </button>
          <hr />
          <button className="menu-item menu-item--danger" role="menuitem" onClick={dangxuat}>
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

function Khungtrang() {
  const {
    duLieu: dulieu,
    hocVien: hocvien,
    cacKhoaDangHoc: cackhoadanghoc,
    doiHocVien: doihocvien,
    khoiPhucMau: khoiphucmau,
    thongBao: thongbao,
    loiNhan: loinhan,
    xoaThongBao: xoathongbao,
  } = useHocvienphuhuynh();
  const [dangmomenu, datdangmomenu] = useState(false);
  const { pathname: duongdan } = useLocation();
  const trang = laytieudetrang(duongdan, hocvien, dulieu.taiKhoan);
  useEffect(() => {
    datdangmomenu(false);
  }, [duongdan]);
  useEffect(() => {
    function dongkhinhanesc(sukien) {
      if (sukien.key === 'Escape') datdangmomenu(false);
    }
    window.addEventListener('keydown', dongkhinhanesc);
    return () => window.removeEventListener('keydown', dongkhinhanesc);
  }, []);
  function chonhocvien(sukien) {
    try {
      doihocvien(sukien.target.value);
    } catch (loi) {
      thongbao(loi.message);
    }
  }
  function khoiphuc() {
    if (
      !window.confirm(
        'Khôi phục toàn bộ dữ liệu mẫu? Các đăng ký, thanh toán mô phỏng, phản hồi, đánh giá và hồ sơ bạn đã sửa sẽ được đặt lại.'
      )
    )
      return;
    try {
      khoiphucmau();
      thongbao('Đã khôi phục dữ liệu mẫu cho tuần hiện tại.');
    } catch (loi) {
      thongbao(loi.message);
    }
  }
  return (
    <div className="app-shell sp-shell">
      {dangmomenu && (
        <button
          className="sp-menu-backdrop"
          aria-label="Đóng menu điều hướng"
          onClick={() => datdangmomenu(false)}
        />
      )}
      <Thanhben dangMo={dangmomenu} />
      <div className="app-body">
        <header className="header sp-header">
          <button
            type="button"
            className="sp-menu-button"
            aria-label={dangmomenu ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={dangmomenu}
            onClick={() => datdangmomenu((giatri) => !giatri)}
          >
            {dangmomenu ? <X size={21} /> : <Menu size={21} />}
          </button>
          <div className="sp-header-title">
            <div className="sp-title-line">
              <h1>{trang.ten}</h1>
              <span className="sp-sample-label">Dữ liệu mẫu</span>
            </div>
            <p>{trang.moTa}</p>
          </div>
          <div className="header__right">
            <Timkiemchung />
            <Menuthongbao />
            <Menutaikhoan />
          </div>
        </header>
        <div className="sp-note-banner" role="note">
          <span>Bản mẫu frontend · Các thay đổi chỉ lưu trên trình duyệt này.</span>
          <button onClick={khoiphuc}>
            <RotateCcw size={11} />
            Khôi phục dữ liệu mẫu
          </button>
        </div>
        <main className="app-main">
          <div className="sp-student-bar">
            <div className="sp-student-identity">
              <span className="sp-student-avatar">{hocvien.ten.split(' ').at(-1).charAt(0)}</span>
              <div>
                <strong>Đang xem hồ sơ học viên: {hocvien.ten}</strong>
                <small>
                  {cackhoadanghoc.map((khoa) => khoa.ten).join(', ') || 'Chưa có lớp đang học'} · Mã
                  HV: {hocvien.maSo}
                </small>
              </div>
            </div>
            <label className="sp-student-picker">
              Đổi học viên
              <select aria-label="Đổi học viên" value={hocvien.ma} onChange={chonhocvien}>
                {dulieu.hocVien.map((hocvien) => (
                  <option value={hocvien.ma} key={hocvien.ma}>
                    {hocvien.ten}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Outlet />
        </main>
      </div>
      {loinhan && <Thongbaongan key={loinhan} message={loinhan} onDone={xoathongbao} />}
    </div>
  );
}

export default function Bocuchocvien() {
  return (
    <Cungcaphocvien>
      <Khungtrang />
    </Cungcaphocvien>
  );
}
