import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays, Camera, KeyRound, Mail, MapPin,
  MonitorSmartphone, Phone, ShieldCheck, User,
} from 'lucide-react';
import Button from '../../../common/Button';
import Input from '../../../common/Input';
import {
  initialOf as chuCaiDauTen,
  useManager as useNguCanhTaiKhoan,
} from '../../Manager/layout/ManagerContext';
import { luuTaiKhoanMau } from '../layout/duLieuTaiKhoan';

function layCacTruongHoSo(taiKhoan) {
  return {
    name: taiKhoan.name,
    phone: taiKhoan.phone,
    email: taiKhoan.email,
    address: taiKhoan.address,
  };
}

function docAnhDaiDien(tepAnh) {
  return new Promise((thanhCong, thatBai) => {
    const boDoc = new FileReader();
    boDoc.onload = () => thanhCong(String(boDoc.result));
    boDoc.onerror = () => thatBai(new Error('Không đọc được ảnh. Vui lòng chọn tệp khác.'));
    boDoc.readAsDataURL(tepAnh);
  });
}

export default function ThongTinCaNhanTroGiang() {
  const {
    user: taiKhoan,
    updateUser: capNhatTaiKhoan,
    openPasswordModal: moDoiMatKhau,
    notify: hienThongBao,
  } = useNguCanhTaiKhoan();
  const [bieuMau, datBieuMau] = useState(() => layCacTruongHoSo(taiKhoan));
  const [dangDocAnh, datDangDocAnh] = useState(false);
  const [loi, datLoi] = useState('');
  const oChonAnh = useRef(null);

  useEffect(() => {
    datBieuMau(layCacTruongHoSo(taiKhoan));
  }, [taiKhoan.name, taiKhoan.phone, taiKhoan.email, taiKhoan.address]);

  const coThayDoi = Object.keys(bieuMau).some(tenTruong => bieuMau[tenTruong] !== taiKhoan[tenTruong]);
  const hopLe = Boolean(bieuMau.name.trim() && /\S+@\S+\.\S+/.test(bieuMau.email));

  function doiTruong(tenTruong, giaTri) {
    datBieuMau(duLieuCu => ({ ...duLieuCu, [tenTruong]: giaTri }));
  }

  function luuThayDoi(thayDoi, thongDiep) {
    const hoSoDaLuu = luuTaiKhoanMau({ ...taiKhoan, ...thayDoi });
    capNhatTaiKhoan(hoSoDaLuu);
    hienThongBao(thongDiep);
  }

  function luuHoSo(suKien) {
    suKien.preventDefault();
    datLoi('');
    const soDienThoai = bieuMau.phone.replace(/\s/g, '');
    if (soDienThoai && !/^0\d{9}$/.test(soDienThoai)) {
      datLoi('Số điện thoại cần có 10 chữ số và bắt đầu bằng 0.');
      return;
    }
    try {
      luuThayDoi({
        name: bieuMau.name.trim(),
        email: bieuMau.email.trim(),
        phone: soDienThoai,
        address: bieuMau.address.trim(),
      }, 'Đã lưu hồ sơ mẫu trên trình duyệt');
    } catch (loiLuu) {
      datLoi(loiLuu.message);
    }
  }

  async function doiAnhDaiDien(suKien) {
    const tepAnh = suKien.target.files?.[0];
    suKien.target.value = '';
    if (!tepAnh) return;
    datLoi('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(tepAnh.type)
      || !tepAnh.size || tepAnh.size > 1024 * 1024) {
      datLoi('Chọn ảnh PNG, JPEG hoặc WEBP có dung lượng tối đa 1 MB.');
      return;
    }
    datDangDocAnh(true);
    try {
      const anhDaiDien = await docAnhDaiDien(tepAnh);
      luuThayDoi({ avatarUrl: anhDaiDien }, 'Đã cập nhật ảnh đại diện mẫu trên trình duyệt');
    } catch (loiAnh) {
      datLoi(loiAnh.message);
    } finally {
      datDangDocAnh(false);
    }
  }

  return (
    <div className="profile ta-profile">
      <div className="profile__top">
        <section className="card profile-card">
          <div className="profile-card__avatar">
            <span>
              {taiKhoan.avatarUrl ? (
                <img
                  src={taiKhoan.avatarUrl}
                  alt={taiKhoan.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                />
              ) : chuCaiDauTen(taiKhoan.name)}
            </span>
            <input
              type="file"
              ref={oChonAnh}
              hidden
              accept="image/png,image/jpeg,image/webp"
              onChange={doiAnhDaiDien}
            />
            <button
              type="button"
              aria-label="Đổi ảnh đại diện"
              disabled={dangDocAnh}
              onClick={() => oChonAnh.current?.click()}
            >
              <Camera size={13} />
            </button>
          </div>
          <strong>{taiKhoan.name}</strong>
          <span className="chip chip--info">Trợ giảng</span>
          <ul>
            <li><Mail size={14} />{taiKhoan.email}</li>
            <li><CalendarDays size={14} />Tham gia từ {taiKhoan.joined}</li>
          </ul>
        </section>

        <form className="card" onSubmit={luuHoSo}>
          <div className="card__head"><h3>Thông tin chung</h3></div>
          <div className="form-grid">
            <Input
              label="Họ và tên" icon={User} value={bieuMau.name} maxLength={100} required
              onChange={suKien => doiTruong('name', suKien.target.value)}
            />
            <Input
              label="Số điện thoại" icon={Phone} value={bieuMau.phone} maxLength={20}
              onChange={suKien => doiTruong('phone', suKien.target.value)}
            />
            <Input
              label="Email" icon={Mail} type="email" value={bieuMau.email} maxLength={150} required
              onChange={suKien => doiTruong('email', suKien.target.value)}
            />
            <Input label="Vai trò" icon={ShieldCheck} value="Teaching Assistant" readOnly disabled />
            <div className="form-grid__full">
              <Input
                label="Địa chỉ" icon={MapPin} value={bieuMau.address} maxLength={255}
                onChange={suKien => doiTruong('address', suKien.target.value)}
              />
            </div>
          </div>
          <div className="form-actions">
            {loi && <p className="form-error" role="alert">{loi}</p>}
            <Button type="submit" disabled={dangDocAnh || !coThayDoi || !hopLe}>Lưu thay đổi</Button>
          </div>
        </form>
      </div>

      <section className="card">
        <div className="card__head"><h3>Bảo mật tài khoản</h3></div>
        <ul className="sec-list">
          <li>
            <span className="sec__icon"><KeyRound size={16} /></span>
            <div>
              <strong>Mật khẩu</strong>
              <small>Xem trước biểu mẫu; bản mẫu không lưu hoặc thay đổi mật khẩu</small>
            </div>
            <button type="button" className="pill-btn" onClick={moDoiMatKhau}>
              <KeyRound size={13} />Đổi mật khẩu
            </button>
          </li>
          <li>
            <span className="sec__icon"><MonitorSmartphone size={16} /></span>
            <div>
              <strong>Chế độ xem trước</strong>
              <small>Hồ sơ và ảnh mẫu được lưu trên trình duyệt này</small>
            </div>
            <span className="chip chip--info">Dữ liệu mẫu</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
