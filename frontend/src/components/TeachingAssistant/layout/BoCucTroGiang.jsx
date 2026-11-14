import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { GraduationCap, Menu, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { ManagerProvider, useManager } from '../../Manager/layout/ManagerContext.jsx';
import Toast from '../../../common/Toast.jsx';
import { AssistantProvider, useAssistant } from './NguCanhTroGiang';
import { MENU_ITEMS, getPageInfo } from './danhMucMenu';
import NotificationMenu from './MenuThongBao';
import GlobalSearch from './TimKiemChung';
import AccountMenu from './MenuTaiKhoan';
import DemoPasswordModal from '../components/ThongTinCaNhan/DoiMatKhauMau';
import { DEMO_PROFILE_KEY, getDemoAccount } from '../data/duLieuTaiKhoan';
import { resetDemoData } from '../data/duLieuTroGiang';
import '../../../styles/assistant-shell.css';
import '../../../styles/assistant-workflows.css';

function Sidebar({ isOpen, activeItem }) {
  return (
    <aside className={`sidebar ta-sidebar ${isOpen ? 'is-open' : ''}`}>
      <Link to="/assistant/tongquan" className="sidebar__brand">
        <span className="logo">
          <GraduationCap size={20} />
        </span>
        <span>
          <strong>NEKO EDU</strong>
          <small>English Center Platform</small>
        </span>
      </Link>
      <div className="sidebar__role">
        <strong>Teaching Assistant</strong>
        <small>Trợ giảng</small>
      </div>
      <nav className="sidebar__nav" aria-label="Điều hướng trợ giảng">
        {MENU_ITEMS.map(({ path, label, icon: Icon }) => (
          <div key={path}>
            <NavLink to={`/assistant/${path}`} className="nav-item">
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
            {path === 'chamdiem' && activeItem?.path === 'chamdiem' && (
              <NavLink to="/assistant/chamdiem/yeucau" className="ta-nav-sub">
                <span />
                Yêu cầu của tôi
              </NavLink>
            )}
          </div>
        ))}
      </nav>
      <div className="ta-sidebar-note">
        <ShieldCheck size={16} />
        <p>
          Đồng hành cùng giảng viên,
          <br />
          hỗ trợ mỗi buổi học.
        </p>
      </div>
    </aside>
  );
}

function AssistantShell({ onReset }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { pathname: path } = useLocation();
  const { data } = useAssistant();
  const {
    header: customHeader,
    pwOpen: isPasswordModalOpen,
    closePasswordModal,
    toast,
    clearToast,
    notify,
  } = useManager();
  const pageInfo = getPageInfo(path, data.classes.length);
  const title = customHeader?.title ?? pageInfo.title;
  const description = customHeader?.subtitle ?? pageInfo.description;

  useEffect(() => {
    setIsMenuOpen(false);
  }, [path]);
  useEffect(() => {
    if (!isMenuOpen) return;
    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsMenuOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  async function handleDemoReset() {
    if (
      isResetting ||
      !window.confirm(
        'Khôi phục lịch, điểm danh, yêu cầu và bảng điểm mẫu? Các thay đổi mẫu hiện tại sẽ được thay thế; hồ sơ vẫn được giữ.'
      )
    )
      return;
    setIsResetting(true);
    try {
      await resetDemoData();
      notify('Đã khôi phục dữ liệu mẫu để bạn thử lại các chức năng.');
      onReset();
    } catch (error) {
      notify(error.message || 'Chưa khôi phục được dữ liệu mẫu.');
      setIsResetting(false);
    }
  }

  return (
    <div className="app-shell ta-shell">
      {isMenuOpen && (
        <button
          className="ta-nav-backdrop"
          aria-label="Đóng menu"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
      <Sidebar isOpen={isMenuOpen} activeItem={pageInfo.activeItem} />
      <div className="app-body">
        <header className="header ta-header">
          <button
            className="ta-menu-button"
            aria-label={isMenuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((value) => !value)}
          >
            {isMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <div className="ta-header__title">
            <div className="ta-title-line">
              <h1>{title}</h1>
              <span className="ta-demo-badge">Dữ liệu mẫu</span>
            </div>
            {description && <p>{description}</p>}
          </div>
          <div className="header__right">
            <GlobalSearch />
            <NotificationMenu />
            <AccountMenu />
          </div>
        </header>
        <div className="ta-demo-note" role="note">
          <span>
            Các thao tác trong bản mẫu được lưu trên trình duyệt này, không gửi lên máy chủ.
          </span>
          <button
            className="ta-reset-demo"
            type="button"
            disabled={isResetting}
            onClick={handleDemoReset}
          >
            <RotateCcw size={12} />
            {isResetting ? 'Đang khôi phục…' : 'Khôi phục dữ liệu mẫu'}
          </button>
        </div>
        <main className="app-main ta-main">
          <Outlet />
        </main>
      </div>
      {isPasswordModalOpen && <DemoPasswordModal onClose={closePasswordModal} />}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  );
}

export default function AssistantLayout() {
  const [initialAccount] = useState(getDemoAccount);
  const [resetVersion, setResetVersion] = useState(0);

  return (
    <ManagerProvider initialUser={initialAccount} taiHoSo={null} khoaLuuTaiKhoan={DEMO_PROFILE_KEY}>
      <AssistantProvider key={resetVersion}>
        <AssistantShell onReset={() => setResetVersion((count) => count + 1)} />
      </AssistantProvider>
    </ManagerProvider>
  );
}
