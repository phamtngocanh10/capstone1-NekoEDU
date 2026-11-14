import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, CalendarDays, Check, CheckCheck,
  ClipboardCheck, LockKeyhole, MapPin, ShieldCheck, Users,
} from 'lucide-react';
import { Btn, Card, CardHead, Chip, StatCard } from '../../../common/ui';
import { duLieuTroGiang } from '../duLieuTroGiang';
import { useTroGiang } from '../layout/NguCanhTroGiang';
import {
  coQuyen, congNgay, dinhDangNgay, ngayHomNay,
  thuHaiDauTuan, TrangThaiTaiDuLieu, TrangThaiTrong, useTaiDuLieu,
} from './DungChung';
import { dinhDangThu, duongDanDiemDanh, layGioBuoiHoc } from './hienThiLich';

function NutDiemDanh({ buoiHoc }) {
  if (buoiHoc.status === 'attended') {
    return <Chip tone="green" icon={CheckCheck}>Đã điểm danh</Chip>;
  }
  if (!coQuyen(buoiHoc, 'attendance')) return <Chip>Chỉ xem</Chip>;

  return (
    <Btn to={duongDanDiemDanh(buoiHoc)} size="sm" variant="soft">
      Điểm danh <ArrowRight size={12} />
    </Btn>
  );
}

function BuoiHoTro({ buoiHoc }) {
  const gioHoc = layGioBuoiHoc(buoiHoc);

  return (
    <div className="ta-session-row">
      <div className="ta-session-time">
        <strong>{gioHoc.batDau}</strong><small>{gioHoc.ketThuc}</small>
      </div>
      <div className="ta-session-details">
        <Link to={`/assistant/lophoc/${buoiHoc.classId}`}>{buoiHoc.name}</Link>
        <p>Hỗ trợ {buoiHoc.teacher || 'giảng viên phụ trách'}</p>
        <div className="ta-meta">
          <span><MapPin size={12} />{buoiHoc.room || 'Chưa xếp phòng'}</span>
          <span><Users size={12} />{buoiHoc.students ?? 0} học viên</span>
        </div>
      </div>
      <NutDiemDanh buoiHoc={buoiHoc} />
    </div>
  );
}

function LichHoTroHomNay({ duLieuLich, cacBuoiHoc }) {
  if (duLieuLich.dangTai) {
    return <div className="ta-inline-status" role="status">Đang tải lịch hỗ trợ…</div>;
  }
  if (duLieuLich.loi) {
    return <TrangThaiTaiDuLieu loi={duLieuLich.loi} thuLai={duLieuLich.taiLai} />;
  }
  if (!cacBuoiHoc.length) {
    return (
      <TrangThaiTrong
        bieuTuong={CalendarDays}
        tieuDe="Hôm nay bạn không có lịch hỗ trợ"
        moTa="Bạn có thể xem các buổi học được phân công trong lịch tuần."
      >
        <Btn to="/assistant/lichhotro" variant="soft" icon={CalendarDays}>Xem lịch hỗ trợ</Btn>
      </TrangThaiTrong>
    );
  }

  return (
    <div className="ta-session-list">
      {cacBuoiHoc.map(buoiHoc => <BuoiHoTro key={buoiHoc.id} buoiHoc={buoiHoc} />)}
    </div>
  );
}

function QuyenTruyCap({ soQuyenNhapDiem }) {
  const cacQuyen = [
    { noiDung: 'Xem lịch hỗ trợ và lớp được phân công' },
    { noiDung: 'Xem danh sách học viên theo phân công' },
    { noiDung: 'Hỗ trợ điểm danh khi được cấp quyền' },
    {
      noiDung: soQuyenNhapDiem
        ? `${soQuyenNhapDiem} quyền nhập điểm đang mở`
        : 'Nhập điểm khi giảng viên mở quyền',
      biGioiHan: !soQuyenNhapDiem,
    },
  ];

  return (
    <Card>
      <CardHead title="Quyền truy cập của bạn">
        <span className="ta-section-icon"><ShieldCheck size={17} /></span>
      </CardHead>
      <ul className="ta-permission-list">
        {cacQuyen.map(quyen => (
          <li key={quyen.noiDung} className={quyen.biGioiHan ? 'is-limited' : ''}>
            {quyen.biGioiHan ? <LockKeyhole size={14} /> : <Check size={15} />}
            <span>{quyen.noiDung}</span>
          </li>
        ))}
      </ul>
      <Link className="ta-card-link" to="/assistant/chamdiem">
        Xem quyền nhập điểm <ArrowRight size={13} />
      </Link>
    </Card>
  );
}

