import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  KeyRound,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import {
  Btn as Nut,
  Card as The,
  CardHead as Dauthe,
  Chip as Nhan,
  PasswordField as Omatkhau,
  TextField as Onhap,
  TextAreaField as Onhapnhieudong,
} from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Hopthoai } from './DungChung';
import { dinhdangngay } from './tienIch';
import './ca-nhan.css';

const cacloaianh = ['image/png', 'image/jpeg', 'image/webp'];
const dungluonganhtoida = 1024 * 1024;

function Anhdaidien({ ten, duongDan: duongdan }) {
  const chucaidau = ten?.trim().split(/\s+/).at(-1)?.charAt(0) || 'M';
  return (
    <span className="sp-profile-avatar">
      {duongdan ? <img src={duongdan} alt={`Ảnh đại diện ${ten}`} /> : chucaidau}
    </span>
  );
}

function Doimatkhaumau({ dong, thongBao: thongbao }) {
  const [matkhauhientai, datmatkhauhientai] = useState('');
  const [matkhaumoi, datmatkhaumoi] = useState('');
  const [xacnhanmatkhau, datxacnhanmatkhau] = useState('');
  const [loi, datloi] = useState('');

  function kiemtrabieumau(sukien) {
    sukien.preventDefault();
    datloi('');
    if (matkhaumoi.length < 8) {
      datloi('Mật khẩu mới cần có ít nhất 8 ký tự.');
    } else if (matkhaumoi === matkhauhientai) {
      datloi('Mật khẩu mới cần khác mật khẩu hiện tại.');
    } else if (matkhaumoi !== xacnhanmatkhau) {
      datloi('Xác nhận mật khẩu chưa trùng khớp.');
    } else {
      thongbao('Biểu mẫu hợp lệ. Mật khẩu không được lưu hoặc thay đổi trong bản mẫu.');
      dong();
    }
  }

  return (
    <Hopthoai
      title="Đổi mật khẩu"
      subtitle="Xem trước biểu mẫu bảo mật tài khoản"
      size="sm"
      onClose={dong}
    >
      <form onSubmit={kiemtrabieumau}>
        <div className="sp-dialog-body sp-stack">
          <p className="sp-note">
            Đây là biểu mẫu minh họa: không xác thực mật khẩu hiện tại, không lưu và không thay đổi
            mật khẩu đăng nhập.
          </p>
          <Omatkhau
            label="Mật khẩu hiện tại"
            value={matkhauhientai}
            required
            autoComplete="off"
            onChange={(sukien) => datmatkhauhientai(sukien.target.value)}
          />
          <Omatkhau
            label="Mật khẩu mới"
            value={matkhaumoi}
            required
            autoComplete="off"
            maxLength={100}
            onChange={(sukien) => datmatkhaumoi(sukien.target.value)}
          />
          <Omatkhau
            label="Xác nhận mật khẩu mới"
            value={xacnhanmatkhau}
            required
            autoComplete="off"
            maxLength={100}
            onChange={(sukien) => datxacnhanmatkhau(sukien.target.value)}
          />
          {loi && (
            <p className="sp-error" role="alert">
              {loi}
            </p>
          )}
        </div>
        <div className="sp-dialog-actions">
          <Nut variant="ghost" onClick={dong}>
            Hủy
          </Nut>
          <Nut type="submit">Kiểm tra biểu mẫu</Nut>
        </div>
      </form>
    </Hopthoai>
  );
}

