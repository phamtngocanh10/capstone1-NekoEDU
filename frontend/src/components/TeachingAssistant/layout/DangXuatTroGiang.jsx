import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Card } from '../../../common/ui';
import { dangXuatTroGiang } from './duLieuTaiKhoan';

// Chỉ xóa phiên khi đã rời trang, sau cảnh báo thay đổi chưa lưu nếu có.
export default function DangXuatTroGiang() {
  const chuyenTrang = useNavigate();
  const [loi, datLoi] = useState('');
  const xuLyDangXuat = useCallback(() => {
    try {
      dangXuatTroGiang();
      chuyenTrang('/login', { replace: true });
    } catch (loiDangXuat) {
      datLoi(loiDangXuat.message);
    }
  }, [chuyenTrang]);

  useEffect(() => { xuLyDangXuat(); }, [xuLyDangXuat]);

  return (
    <Card className="ta-load" role={loi ? 'alert' : 'status'}>
      <p>{loi || 'Đang đăng xuất…'}</p>
      {loi && <Btn onClick={xuLyDangXuat}>Thử lại</Btn>}
    </Card>
  );
}