function CacLopDangHoTro({ danhSachLop }) {
  return (
    <Card>
      <CardHead title="Lớp được phân công" action="Xem tất cả" to="/assistant/lophoc" />
      {danhSachLop.length ? (
        <div className="ta-assigned-list">
          {danhSachLop.slice(0, 4).map(lopHoc => (
            <Link key={lopHoc.id} to={`/assistant/lophoc/${lopHoc.id}`}>
              <span className="ta-assigned-icon"><BookOpen size={16} /></span>
              <span>
                <strong>{lopHoc.name}</strong>
                <small>
                  {lopHoc.teacher || 'Chưa có giảng viên'}
                  {lopHoc.days?.length ? ` · ${dinhDangThu(lopHoc.days)}` : ''}
                </small>
              </span>
              <ArrowRight size={13} />
            </Link>
          ))}
        </div>
      ) : (
        <p className="ta-muted-note">
          Bạn chưa được phân công lớp. Trung tâm sẽ cập nhật lịch hỗ trợ tại đây.
        </p>
      )}
    </Card>
  );
}

export default function TongQuanTroGiang() {
  const { duLieu, dangTai, loiTai, taiLaiDuLieu } = useTroGiang();
  const homNay = ngayHomNay();
  const dauTuan = thuHaiDauTuan(homNay);
  const duLieuLich = useTaiDuLieu(
    () => duLieuTroGiang.layLichHoTro(dauTuan, congNgay(dauTuan, 6)),
    [dauTuan],
  );
  const cacBuoiHoc = duLieuLich.duLieu ?? [];
  const buoiHocHomNay = cacBuoiHoc.filter(buoiHoc => (
    buoiHoc.iso === homNay && buoiHoc.status !== 'cancelled'
  ));
  const buoiHocDaDienRa = cacBuoiHoc.filter(buoiHoc => (
    buoiHoc.iso <= homNay && buoiHoc.status !== 'cancelled'
  ));
  const soBuoiDaDiemDanh = buoiHocDaDienRa.filter(buoiHoc => buoiHoc.status === 'attended').length;
  const tiLeDiemDanh = buoiHocDaDienRa.length
    ? Math.round(soBuoiDaDiemDanh * 100 / buoiHocDaDienRa.length)
    : null;
  const soLopHomNay = new Set(buoiHocHomNay.map(buoiHoc => buoiHoc.classId)).size;
  const soHocVien = duLieu.classes.reduce((tong, lopHoc) => tong + Number(lopHoc.size || 0), 0);
  const soQuyenNhapDiem = duLieu.grants.filter(quyen => quyen.state === 'open').length;

  if (dangTai && !duLieu.classes.length) return <TrangThaiTaiDuLieu />;
  if (loiTai) return <TrangThaiTaiDuLieu loi={loiTai} thuLai={taiLaiDuLieu} />;

  return (
    <div className="u-page ta-overview">
      <div className="ta-day-label">
        <span className="ta-day-label__dot" /><CalendarDays size={14} />
        {dinhDangNgay(homNay, { weekday: 'long' })}
      </div>
      <div className="ta-overview-stats">
        <StatCard icon={BookOpen} label="Lớp hỗ trợ hôm nay" value={`${soLopHomNay} lớp`} accent="brand" tone="brand" />
        <StatCard icon={Users} label="Học viên trong các lớp" value={soHocVien} accent="blue" tone="blue" />
        <StatCard
          icon={ClipboardCheck}
          label="Điểm danh tuần này"
          value={`${soBuoiDaDiemDanh}/${buoiHocDaDienRa.length}`}
          accent="green"
          tone="green"
          badge={tiLeDiemDanh !== null
            ? <Chip tone="green">{tiLeDiemDanh}%</Chip>
            : <Chip>Chưa có buổi học</Chip>}
        />
      </div>
      <div className="ta-overview-columns">
        <Card className="ta-today-card">
          <CardHead
            title="Lịch hỗ trợ hôm nay"
            sub={`${soLopHomNay} lớp · ${dinhDangNgay(homNay)}`}
            action="Xem cả tuần"
            to="/assistant/lichhotro"
          />
          <LichHoTroHomNay duLieuLich={duLieuLich} cacBuoiHoc={buoiHocHomNay} />
        </Card>
        <div className="ta-overview-side">
          <QuyenTruyCap soQuyenNhapDiem={soQuyenNhapDiem} />
          <CacLopDangHoTro danhSachLop={duLieu.classes} />
        </div>
      </div>
    </div>
  );
}
