import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ManagerProvider } from '../../Manager/layout/ManagerContext';
import DoiMatKhau from '../../Manager/components/ThongTinCaNhan/ChangePasswordModal';
import ThongBaoNgan from '../../../common/Toast';
import { apiGiangVien } from '../../../api/giangvien';
import { useDuLieu, DangTai } from '../components/dungchung/dungchung';
import { CungCapLopHoc } from './dulieulophoc';
import { useGiangVien } from './ngucanh';
import ThanhBen from './thanhben';
import TieuDe from './tieude';
import '../../../styles/giangvien.css';

function KhungTrang() {
  const [moMenu, setMoMenu] = useState(false);
  const { pwOpen, closePasswordModal, toast, clearToast } = useGiangVien();
  function dongMenu() {
    setMoMenu(false);
  }
  function batTatMenu() {
    setMoMenu(current => !current);
  }
  return (
    <div className="app-shell lc-shell">
      {moMenu && <button className="lc-nav-backdrop" aria-label="Đóng menu" onClick={dongMenu} />}
      <ThanhBen dangMo={moMenu} dongMenu={dongMenu} />
      <div className="app-body">
        <TieuDe dangMo={moMenu} batTatMenu={batTatMenu} />
        <main className="app-main"><Outlet /></main>
      </div>
      {pwOpen && <DoiMatKhau onClose={closePasswordModal} onChangePassword={apiGiangVien.changePassword} />}
      {toast && <ThongBaoNgan message={toast} onDone={clearToast} />}
    </div>
  );
}

export default function BoCucGiangVien() {
  const { data, error, reload } = useDuLieu(() => apiGiangVien.profile());
  if (!data) return <DangTai error={error} retry={reload} />;
  return (
    <ManagerProvider initialUser={data}>
      <CungCapLopHoc><KhungTrang /></CungCapLopHoc>
    </ManagerProvider>
  );
}
