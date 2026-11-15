import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, RotateCcw, X } from 'lucide-react';
import Toast from '../../../common/Toast';
import { StudentParentProvider, useStudentParent } from './NguCanhHocVien';
import { getPageInfo } from './menu';
import Sidebar from './ThanhBen';
import GlobalSearch from './TimKiemChung';
import NotificationMenu from './MenuThongBao';
import AccountMenu from './MenuTaiKhoan';
import '../../../styles/student-parent.css';

function StudentShell() {
  const {
    data,
    student,
    enrolledCourses,
    selectStudent,
    resetDemoData,
    notify,
    toastMessage,
    clearToast,
  } = useStudentParent();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const pageInfo = getPageInfo(pathname, student, data.taiKhoan);
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    function closeMenuOnEscape(event) {
      if (event.key === 'Escape') setIsMenuOpen(false);
    }
    window.addEventListener('keydown', closeMenuOnEscape);
    return () => window.removeEventListener('keydown', closeMenuOnEscape);
  }, []);
  function handleStudentChange(event) {
    try {
      selectStudent(event.target.value);
    } catch (error) {
      notify(error.message);
    }
  }
  function handleDemoReset() {
    if (
      !window.confirm(
        'Khôi phục toàn bộ dữ liệu mẫu? Các đăng ký, thanh toán mô phỏng, phản hồi, đánh giá và hồ sơ bạn đã sửa sẽ được đặt lại.'
      )
    )
      return;
    try {
      resetDemoData();
      notify('Đã khôi phục dữ liệu mẫu cho tuần hiện tại.');
    } catch (error) {
      notify(error.message);
    }
  }
  return (
    <div className="app-shell sp-shell">
      {isMenuOpen && (
        <button
          className="sp-menu-backdrop"
          aria-label="Đóng menu điều hướng"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
      <Sidebar isOpen={isMenuOpen} />
      <div className="app-body">
        <header className="header sp-header">
          <button
            type="button"
            className="sp-menu-button"
            aria-label={isMenuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((value) => !value)}
          >
            {isMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <div className="sp-header-title">
            <div className="sp-title-line">
              <h1>{pageInfo.title}</h1>
              <span className="sp-sample-label">Dữ liệu mẫu</span>
            </div>
            <p>{pageInfo.description}</p>
          </div>
          <div className="header__right">
            <GlobalSearch />
            <NotificationMenu />
            <AccountMenu />
          </div>
        </header>
        <div className="sp-note-banner" role="note">
          <span>Bản mẫu frontend · Các thay đổi chỉ lưu trên trình duyệt này.</span>
          <button onClick={handleDemoReset}>
            <RotateCcw size={11} />
            Khôi phục dữ liệu mẫu
          </button>
        </div>
        <main className="app-main">
          <div className="sp-student-bar">
            <div className="sp-student-identity">
              <span className="sp-student-avatar">{student.ten.split(' ').at(-1).charAt(0)}</span>
              <div>
                <strong>Đang xem hồ sơ học viên: {student.ten}</strong>
                <small>
                  {enrolledCourses.map((course) => course.ten).join(', ') || 'Chưa có lớp đang học'}{' '}
                  · Mã HV: {student.maSo}
                </small>
              </div>
            </div>
            <label className="sp-student-picker">
              Đổi học viên
              <select aria-label="Đổi học viên" value={student.ma} onChange={handleStudentChange}>
                {data.hocVien.map((student) => (
                  <option value={student.ma} key={student.ma}>
                    {student.ten}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Outlet />
        </main>
      </div>
      {toastMessage && <Toast key={toastMessage} message={toastMessage} onDone={clearToast} />}
    </div>
  );
}

export default function StudentParentLayout() {
  return (
    <StudentParentProvider>
      <StudentShell />
    </StudentParentProvider>
  );
}
