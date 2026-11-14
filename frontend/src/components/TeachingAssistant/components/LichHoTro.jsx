import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Clock3 } from 'lucide-react';
import { Btn, Card, Chip, Dialog, InfoGrid } from '../../../common/ui';
import { duLieuTroGiang } from '../duLieuTroGiang';
import { useTroGiang } from '../layout/NguCanhTroGiang';
import {
  coQuyen, congNgay, dinhDangNgay, locTheoTuKhoa,
  ngayHomNay, thuHaiDauTuan, TrangThaiTaiDuLieu, useTaiDuLieu,
} from './DungChung';
import { duongDanDiemDanh, layGioBuoiHoc, TEN_THU } from './hienThiLich';

const CAC_TRANG_THAI = {
  attended: { nhan: 'Đã điểm danh', mau: 'green' },
  cancelled: { nhan: 'Đã hủy', mau: 'red' },
  upcoming: { nhan: 'Lịch hỗ trợ', mau: 'blue' },
};

function TheBuoiHoc({ buoiHoc, thuTu, chonBuoiHoc }) {
  const daHuy = buoiHoc.status === 'cancelled';
  const coTrangThai = buoiHoc.status === 'attended' || daHuy;
  const trangThai = CAC_TRANG_THAI[buoiHoc.status] ?? CAC_TRANG_THAI.upcoming;
  const gioHoc = layGioBuoiHoc(buoiHoc);
  const lopGiaoDien = [
    'ta-calendar-session',
    `ta-calendar-session--${thuTu % 3}`,
    daHuy && 'is-cancelled',
  ].filter(Boolean).join(' ');

  return (
    <button className={lopGiaoDien} onClick={() => chonBuoiHoc(buoiHoc)}>
      <span className="ta-calendar-session__time"><Clock3 size={12} />{gioHoc.batDau}</span>
      <strong>{buoiHoc.name}</strong>
      <span>{buoiHoc.room || 'Chưa xếp phòng'}</span>
      <small>{buoiHoc.teacher}</small>
      {coTrangThai && <span className="ta-calendar-session__status">{trangThai.nhan}</span>}
    </button>
  );
}

function NgayTrongTuan({ ngay, tenThu, cacBuoiHoc, chonBuoiHoc }) {
  const laHomNay = ngay === ngayHomNay();

  return (
    <div className={`ta-calendar-day ${laHomNay ? 'is-today' : ''}`}>
      <div className="ta-calendar-day__head">
        <span>{tenThu}</span>
        <strong>{dinhDangNgay(ngay, { year: undefined })}</strong>
        {laHomNay && <small>Hôm nay</small>}
      </div>
      <div className="ta-calendar-day__body">
        {cacBuoiHoc.length ? cacBuoiHoc.map((buoiHoc, thuTu) => (
          <TheBuoiHoc
            key={buoiHoc.id}
            buoiHoc={buoiHoc}
            thuTu={thuTu}
            chonBuoiHoc={chonBuoiHoc}
          />
        )) : (
          <span className="ta-calendar-empty" aria-label="Không có buổi hỗ trợ">—</span>
        )}
      </div>
    </div>
  );
}

function ChiTietBuoiHoc({ buoiHoc, dongChiTiet }) {
  const trangThai = CAC_TRANG_THAI[buoiHoc.status] ?? CAC_TRANG_THAI.upcoming;
  const duocDiemDanh = buoiHoc.status !== 'cancelled' && coQuyen(buoiHoc, 'attendance');
  const cacThongTin = [
    { label: 'Ngày học', value: dinhDangNgay(buoiHoc.iso, { weekday: 'long' }) },
    { label: 'Thời gian', value: buoiHoc.time },
    { label: 'Giảng viên', value: buoiHoc.teacher || 'Chưa phân công' },
    { label: 'Phòng học', value: buoiHoc.room || 'Chưa xếp phòng' },
    { label: 'Sĩ số', value: `${buoiHoc.students ?? 0} học viên` },
  ];

  return (
    <Dialog title={buoiHoc.name} subtitle="Chi tiết buổi hỗ trợ" onClose={dongChiTiet}>
      <div className="ta-dialog-content">
        <div className="ta-toolbar">
          <Chip tone={trangThai.mau}>{trangThai.nhan}</Chip>
          <span className="ta-muted-note">{buoiHoc.code}</span>
        </div>
        <InfoGrid items={cacThongTin} />
      </div>
      <div className="ta-dialog-actions">
        <Btn variant="ghost" onClick={dongChiTiet}>Đóng</Btn>
        <Btn variant="soft" to={`/assistant/lophoc/${buoiHoc.classId}`}>Danh sách lớp</Btn>
        {duocDiemDanh && (
          <Btn icon={ClipboardCheck} to={duongDanDiemDanh(buoiHoc)}>Điểm danh hỗ trợ</Btn>
        )}
      </div>
    </Dialog>
  );
}

