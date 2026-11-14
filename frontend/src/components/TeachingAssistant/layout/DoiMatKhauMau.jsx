import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Btn, Dialog, PasswordField } from '../../../common/ui';
import { useManager as useNguCanhTaiKhoan } from '../../Manager/layout/ManagerContext';

export default function DoiMatKhauMau({ dongBieuMau }) {
  const { notify: hienThongBao } = useNguCanhTaiKhoan();
  const [matKhauHienTai, datMatKhauHienTai] = useState('');
  const [matKhauMoi, datMatKhauMoi] = useState('');
  const [xacNhan, datXacNhan] = useState('');
  const [loi, datLoi] = useState('');

  function kiemTraBieuMau(suKien) {
    suKien.preventDefault();
    if (matKhauMoi.length < 8) {
      datLoi('Mật khẩu mới cần có ít nhất 8 ký tự.');
      return;
    }
    if (matKhauMoi === matKhauHienTai) {
      datLoi('Mật khẩu mới cần khác mật khẩu hiện tại.');
      return;
    }
    if (matKhauMoi !== xacNhan) {
      datLoi('Xác nhận mật khẩu chưa trùng khớp.');
      return;
    }
    hienThongBao('Biểu mẫu hợp lệ. Đây là bản mẫu; mật khẩu không được lưu hoặc thay đổi.');
    dongBieuMau();
  }

  return (
    <Dialog title="Đổi mật khẩu" subtitle="Xem trước biểu mẫu bảo mật tài khoản" onClose={dongBieuMau} size="sm">
      <form onSubmit={kiemTraBieuMau}>
        <div className="ta-dialog-content">
          <p className="ta-muted-note">
            Bản mẫu chỉ kiểm tra các trường nhập. Mật khẩu không được xác thực, lưu hoặc thay đổi.
          </p>
          <PasswordField
            label="Mật khẩu hiện tại"
            icon={KeyRound}
            value={matKhauHienTai}
            onChange={suKien => datMatKhauHienTai(suKien.target.value)}
            autoComplete="off"
            required
          />
          <PasswordField
            label="Mật khẩu mới"
            value={matKhauMoi}
            onChange={suKien => datMatKhauMoi(suKien.target.value)}
            autoComplete="off"
            required
          />
          <PasswordField
            label="Xác nhận mật khẩu mới"
            value={xacNhan}
            onChange={suKien => datXacNhan(suKien.target.value)}
            autoComplete="off"
            required
          />
          {loi && <p className="ta-error" role="alert">{loi}</p>}
        </div>
        <div className="ta-dialog-actions">
          <Btn variant="ghost" onClick={dongBieuMau}>Hủy</Btn>
          <Btn type="submit">Kiểm tra biểu mẫu</Btn>
        </div>
      </form>
    </Dialog>
  );
}
