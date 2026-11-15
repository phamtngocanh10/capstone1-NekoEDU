import { useState } from 'react';
import { Btn, PasswordField } from '../../../../common/ui';
import { Dialog } from '../shared/DungChung';

export default function DemoPasswordModal({ onClose, notify }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  function validatePasswordForm(event) {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Mật khẩu mới cần có ít nhất 8 ký tự.');
    } else if (newPassword === currentPassword) {
      setError('Mật khẩu mới cần khác mật khẩu hiện tại.');
    } else if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu chưa trùng khớp.');
    } else {
      notify('Biểu mẫu hợp lệ. Mật khẩu không được lưu hoặc thay đổi trong bản mẫu.');
      onClose();
    }
  }

  return (
    <Dialog
      title="Đổi mật khẩu"
      subtitle="Xem trước biểu mẫu bảo mật tài khoản"
      size="sm"
      onClose={onClose}
    >
      <form onSubmit={validatePasswordForm}>
        <div className="sp-dialog-body sp-stack">
          <p className="sp-note">
            Đây là biểu mẫu minh họa: không xác thực mật khẩu hiện tại, không lưu và không thay đổi
            mật khẩu đăng nhập.
          </p>
          <PasswordField
            label="Mật khẩu hiện tại"
            value={currentPassword}
            required
            autoComplete="off"
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <PasswordField
            label="Mật khẩu mới"
            value={newPassword}
            required
            autoComplete="off"
            maxLength={100}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <PasswordField
            label="Xác nhận mật khẩu mới"
            value={confirmPassword}
            required
            autoComplete="off"
            maxLength={100}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {error && (
            <p className="sp-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="sp-dialog-actions">
          <Btn variant="ghost" onClick={onClose}>
            Hủy
          </Btn>
          <Btn type="submit">Kiểm tra biểu mẫu</Btn>
        </div>
      </form>
    </Dialog>
  );
}
