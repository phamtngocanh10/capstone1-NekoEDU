import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  GraduationCap,
  MapPin,
} from 'lucide-react';
import {
  Btn as Nut,
  Card as The,
  Chip as Nhan,
  InfoGrid as Luoithongtin,
  SelectField as Ochon,
} from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Hopthoai, Tieudekhoi, Trangtrong } from './DungChung';
import { congngay, dautuan, dinhdangngay, ngayhomnay, tenkhoahoc, xuatlich } from './tienIch';
import './hoc-tap.css';

const cacthu = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const trangthaibuoi = {
  sapHoc: { nhan: 'Sắp học', mau: 'blue' },
  daHoc: { nhan: 'Đã học', mau: 'green' },
  daHuy: { nhan: 'Đã hủy', mau: 'red' },
};

function Dongbolich({
  cacBuoiHoc: cacbuoihoc,
  cacKhoaHoc: cackhoahoc,
  dongHopThoai: donghopthoai,
}) {
  const { thongBao: thongbao } = useHocvienphuhuynh();
  const [loi, datloi] = useState('');
  const cacbuoicothexuat = cacbuoihoc.filter((buoi) => buoi.trangThai !== 'daHuy');

  function tailichhoc() {
    try {
      xuatlich(cacbuoicothexuat, cackhoahoc);
      thongbao('Đã tạo tệp lịch .ics. Bạn có thể nhập tệp này vào Google Calendar.');
      donghopthoai();
    } catch (loitai) {
      datloi(loitai.message || 'Chưa tạo được tệp lịch. Vui lòng thử lại.');
    }
  }

  return (
    <Hopthoai
      title="Đồng bộ Google Calendar"
      subtitle="Thêm lịch học của tuần đang xem vào lịch cá nhân"
      onClose={donghopthoai}
      size="sm"
    >
      <div className="sp-dialog-body sp-stack">
        <p className="sp-note">
          Giao diện mẫu xuất lịch thành tệp <strong>.ics</strong>, không kết nối hoặc thay đổi tài
          khoản Google của bạn.
        </p>
        <ol className="sp-calendar-instructions">
          <li>Tải tệp lịch của {cacbuoicothexuat.length} buổi học trong tuần đang xem.</li>
          <li>
            Mở Google Calendar trên máy tính, chọn <strong>Cài đặt → Nhập và xuất</strong>.
          </li>
          <li>
            Chọn tệp .ics vừa tải, chọn lịch nhận rồi nhấn <strong>Nhập</strong>.
          </li>
        </ol>
        {!cacbuoicothexuat.length && (
          <p className="sp-muted">
            Tuần này chưa có buổi học để xuất lịch. Hãy chọn một tuần khác.
          </p>
        )}
        {loi && (
          <p className="sp-error" role="alert">
            {loi}
          </p>
        )}
      </div>
      <div className="sp-dialog-actions">
        <Nut variant="muted" onClick={donghopthoai}>
          Đóng
        </Nut>
        <Nut icon={Download} onClick={tailichhoc} disabled={!cacbuoicothexuat.length}>
          Tải lịch (.ics)
        </Nut>
      </div>
    </Hopthoai>
  );
}