function ChuGiaiLich() {
  return (
    <div className="ta-calendar-legend">
      <span><i />Lịch hỗ trợ</span>
      <span><i className="is-done" />Đã điểm danh</span>
      <span><i className="is-cancelled" />Đã hủy</span>
      <small>Bấm vào buổi học để xem chi tiết</small>
    </div>
  );
}

export default function LichHoTro() {
  const { tuKhoa } = useTroGiang();
  const [dauTuan, datDauTuan] = useState(() => thuHaiDauTuan());
  const [buoiDangChon, datBuoiDangChon] = useState(null);
  const cuoiTuan = congNgay(dauTuan, 6);
  const duLieuLich = useTaiDuLieu(
    () => duLieuTroGiang.layLichHoTro(dauTuan, cuoiTuan),
    [dauTuan],
  );
  const cacBuoiHoc = locTheoTuKhoa(
    duLieuLich.duLieu ?? [],
    tuKhoa,
    buoiHoc => `${buoiHoc.name} ${buoiHoc.code} ${buoiHoc.teacher}`,
  );
  const lichTheoNgay = new Map();
  for (const buoiHoc of cacBuoiHoc) {
    const lichTrongNgay = lichTheoNgay.get(buoiHoc.iso) ?? [];
    lichTrongNgay.push(buoiHoc);
    lichTheoNgay.set(buoiHoc.iso, lichTrongNgay);
  }

  function doiNgay(suKien) {
    if (suKien.target.value) datDauTuan(thuHaiDauTuan(suKien.target.value));
  }

  return (
    <div className="u-page ta-schedule">
      <div className="ta-week-toolbar">
        <div className="ta-week-navigation">
          <button className="ta-icon-button" aria-label="Tuần trước" onClick={() => datDauTuan(congNgay(dauTuan, -7))}>
            <ChevronLeft size={18} />
          </button>
          <h2>Tuần {dinhDangNgay(dauTuan, { year: undefined })} – {dinhDangNgay(cuoiTuan)}</h2>
          <button className="ta-icon-button" aria-label="Tuần sau" onClick={() => datDauTuan(congNgay(dauTuan, 7))}>
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="ta-toolbar">
          <label className="ta-date-picker">
            <CalendarDays size={15} />
            <input aria-label="Chọn ngày trong tuần" type="date" value={dauTuan} onChange={doiNgay} />
          </label>
          <Btn variant="soft" onClick={() => datDauTuan(thuHaiDauTuan())}>Tuần này</Btn>
        </div>
      </div>

      {duLieuLich.dangTai || duLieuLich.loi ? (
        <TrangThaiTaiDuLieu loi={duLieuLich.loi} thuLai={duLieuLich.taiLai} />
      ) : (
        <>
          <Card pad={false} className="ta-calendar-card">
            <div className="ta-calendar-scroll">
              <div className="ta-week-grid">
                {TEN_THU.map((tenThu, thuTu) => {
                  const ngay = congNgay(dauTuan, thuTu);
                  return (
                    <NgayTrongTuan
                      key={ngay}
                      ngay={ngay}
                      tenThu={tenThu}
                      cacBuoiHoc={lichTheoNgay.get(ngay) ?? []}
                      chonBuoiHoc={datBuoiDangChon}
                    />
                  );
                })}
              </div>
            </div>
          </Card>
          {!cacBuoiHoc.length && (
            <div className="ta-calendar-footnote">
              <CalendarDays size={15} />
              {tuKhoa
                ? 'Không có buổi học phù hợp với tìm kiếm trong tuần này.'
                : 'Tuần này chưa có buổi hỗ trợ được phân công. Bạn có thể chọn tuần khác để xem lịch.'}
            </div>
          )}
          <ChuGiaiLich />
        </>
      )}

      {buoiDangChon && (
        <ChiTietBuoiHoc buoiHoc={buoiDangChon} dongChiTiet={() => datBuoiDangChon(null)} />
      )}
    </div>
  );
}
