import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Btn, Dialog, PasswordField } from '../../../../common/ui';
import { useManager } from '../../../Manager/layout/ManagerContext.jsx';

export default function DemoPasswordModal({ onClose }) {
  const { notify } = useManager();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState('');

  function validatePasswordForm(event) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError('Mật khẩu mới cần có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Mật khẩu mới cần khác mật khẩu hiện tại.');
      return;
    }
    if (newPassword !== passwordConfirmation) {
      setError('Xác nhận mật khẩu chưa trùng khớp.');
      return;
    }
    notify('Biểu mẫu hợp lệ. Đây là bản mẫu; mật khẩu không được lưu hoặc thay đổi.');
    onClose();
  }

  return (
    <Dialog
      title="Đổi mật khẩu"
      subtitle="Xem trước biểu mẫu bảo mật tài khoản"
      onClose={onClose}
      size="sm"
    >
      <form onSubmit={validatePasswordForm}>
        <div className="ta-dialog-content">
          <p className="ta-muted-note">
            Bản mẫu chỉ kiểm tra các trường nhập. Mật khẩu không được xác thực, lưu hoặc thay đổi.
          </p>
          <PasswordField
            label="Mật khẩu hiện tại"
            icon={KeyRound}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="off"
            required
          />
          <PasswordField
            label="Mật khẩu mới"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="off"
            required
          />
          <PasswordField
            label="Xác nhận mật khẩu mới"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            autoComplete="off"
            required
          />
          {error && (
            <p className="ta-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="ta-dialog-actions">
          <Btn variant="ghost" onClick={onClose}>
            Hủy
          </Btn>
          <Btn type="submit">Kiểm tra biểu mẫu</Btn>
        </div>
      </form>
    </Dialog>
  );
}
