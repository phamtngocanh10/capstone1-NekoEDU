import { useEffect, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  MapPin,
  Users,
} from 'lucide-react';
import {
  Btn as Nut,
  Card as The,
  CheckRow as Odongy,
  Chip as Nhan,
  InfoGrid as Luoithongtin,
  Progress as Tientrinh,
  RadioChips as Nhomluachon,
  SearchBox as Otimkiem,
  SelectField as Ochon,
} from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Hopthoai, Nhantrangthai, Tieudekhoi, Trangtrong } from './DungChung';
import { dinhdangngay, dinhdangtien, loctheotukhoa } from './tienIch';
import './hoc-tap.css';

const cacphuongthuc = [
  { value: 'chuyenKhoan', label: 'Chuyển khoản ngân hàng' },
  { value: 'viDienTu', label: 'Ví MoMo / ZaloPay' },
  { value: 'tienMat', label: 'Tiền mặt tại quầy' },
];

export const lichtrongtuan = (khoahoc) =>
  khoahoc.thuHoc.map((thu) => (thu === 0 ? 'CN' : `T${thu + 1}`)).join(' · ');

function Xacnhandangky({ khoaHoc: khoahoc, dongHopThoai: donghopthoai }) {
  const {
    duLieu: dulieu,
    hocVien: hocvien,
    dangKyKhoaHoc: dangkykhoahoc,
    thongBao: thongbao,
  } = useHocvienphuhuynh();
  const [mahocvien, datmahocvien] = useState(hocvien.ma);
  const [phuongthuc, datphuongthuc] = useState('chuyenKhoan');
  const [dongy, datdongy] = useState(false);
  const [loi, datloi] = useState('');

  useEffect(() => {
    datmahocvien(hocvien.ma);
    datdongy(false);
    datloi('');
  }, [hocvien.ma, khoahoc.ma]);

  function guidangky(sukien) {
    sukien.preventDefault();
    if (!dongy) {
      datloi('Vui lòng đọc và đồng ý với chính sách học phí, quy định của trung tâm.');
      return;
    }
    try {
      dangkykhoahoc({ maKhoa: khoahoc.ma, maHocVien: mahocvien, phuongThuc: phuongthuc });
      thongbao(
        'Đã lưu đăng ký mẫu. Đăng ký đang chờ trung tâm xác nhận, chưa phát sinh thanh toán thật.'
      );
      donghopthoai();
    } catch (loidangky) {
      datloi(loidangky.message);
    }
  }

  return (
    <Hopthoai title="Xác nhận đăng ký" subtitle={khoahoc.moTa} onClose={donghopthoai}>
      <form onSubmit={guidangky}>
        <div className="sp-dialog-body sp-stack">
          <div className="sp-course-confirm">
            <span className="sp-study-icon">
              <GraduationCap size={25} />
            </span>
            <div>
              <h3>{khoahoc.ten}</h3>
              <p>
                {khoahoc.soBuoi} buổi · {lichtrongtuan(khoahoc)}
              </p>
            </div>
            <strong>{dinhdangtien(khoahoc.hocPhi)}</strong>
          </div>
          <Luoithongtin
            items={[
              { label: 'Khai giảng dự kiến', value: dinhdangngay(khoahoc.ngayKhaiGiang) },
              {
                label: 'Giờ học · Phòng',
                value: `${khoahoc.gioBatDau} – ${khoahoc.gioKetThuc} · ${khoahoc.phong}`,
              },
            ]}
          />
          <Ochon
            label="Học viên đăng ký"
            required
            value={mahocvien}
            onChange={(sukien) => {
              datmahocvien(sukien.target.value);
              datloi('');
            }}
            options={dulieu.hocVien.map((hocvienmau) => ({
              value: hocvienmau.ma,
              label: `${hocvienmau.ten} (${hocvienmau.maSo})`,
            }))}
          />
          <Nhomluachon
            label="Hình thức thanh toán"
            options={cacphuongthuc}
            value={phuongthuc}
            onChange={datphuongthuc}
            cols={1}
          />
          <details className="sp-study-policy">
            <summary>Chính sách học phí và quy định của trung tâm</summary>
            <p>
              Học phí áp dụng cho khóa được chọn. Trung tâm cần xác nhận đăng ký và chỗ học trước
              khi hướng dẫn thanh toán. Thay đổi lịch hoặc bảo lưu cần được trung tâm xác nhận.
            </p>
            <p>
              Đây là chính sách minh họa của giao diện mẫu; thao tác đăng ký không thu tiền, không
              gửi thông tin đến trung tâm.
            </p>
          </details>
          <Odongy checked={dongy} onChange={datdongy}>
            Tôi đồng ý với chính sách học phí và quy định của trung tâm.
          </Odongy>
          <p className="sp-note">
            Bản mẫu chỉ lưu yêu cầu trên trình duyệt. Hình thức thanh toán ở đây là lựa chọn dự
            kiến.
          </p>
          {loi && (
            <p className="sp-error" role="alert">
              {loi}
            </p>
          )}
        </div>
        <div className="sp-dialog-actions">
          <Nut variant="muted" onClick={donghopthoai}>
            Hủy
          </Nut>
          <Nut type="submit" icon={CheckCircle2}>
            Đăng ký
          </Nut>
        </div>
      </form>
    </Hopthoai>
  );
}