export default function Lichhoc() {
  const { duLieu: dulieu, hocVien: hocvien, cacKhoaDangHoc: cackhoadanghoc } = useHocvienphuhuynh();
  const [thamso] = useSearchParams();
  const [tuandangxem, dattuandangxem] = useState(() => dautuan());
  const [makhoa, datmakhoa] = useState(thamso.get('khoa') ?? '');
  const [dangmodongbo, datdangmodongbo] = useState(false);
  const [buoidachon, datbuoidachon] = useState(null);
  const makhoahople = cackhoadanghoc.some((khoa) => khoa.ma === makhoa) ? makhoa : '';
  const cacbuoihoc = dulieu.lichHoc.filter(
    (buoi) => buoi.maHocVien === hocvien.ma && (!makhoahople || buoi.maKhoa === makhoahople)
  );
  const ngaycuoituan = congngay(tuandangxem, 6);
  const cacngay = cacthu.map((thu, chiso) => ({ thu, ngay: congngay(tuandangxem, chiso) }));
  const cacbuoitrongtuan = cacbuoihoc.filter(
    (buoi) => buoi.ngay >= tuandangxem && buoi.ngay <= ngaycuoituan
  );
  const homnay = ngayhomnay();
  const thoidiemhientai = Date.now();
  const cacbuoisaphoc = cacbuoihoc
    .filter((buoi) => {
      if (buoi.trangThai !== 'sapHoc') return false;
      const thoidiemketthuc = new Date(`${buoi.ngay}T${buoi.ketThuc}:00+07:00`).getTime();
      return thoidiemketthuc >= thoidiemhientai;
    })
    .sort(
      (truoc, sau) => truoc.ngay.localeCompare(sau.ngay) || truoc.batDau.localeCompare(sau.batDau)
    )
    .slice(0, 4);

  useEffect(() => {
    datbuoidachon(null);
    datdangmodongbo(false);
  }, [hocvien.ma]);

  return (
    <div className="sp-page sp-study-page">
      <div className="sp-toolbar">
        <div className="sp-week-navigation">
          <Nut
            variant="icon"
            aria-label="Tuần trước"
            onClick={() => dattuandangxem(congngay(tuandangxem, -7))}
          >
            <ChevronLeft size={18} />
          </Nut>
          <div>
            <h2>
              Tuần {dinhdangngay(tuandangxem, { year: undefined })} – {dinhdangngay(ngaycuoituan)}
            </h2>
            <p className="sp-muted">Lịch học của {hocvien.ten}</p>
          </div>
          <Nut
            variant="icon"
            aria-label="Tuần sau"
            onClick={() => dattuandangxem(congngay(tuandangxem, 7))}
          >
            <ChevronRight size={18} />
          </Nut>
          <Nut variant="soft" size="sm" onClick={() => dattuandangxem(dautuan())}>
            Tuần này
          </Nut>
        </div>
        <Nut variant="soft" icon={CalendarPlus} onClick={() => datdangmodongbo(true)}>
          Đồng bộ Google Calendar
        </Nut>
      </div>
      <div className="sp-study-filter">
        <Ochon
          label="Khóa học"
          value={makhoahople}
          onChange={(sukien) => datmakhoa(sukien.target.value)}
          options={[
            { value: '', label: 'Tất cả khóa học' },
            ...cackhoadanghoc.map((khoa) => ({ value: khoa.ma, label: khoa.ten })),
          ]}
        />
      </div>

      <The pad={false} className="sp-week-calendar">
        {cacngay.map(({ thu, ngay }) => {
          const cacbuoitrongngay = cacbuoitrongtuan
            .filter((buoi) => buoi.ngay === ngay)
            .sort((truoc, sau) => truoc.batDau.localeCompare(sau.batDau));
          return (
            <section
              key={ngay}
              className={`sp-week-day ${ngay === homnay ? 'is-today' : ''}`}
              aria-label={`${thu}, ${dinhdangngay(ngay)}`}
            >
              <header>
                <strong>{thu}</strong>
                <span>{dinhdangngay(ngay, { year: undefined })}</span>
                {ngay === homnay && <small>Hôm nay</small>}
              </header>
              <div className="sp-week-day__sessions">
                {cacbuoitrongngay.map((buoi) => (
                  <button
                    type="button"
                    key={buoi.ma}
                    className={`sp-calendar-session sp-calendar-session--${buoi.trangThai}`}
                    onClick={() => datbuoidachon(buoi)}
                  >
                    <span>
                      <Clock3 size={12} />
                      {buoi.batDau} – {buoi.ketThuc}
                    </span>
                    <strong>{tenkhoahoc(dulieu, buoi.maKhoa)}</strong>
                    <small>
                      <MapPin size={12} />
                      {buoi.phong}
                    </small>
                    <small>{buoi.giangVien}</small>
                    <em>{trangthaibuoi[buoi.trangThai]?.nhan ?? 'Buổi học'}</em>
                  </button>
                ))}
                {!cacbuoitrongngay.length && (
                  <span className="sp-week-day__empty" aria-label="Không có lịch học">
                    —
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </The>
      <div className="sp-calendar-legend">
        <span>
          <i />
          Sắp học
        </span>
        <span>
          <i className="is-complete" />
          Đã học
        </span>
        <span>
          <i className="is-cancelled" />
          Đã hủy
        </span>
      </div>
      {!cacbuoitrongtuan.length && (
        <p className="sp-note" role="status">
          Không có buổi học trong tuần đang xem. Chọn <strong>Tuần này</strong> để quay về lịch hiện
          tại.
        </p>
      )}

      <The className="sp-stack">
        <Tieudekhoi
          tieuDe="Buổi học sắp tới"
          moTa="Chuẩn bị sẵn sàng cho những buổi học tiếp theo"
        />
        {cacbuoisaphoc.length ? (
          cacbuoisaphoc.map((buoi) => (
            <button
              type="button"
              className="sp-upcoming-session"
              key={buoi.ma}
              onClick={() => datbuoidachon(buoi)}
            >
              <span className="sp-study-icon">
                <CalendarDays size={20} />
              </span>
              <span>
                <strong>{tenkhoahoc(dulieu, buoi.maKhoa)}</strong>
                <small>
                  {buoi.phong} · {buoi.giangVien}
                </small>
              </span>
              <time>
                {buoi.ngay === homnay ? 'Hôm nay' : dinhdangngay(buoi.ngay)}
                <small>
                  {buoi.batDau} – {buoi.ketThuc}
                </small>
              </time>
              <ChevronRight size={17} />
            </button>
          ))
        ) : (
          <Trangtrong
            tieuDe="Chưa có buổi học sắp tới"
            moTa="Lịch mẫu hiện chưa có thêm buổi học cho khóa đã chọn."
          />
        )}
      </The>

      {dangmodongbo && (
        <Dongbolich
          cacBuoiHoc={cacbuoitrongtuan}
          cacKhoaHoc={dulieu.khoaHoc}
          dongHopThoai={() => datdangmodongbo(false)}
        />
      )}
      {buoidachon && (
        <Hopthoai
          title="Thông tin buổi học"
          subtitle={tenkhoahoc(dulieu, buoidachon.maKhoa)}
          onClose={() => datbuoidachon(null)}
          size="sm"
        >
          <div className="sp-dialog-body sp-stack">
            <Nhan tone={trangthaibuoi[buoidachon.trangThai]?.mau}>
              {trangthaibuoi[buoidachon.trangThai]?.nhan}
            </Nhan>
            <Luoithongtin
              items={[
                { label: 'Ngày học', value: dinhdangngay(buoidachon.ngay) },
                { label: 'Thời gian', value: `${buoidachon.batDau} – ${buoidachon.ketThuc}` },
                { label: 'Phòng học', value: buoidachon.phong },
                { label: 'Giảng viên', value: buoidachon.giangVien },
              ]}
            />
            <p>{buoidachon.noiDung}</p>
          </div>
          <div className="sp-dialog-actions">
            <Nut variant="muted" onClick={() => datbuoidachon(null)}>
              Đóng
            </Nut>
            <Nut to={`/student/khoahoc/${buoidachon.maKhoa}`} icon={GraduationCap}>
              Xem khóa học
            </Nut>
          </div>
        </Hopthoai>
      )}
    </div>
  );
}
