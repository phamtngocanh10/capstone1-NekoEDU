import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock3,
  GraduationCap,
  MapPin,
  PlayCircle,
  Users,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import {
  BackLink as Nutquaylai,
  Btn as Nut,
  Card as The,
  Chip as Nhan,
  InfoGrid as Luoithongtin,
  Progress as Tientrinh,
} from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Nhantrangthai, Tieudekhoi, Trangtrong } from './DungChung';
import { dinhdangngay, dinhdangtien } from './tienIch';
import { lichtrongtuan } from './KhoaHocCuaToi';
import './hoc-tap.css';

const cactrangthai = {
  hoanThanh: { nhan: 'Hoàn thành', mau: 'green', bieuTuong: CheckCircle2 },
  dangHoc: { nhan: 'Đang học', mau: 'blue', bieuTuong: PlayCircle },
  sapToi: { nhan: 'Sắp tới', mau: 'gray', bieuTuong: CircleDashed },
};

export default function Chitietkhoahoc() {
  const { maKhoa: makhoa } = useParams();
  const {
    duLieu: dulieu,
    hocVien: hocvien,
    cacKhoaDangHoc: cackhoadanghoc,
    cacHoaDon: cachoadon,
  } = useHocvienphuhuynh();
  const khoahoc = cackhoadanghoc.find((khoa) => khoa.ma === makhoa);

  if (!khoahoc)
    return (
      <div className="sp-page">
        <Nutquaylai to="/student/khoahoc">Khóa học của tôi</Nutquaylai>
        <Trangtrong
          tieuDe="Không tìm thấy khóa học đang theo học"
          moTa={`Khóa học này không thuộc danh sách đang học của ${hocvien.ten}.`}
        >
          <Nut to="/student/khoahoc" variant="soft">
            Xem khóa học của tôi
          </Nut>
        </Trangtrong>
      </div>
    );

  const sobuoidahoc = dulieu.lichHoc.filter(
    (buoi) => buoi.maHocVien === hocvien.ma && buoi.maKhoa === makhoa && buoi.trangThai === 'daHoc'
  ).length;
  const hoadon = cachoadon
    .filter((hoadonmau) => hoadonmau.maKhoa === makhoa)
    .sort((truoc, sau) => sau.hanThanhToan.localeCompare(truoc.hanThanhToan))[0];

  return (
    <div className="sp-page sp-study-page">
      <Nutquaylai to="/student/khoahoc">Khóa học của tôi</Nutquaylai>
      <The className="sp-stack">
        <div className="sp-study-title-row">
          <div>
            <h2>{khoahoc.ten}</h2>
            <p className="sp-muted">
              Thông tin chương trình, lịch học và tiến độ của {hocvien.ten}
            </p>
          </div>
          <Nhantrangthai trangThai="dangHoc" />
        </div>
        <p className="sp-study-meta">
          <GraduationCap size={16} />
          {khoahoc.giangVien}
          <MapPin size={16} />
          {khoahoc.phong}
          <Clock3 size={16} />
          {khoahoc.gioBatDau} – {khoahoc.gioKetThuc}
        </p>
        <div className="sp-course-progress">
          <span>
            Tiến độ khóa học: Tuần {khoahoc.tuanHienTai}/{khoahoc.tongSoTuan} · Đã học {sobuoidahoc}{' '}
            buổi trong lịch mẫu
          </span>
          <Tientrinh
            value={khoahoc.tuanHienTai}
            max={khoahoc.tongSoTuan}
            label="Tiến độ khóa học"
            large
          />
        </div>
        <Luoithongtin
          cols={3}
          items={[
            { label: 'Giảng viên', value: khoahoc.giangVien },
            { label: 'Phòng học', value: khoahoc.phong },
            { label: 'Sĩ số lớp', value: `${khoahoc.siSo} / ${khoahoc.sucChua} học viên` },
            {
              label: 'Lịch học',
              value: `${lichtrongtuan(khoahoc)} · ${khoahoc.gioBatDau} – ${khoahoc.gioKetThuc}`,
            },
            { label: 'Ngày khai giảng', value: dinhdangngay(khoahoc.ngayKhaiGiang) },
            {
              label: 'Học phí',
              value: hoadon ? (
                <span>
                  {dinhdangtien(hoadon.soTien)} ·{' '}
                  {hoadon.trangThai === 'daThanhToan' ? 'Đã đóng' : 'Chưa thanh toán'}
                </span>
              ) : (
                dinhdangtien(khoahoc.hocPhi)
              ),
            },
          ]}
        />
      </The>

      <The className="sp-stack">
        <Tieudekhoi tieuDe="Nội dung chương trình" moTa={khoahoc.mucTieu} />
        <div className="sp-course-units">
          {khoahoc.chuongTrinh.map((donvi) => {
            const trangthai = cactrangthai[donvi.trangThai] ?? cactrangthai.sapToi;
            const Bieutuong = trangthai.bieuTuong;
            return (
              <div className="sp-course-unit" key={donvi.donVi}>
                <span className={`sp-unit-icon sp-unit-icon--${donvi.trangThai}`}>
                  <Bieutuong size={19} />
                </span>
                <strong>{donvi.donVi}</strong>
                <p>{donvi.ten}</p>
                <Nhan tone={trangthai.mau}>{trangthai.nhan}</Nhan>
              </div>
            );
          })}
        </div>
      </The>
      <div className="sp-study-quicklinks">
        <Nut to={`/student/lichhoc?khoa=${khoahoc.ma}`} variant="soft" icon={CalendarDays}>
          Xem lịch học
        </Nut>
        <Nut to={`/student/tailieu?khoa=${khoahoc.ma}`} variant="soft" icon={BookOpen}>
          Tài liệu khóa học
        </Nut>
        <Nut to="/student/ketqua" variant="ghost" icon={Users}>
          Điểm danh & kết quả
        </Nut>
      </div>
    </div>
  );
}