export default function Khoahoccuatoi() {
  const { duLieu: dulieu, hocVien: hocvien, cacKhoaDangHoc: cackhoadanghoc } = useHocvienphuhuynh();
  const [tukhoa, dattukhoa] = useState('');
  const [khoadangky, datkhoadangky] = useState(null);
  const cacghidanh = dulieu.ghiDanh.filter((ghidanh) => ghidanh.maHocVien === hocvien.ma);
  const cacmadadangky = new Set(
    cacghidanh
      .filter((ghidanh) => ['dangHoc', 'choXacNhan'].includes(ghidanh.trangThai))
      .map((ghidanh) => ghidanh.maKhoa)
  );
  const cackhoadexuat = loctheotukhoa(
    dulieu.khoaHoc.filter((khoa) => !cacmadadangky.has(khoa.ma)),
    tukhoa,
    (khoa) => `${khoa.ten} ${khoa.moTa}`
  );
  const cacdangkycho = cacghidanh.filter((ghidanh) => ghidanh.trangThai === 'choXacNhan');

  useEffect(() => {
    datkhoadangky(null);
    dattukhoa('');
  }, [hocvien.ma]);

  return (
    <div className="sp-page sp-study-page">
      <section className="sp-stack">
        <Tieudekhoi tieuDe="Đang theo học" moTa={`Khóa học hiện tại của ${hocvien.ten}`} />
        {cackhoadanghoc.length ? (
          cackhoadanghoc.map((khoahoc) => (
            <The key={khoahoc.ma} className="sp-enrolled-course">
              <span className="sp-study-icon">
                <BookOpen size={26} />
              </span>
              <div className="sp-enrolled-course__content">
                <div className="sp-study-title-row">
                  <h2>{khoahoc.ten}</h2>
                  <Nhantrangthai trangThai="dangHoc" />
                </div>
                <p className="sp-study-meta">
                  <GraduationCap size={14} />
                  {khoahoc.giangVien}
                  <MapPin size={14} />
                  {khoahoc.phong}
                </p>
                <p className="sp-study-meta">
                  <CalendarDays size={14} />
                  {lichtrongtuan(khoahoc)}
                  <Clock3 size={14} />
                  {khoahoc.gioBatDau} – {khoahoc.gioKetThuc}
                </p>
                <div className="sp-course-progress">
                  <span>
                    Tiến độ: Tuần {khoahoc.tuanHienTai}/{khoahoc.tongSoTuan}
                  </span>
                  <Tientrinh
                    value={khoahoc.tuanHienTai}
                    max={khoahoc.tongSoTuan}
                    label={`Tiến độ ${khoahoc.ten}`}
                  />
                </div>
              </div>
              <Nut to={`/student/khoahoc/${khoahoc.ma}`} variant="soft">
                Xem chi tiết
              </Nut>
            </The>
          ))
        ) : (
          <Trangtrong
            tieuDe="Chưa có khóa học đang theo học"
            moTa="Chọn một khóa phù hợp ở bên dưới để gửi đăng ký mẫu."
          />
        )}
      </section>

      {cacdangkycho.length > 0 && (
        <The className="sp-stack">
          <Tieudekhoi tieuDe="Đăng ký đang chờ xác nhận" />
          {cacdangkycho.map((ghidanh) => (
            <div className="sp-study-title-row" key={ghidanh.ma}>
              <div>
                <strong>
                  {dulieu.khoaHoc.find((khoa) => khoa.ma === ghidanh.maKhoa)?.ten ?? 'Khóa học'}
                </strong>
                <p className="sp-muted">
                  Đăng ký ngày {dinhdangngay(ghidanh.ngayDangKy)} · Dữ liệu mẫu
                </p>
              </div>
              <Nhantrangthai trangThai="choXacNhan" />
            </div>
          ))}
        </The>
      )}

      <section className="sp-stack">
        <Tieudekhoi
          tieuDe="Khóa học có thể đăng ký thêm"
          moTa="Tiếp tục hành trình chinh phục tiếng Anh"
        >
          <Otimkiem value={tukhoa} onChange={dattukhoa} placeholder="Tìm khóa học..." />
        </Tieudekhoi>
        {cackhoadexuat.length ? (
          <div className="sp-grid-3 sp-course-grid">
            {cackhoadexuat.map((khoahoc, chiso) => (
              <The key={khoahoc.ma} className={`sp-course-card sp-course-card--${chiso % 3}`}>
                <div className="sp-course-card__visual">
                  <GraduationCap size={36} />
                  <Nhan tone="blue">{khoahoc.nhom}</Nhan>
                </div>
                <div className="sp-course-card__body">
                  <h3>{khoahoc.ten}</h3>
                  <p>{khoahoc.moTa}</p>
                  <div className="sp-study-meta">
                    <CalendarDays size={14} />
                    {khoahoc.soBuoi} buổi
                    <Users size={14} />
                    {khoahoc.siSo}/{khoahoc.sucChua} học viên
                  </div>
                  <div className="sp-course-card__foot">
                    <strong>{dinhdangtien(khoahoc.hocPhi)}</strong>
                    <Nut size="sm" onClick={() => datkhoadangky(khoahoc)}>
                      Đăng ký
                    </Nut>
                  </div>
                </div>
              </The>
            ))}
          </div>
        ) : (
          <Trangtrong
            tieuDe="Không có khóa học phù hợp"
            moTa={
              tukhoa
                ? 'Thử tìm bằng từ khóa khác.'
                : 'Các đăng ký của học viên đã nằm trong danh sách đang học hoặc chờ xác nhận.'
            }
          />
        )}
      </section>
      {khoadangky && (
        <Xacnhandangky khoaHoc={khoadangky} dongHopThoai={() => datkhoadangky(null)} />
      )}
    </div>
  );
}
