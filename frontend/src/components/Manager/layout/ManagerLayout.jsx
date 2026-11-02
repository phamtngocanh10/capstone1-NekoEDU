import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import Toast from '../../../common/Toast'
import ChangePasswordModal from '../components/ThongTinCaNhan/ChangePasswordModal'
import { ManagerProvider, useManager } from './ManagerContext'

function Shell() {
  const { pwOpen, closePasswordModal, toast, clearToast } = useManager()
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-body">
        <Header />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      {pwOpen && <ChangePasswordModal onClose={closePasswordModal} />}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}

export default function ManagerLayout() {
  return (
    <ManagerProvider>
      <Shell />
    </ManagerProvider>
  )
}
