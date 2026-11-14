import { Link } from 'react-router-dom';
import {
  Award,
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  CreditCard,
  MessageSquare,
  Star,
} from 'lucide-react';
import { Btn as Nut, Card as The, Chip as Nhan, StatCard as Thethongke } from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Tieudekhoi, Trangtrong } from './DungChung';
import {
  dautuan,
  congngay,
  dinhdangngay,
  dinhdangtien,
  ngayhomnay,
  nhanthu,
  tenkhoahoc,
} from './tienIch';

export default function Trangchu() {
  const {
    duLieu: dulieu,
    hocVien: hocvien,
    cacHoaDon: cachoadon,
    cacThongBao: cacthongbao,
  } = useHocvienphuhuynh();
  const homnay = ngayhomnay();
  const thoidiemhientai = Date.now();
  const tuannay = dautuan();
  const cacbuoihoc = dulieu.lichHoc
    .filter((buoi) => buoi.maHocVien === hocvien.ma && buoi.trangThai !== 'daHuy')
    .sort((truoc, sau) => `${truoc.ngay}${truoc.batDau}`.localeCompare(`${sau.ngay}${sau.batDau}`));
  const buoisaptoi = cacbuoihoc.find(
    (buoi) => new Date(`${buoi.ngay}T${buoi.ketThuc}:00+07:00`).getTime() >= thoidiemhientai
  );
  const cacbuoitrongtuan = cacbuoihoc.filter(
    (buoi) => buoi.ngay >= tuannay && buoi.ngay <= congngay(tuannay, 6)
  );
  const cacketqua = dulieu.ketQua
    .filter((ketqua) => ketqua.maHocVien === hocvien.ma)
    .sort((truoc, sau) => sau.ngay.localeCompare(truoc.ngay));
  const cacdiemdanh = dulieu.diemDanh.filter(
    (buoi) => buoi.maHocVien === hocvien.ma && buoi.ngay.startsWith(homnay.slice(0, 7))
  );
  const socomat = cacdiemdanh.filter((buoi) => ['coMat', 'diTre'].includes(buoi.trangThai)).length;
  const tyle = cacdiemdanh.length ? Math.round((socomat / cacdiemdanh.length) * 100) : null;
  const cackhoancandong = cachoadon.filter((hoadon) => hoadon.trangThai !== 'daThanhToan');
  const tongcandong = cackhoancandong.reduce((tong, hoadon) => tong + hoadon.soTien, 0);
  const hoadongannhat = cackhoancandong[0];
  return (
    <div className="sp-page sp-home">
      <div className="sp-stat-grid">
        <Thethongke
          icon={CalendarDays}
          label="Buổi học sắp tới"
          value={
            buoisaptoi
              ? `${buoisaptoi.ngay === homnay ? 'Hôm nay' : dinhdangngay(buoisaptoi.ngay, { year: undefined })} ${buoisaptoi.batDau}`
              : 'Chưa có lịch'
          }
          accent="brand"
        />
        <Thethongke
          icon={CreditCard}
          label="Học phí cần thanh toán"
          value={
            tongcandong ? `${(tongcandong / 1000000).toLocaleString('vi-VN')}tr` : 'Đã hoàn tất'
          }
          accent="amber"
          tone="blue"
          badge={
            hoadongannhat && (
              <Nhan tone="amber">
                Hạn {dinhdangngay(hoadongannhat.hanThanhToan, { year: undefined })}
              </Nhan>
            )
          }
        />
        <Thethongke
          icon={Award}
          label="Kết quả gần nhất"
          value={cacketqua.length ? `${cacketqua[0].diemTong.toFixed(1)}/10` : 'Chưa có điểm'}
          accent="blue"
          tone="blue"
          delta={
            cacketqua.length > 1
              ? `+${(cacketqua[0].diemTong - cacketqua[1].diemTong).toFixed(1)}`
              : undefined
          }
        />
        <Thethongke
          icon={CheckCheck}
          label="Điểm danh tháng này"
          value={tyle === null ? 'Chưa có dữ liệu' : `${tyle}%`}
          accent="green"
          tone="green"
          badge={
            tyle !== null && (
              <Nhan tone="green">
                {socomat}/{cacdiemdanh.length} buổi
              </Nhan>
            )
          }
        />
      </div>
      <div className="sp-welcome-feedback">
        <div>
          <MessageSquare size={23} />
          <div>
            <h2>Buổi học vừa qua của {hocvien.ten.split(' ').slice(-2).join(' ')} thế nào?</h2>
            <p>Đánh giá giảng viên và chất lượng lớp học giúp trung tâm cải thiện tốt hơn.</p>
          </div>
        </div>
        <Nut to="/student/danhgia" variant="soft">
          <span className="sp-stars-preview">
            {[1, 2, 3, 4, 5].map((diem) => (
              <Star key={diem} size={16} />
            ))}
          </span>
          Đánh giá lớp học
        </Nut>
      </div>
      <div className="sp-split">
        <The>
          <Tieudekhoi
            tieuDe="Lịch học tuần này"
            moTa={`${dinhdangngay(tuannay)} – ${dinhdangngay(congngay(tuannay, 6))}`}
          >
            <Nut size="xs" variant="ghost" to="/student/lichhoc">
              Xem lịch học <ChevronRight size={13} />
            </Nut>
          </Tieudekhoi>
          <div className="sp-home-schedule">
            {cacbuoitrongtuan.length ? (
              cacbuoitrongtuan.map((buoi) => (
                <div className="sp-home-session" key={buoi.ma}>
                  <span className="sp-home-day">
                    <strong>{nhanthu(buoi.ngay)}</strong>
                    <small>
                      {buoi.ngay.slice(8)}/{buoi.ngay.slice(5, 7)}
                    </small>
                  </span>
                  <div>
                    <h3>{tenkhoahoc(dulieu, buoi.maKhoa)}</h3>
                    <p>
                      {buoi.batDau} – {buoi.ketThuc} · {buoi.phong} · {buoi.giangVien}
                    </p>
                    <Nhan tone={buoi.trangThai === 'daHoc' ? 'green' : 'blue'}>
                      {buoi.trangThai === 'daHoc' ? 'Đã học' : 'Sắp học'}
                    </Nhan>
                  </div>
                </div>
              ))
            ) : (
              <Trangtrong
                tieuDe="Tuần này chưa có lịch học"
                moTa="Các buổi học mới sẽ hiển thị khi lịch được cập nhật."
              />
            )}
          </div>
        </The>
        <The>
          <Tieudekhoi tieuDe="Học phí & Hóa đơn" />
          {hoadongannhat ? (
            <div className="sp-home-invoice">
              <small>{hoadongannhat.tieuDe}</small>
              <strong className="sp-home-amount">{dinhdangtien(hoadongannhat.soTien)}</strong>
              <p>Hạn thanh toán: {dinhdangngay(hoadongannhat.hanThanhToan)}</p>
              <Nut to={`/student/hocphi?thanhToan=${hoadongannhat.ma}`} icon={CreditCard}>
                Thanh toán ngay
              </Nut>
            </div>
          ) : (
            <div className="sp-home-invoice">
              <strong className="sp-home-amount">Đã hoàn tất</strong>
              <p>Hiện không có học phí cần thanh toán.</p>
              <Nut to="/student/hocphi" variant="soft">
                Xem hóa đơn
              </Nut>
            </div>
          )}
          {cachoadon
            .filter((hoadon) => hoadon.trangThai === 'daThanhToan')
            .slice(0, 2)
            .map((hoadon) => (
              <Link className="sp-home-paid" key={hoadon.ma} to={`/student/hocphi/${hoadon.ma}`}>
                <span>{hoadon.tieuDe.replace('Học phí ', '')}</span>
                <Nhan tone="green">Đã thanh toán</Nhan>
              </Link>
            ))}
        </The>
      </div>
      <div className="sp-split">
        <The>
          <Tieudekhoi tieuDe="Kết quả & nhận xét gần đây">
            <Nut variant="ghost" size="xs" to="/student/ketqua">
              Xem tất cả <ChevronRight size={13} />
            </Nut>
          </Tieudekhoi>
          {cacketqua.slice(0, 2).map((ketqua) => (
            <Link className="sp-home-result" key={ketqua.ma} to={`/student/ketqua/${ketqua.ma}`}>
              <div>
                <strong>
                  {ketqua.tieuDe} — {tenkhoahoc(dulieu, ketqua.maKhoa)}
                </strong>
                <b>{ketqua.diemTong.toFixed(1)} / 10</b>
              </div>
              <p>“{ketqua.nhanXet}”</p>
            </Link>
          ))}
          {!cacketqua.length && (
            <Trangtrong
              tieuDe="Chưa có kết quả công bố"
              moTa="Điểm và nhận xét của giảng viên sẽ hiển thị tại đây."
            />
          )}
        </The>
        <The>
          <Tieudekhoi tieuDe="Thông báo mới">
            <Nut variant="ghost" size="xs" to="/student/thongbao">
              Xem tất cả
            </Nut>
          </Tieudekhoi>
          {cacthongbao.slice(0, 3).map((thongbao) => (
            <Link
              className="sp-home-notice"
              key={thongbao.ma}
              to={`/student/thongbao/${thongbao.ma}`}
            >
              <span>
                <Bell size={14} />
              </span>
              <div>
                <strong>{thongbao.tieuDe}</strong>
                <small>
                  {dinhdangngay(thongbao.ngayGui)}
                  {!thongbao.daDoc && ' · Chưa đọc'}
                </small>
              </div>
            </Link>
          ))}
        </The>
      </div>
    </div>
  );
}