function Bieumauhoso({ taiKhoan: taikhoan, luuHoSo: luuhoso, thongBao: thongbao }) {
  const [hoso, dathoso] = useState(() => ({ ...taikhoan }));
  const [loi, datloi] = useState('');
  const [dangdocanh, datdangdocanh] = useState(false);
  const [dangmomatkhau, datdangmomatkhau] = useState(false);
  const landocanh = useRef(0);

  useEffect(() => {
    dathoso({ ...taikhoan });
    datdangdocanh(false);
    datloi('');
    return () => {
      landocanh.current += 1;
    };
  }, [taikhoan.ten, taikhoan.email, taikhoan.dienThoai, taikhoan.diaChi, taikhoan.anhDaiDien]);

  function doitruong(tentruong, giatri) {
    dathoso((hosocu) => ({ ...hosocu, [tentruong]: giatri }));
    datloi('');
  }

  function chonanh(sukien) {
    const tep = sukien.target.files?.[0];
    sukien.target.value = '';
    if (!tep) return;
    const malandoc = ++landocanh.current;
    datdangdocanh(false);
    if (!cacloaianh.includes(tep.type)) {
      datloi('Vui lòng chọn ảnh PNG, JPEG hoặc WebP.');
      return;
    }
    if (tep.size >= dungluonganhtoida) {
      datloi('Ảnh đại diện cần nhỏ hơn 1 MB.');
      return;
    }
    datdangdocanh(true);
    datloi('');
    const bodoc = new FileReader();
    bodoc.onerror = () => {
      if (malandoc !== landocanh.current) return;
      datdangdocanh(false);
      datloi('Không đọc được ảnh. Vui lòng chọn lại.');
    };
    bodoc.onload = () => {
      const anh = new Image();
      anh.onload = () => {
        if (malandoc !== landocanh.current) return;
        doitruong('anhDaiDien', bodoc.result);
        datdangdocanh(false);
      };
      anh.onerror = () => {
        if (malandoc !== landocanh.current) return;
        datdangdocanh(false);
        datloi('Tệp này không phải ảnh hợp lệ. Vui lòng chọn ảnh khác.');
      };
      anh.src = String(bodoc.result);
    };
    bodoc.readAsDataURL(tep);
  }

  function xoaanh() {
    landocanh.current += 1;
    datdangdocanh(false);
    doitruong('anhDaiDien', '');
  }

  function luubieumau(sukien) {
    sukien.preventDefault();
    datloi('');
    if (dangdocanh) return;
    if (hoso.ten.trim().length < 2) {
      datloi('Họ và tên cần có ít nhất 2 ký tự.');
      return;
    }
    if (!/^(0\d{9}|\+84\d{9})$/.test(hoso.dienThoai.trim())) {
      datloi('Vui lòng nhập số điện thoại gồm 10 chữ số hoặc bắt đầu bằng +84.');
      return;
    }
    try {
      const noidung = {
        ...hoso,
        ten: hoso.ten.trim(),
        email: hoso.email.trim(),
        dienThoai: hoso.dienThoai.trim().replace(/^\+84/, '0'),
        diaChi: hoso.diaChi.trim(),
      };
      luuhoso(noidung);
      dathoso(noidung);
      thongbao('Đã lưu hồ sơ mẫu trên trình duyệt.');
    } catch (loiluu) {
      datloi(loiluu.message || 'Chưa lưu được hồ sơ. Vui lòng thử lại.');
    }
  }

  return (
    <>
      <div className="sp-profile-layout">
        <aside className="sp-stack">
          <The className="sp-profile-summary">
            <Anhdaidien ten={hoso.ten} duongDan={hoso.anhDaiDien} />
            <h2>{hoso.ten || 'Hồ sơ phụ huynh'}</h2>
            <p>{taikhoan.email}</p>
            <Nhan tone="blue" icon={Users}>
              Học viên / Phụ huynh
            </Nhan>
            <div className="sp-profile-upload">
              <label className="sp-upload-photo">
                <Camera size={15} />
                <span>{dangdocanh ? 'Đang đọc ảnh…' : 'Chọn ảnh đại diện'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Chọn ảnh đại diện"
                  onChange={chonanh}
                />
              </label>
              {hoso.anhDaiDien && (
                <Nut variant="ghost" size="sm" icon={Trash2} onClick={xoaanh}>
                  Xóa ảnh
                </Nut>
              )}
            </div>
            <small>
              PNG, JPEG hoặc WebP · nhỏ hơn 1 MB.
              <br />
              Ảnh được lưu cùng thay đổi hồ sơ.
            </small>
          </The>
          <The className="sp-profile-security">
            <ShieldCheck size={22} />
            <h3>Bảo mật tài khoản</h3>
            <p>Thử biểu mẫu đổi mật khẩu trong giao diện mẫu.</p>
            <Nut variant="soft" icon={KeyRound} onClick={() => datdangmomatkhau(true)}>
              Đổi mật khẩu
            </Nut>
          </The>
        </aside>

        <The>
          <Dauthe
            title="Thông tin tài khoản"
            sub="Quản lý thông tin liên hệ của học viên và phụ huynh"
          />
          <form onSubmit={luubieumau} className="sp-stack">
            <div className="sp-form-grid">
              <Onhap
                label="Họ và tên"
                icon={User}
                required
                value={hoso.ten}
                maxLength={100}
                autoComplete="name"
                onChange={(sukien) => doitruong('ten', sukien.target.value)}
              />
              <Onhap
                label="Email"
                icon={Mail}
                type="email"
                required
                value={hoso.email}
                maxLength={255}
                autoComplete="email"
                onChange={(sukien) => doitruong('email', sukien.target.value)}
              />
              <Onhap
                label="Số điện thoại"
                type="tel"
                required
                value={hoso.dienThoai}
                maxLength={15}
                autoComplete="tel"
                onChange={(sukien) => doitruong('dienThoai', sukien.target.value)}
              />
              <Onhap label="Vai trò" value="Học viên / Phụ huynh" readOnly />
            </div>
            <Onhapnhieudong
              label="Địa chỉ liên hệ"
              value={hoso.diaChi}
              maxLength={255}
              rows={3}
              autoComplete="street-address"
              onChange={(sukien) => doitruong('diaChi', sukien.target.value)}
            />
            <p className="sp-note sp-profile-local">
              <CheckCircle2 size={17} />
              <span>Hồ sơ này dùng dữ liệu mẫu và chỉ được lưu trên trình duyệt hiện tại.</span>
            </p>
            {loi && (
              <p className="sp-error" role="alert">
                {loi}
              </p>
            )}
            <div className="sp-profile-actions">
              <Nut
                variant="ghost"
                onClick={() => {
                  landocanh.current += 1;
                  datdangdocanh(false);
                  dathoso({ ...taikhoan });
                  datloi('');
                }}
              >
                Hủy thay đổi
              </Nut>
              <Nut type="submit" icon={Save} disabled={dangdocanh}>
                Lưu thay đổi
              </Nut>
            </div>
          </form>
        </The>
      </div>
      {dangmomatkhau && <Doimatkhaumau dong={() => datdangmomatkhau(false)} thongBao={thongbao} />}
    </>
  );
}

export default function Thongtincanhan() {
  const {
    duLieu: dulieu,
    hocVien: hocvien,
    luuHoSo: luuhoso,
    thongBao: thongbao,
  } = useHocvienphuhuynh();
  return (
    <div className="sp-page sp-profile">
      <Bieumauhoso
        key={dulieu.taiKhoan.ma}
        taiKhoan={dulieu.taiKhoan}
        luuHoSo={luuhoso}
        thongBao={thongbao}
      />
      <The>
        <Dauthe
          title="Học viên liên kết"
          sub="Tài khoản gia đình dùng chung để theo dõi quá trình học tập"
        />
        <div className="sp-profile-children">
          {dulieu.hocVien.map((thongtin) => (
            <article
              key={thongtin.ma}
              className={
                thongtin.ma === hocvien.ma ? 'sp-profile-child is-selected' : 'sp-profile-child'
              }
            >
              <span className="sp-profile-child__initial">
                {thongtin.ten.trim().split(/\s+/).at(-1)?.charAt(0)}
              </span>
              <div>
                <strong>{thongtin.ten}</strong>
                <span>{thongtin.maSo}</span>
                <small>
                  {thongtin.gioiTinh} · {dinhdangngay(thongtin.ngaySinh)}
                </small>
              </div>
              {thongtin.ma === hocvien.ma && <Nhan tone="green">Đang xem</Nhan>}
            </article>
          ))}
        </div>
      </The>
    </div>
  );
}
