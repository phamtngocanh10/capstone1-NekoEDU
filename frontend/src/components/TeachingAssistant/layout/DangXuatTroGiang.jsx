import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Card } from '../../../common/ui';
import { logoutAssistant } from '../data/duLieuTaiKhoan';

// Chỉ xóa phiên khi đã rời trang, sau cảnh báo thay đổi chưa lưu nếu có.
export default function Logout() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const handleLogout = useCallback(() => {
    try {
      logoutAssistant();
      navigate('/login', { replace: true });
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }, [navigate]);

  useEffect(() => {
    handleLogout();
  }, [handleLogout]);

  return (
    <Card className="ta-load" role={error ? 'alert' : 'status'}>
      <p>{error || 'Đang đăng xuất…'}</p>
      {error && <Btn onClick={handleLogout}>Thử lại</Btn>}
    </Card>
  );
}
