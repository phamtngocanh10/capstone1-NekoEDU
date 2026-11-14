import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  BookOpen, CalendarDays, Check, ClipboardCheck, Clock3,
  Download, LockKeyhole, MapPin, Search, Users,
} from 'lucide-react';
import { Btn, Card, Chip, DataTable, SearchBox } from '../../../common/ui';
import { downloadText as taiVanBan } from '../../../common/format';
import { duLieuTroGiang } from '../duLieuTroGiang';
import { useTroGiang } from '../layout/NguCanhTroGiang';
import {
  coQuyen, dinhDangNgay, locTheoTuKhoa, NguoiDung,
  TrangThaiTaiDuLieu, TrangThaiTrong, useTaiDuLieu,
} from './DungChung';
import { dinhDangThu } from './hienThiLich';

function TheLopHoc({ lopHoc, thuTu, duocChon }) {
  const cacThongTin = [
    { bieuTuong: Users, noiDung: `${lopHoc.size ?? 0} học viên` },
    { bieuTuong: MapPin, noiDung: lopHoc.room || 'Chưa xếp phòng' },
    { bieuTuong: CalendarDays, noiDung: lopHoc.days?.length ? dinhDangThu(lopHoc.days) : 'Chưa xếp lịch' },
    { bieuTuong: Clock3, noiDung: lopHoc.time || 'Chưa xếp giờ' },
  ];
  const duongDanLop = `/assistant/lophoc/${lopHoc.id}`;
  const lopGiaoDien = [
    'ta-class-card',
    `ta-class-card--${thuTu % 3}`,
    duocChon && 'is-selected',
  ].filter(Boolean).join(' ');

  return (
    <Card className={lopGiaoDien}>
      <div className="ta-class-card__top">
        <span className="ta-class-card__icon"><BookOpen size={21} /></span>
        <Chip tone={lopHoc.status === 'open' ? 'green' : 'blue'}>{lopHoc.code}</Chip>
      </div>
      <h2><Link to={duongDanLop}>{lopHoc.name}</Link></h2>
      <p className="ta-class-teacher">Hỗ trợ {lopHoc.teacher || 'giảng viên phụ trách'}</p>
      <div className="ta-class-meta">
        {cacThongTin.map(({ bieuTuong: BieuTuong, noiDung }, viTri) => (
          <span key={viTri}><BieuTuong size={14} />{noiDung}</span>
        ))}
      </div>
      <div className="ta-class-card__actions">
        <Btn size="sm" variant={duocChon ? 'soft' : 'ghost'} to={duongDanLop}>
          {duocChon && <Check size={13} />}Danh sách lớp
        </Btn>
        {coQuyen(lopHoc, 'attendance') && (
          <Btn size="sm" icon={ClipboardCheck} to={`/assistant/diemdanh?classId=${lopHoc.id}`}>
            Điểm danh
          </Btn>
        )}
      </div>
    </Card>
  );
}

function taoCsvHocVien(danhSach) {
  const cacDong = [
    ['Mã học viên', 'Họ và tên', 'Ngày sinh', 'Điện thoại'],
    ...danhSach.map(hocVien => [
      hocVien.code, hocVien.name, dinhDangNgay(hocVien.birth), hocVien.phone,
    ]),
  ];
  const dinhDangO = giaTri => `"${String(giaTri ?? '').replaceAll('"', '""')}"`;
  return cacDong.map(dong => dong.map(dinhDangO).join(',')).join('\r\n');
}

const CAC_COT_HOC_VIEN = [
  { key: 'soThuTu', label: 'STT', width: 56, render: hocVien => String(hocVien.soThuTu).padStart(2, '0') },
  { key: 'name', label: 'Học viên', render: hocVien => <NguoiDung ten={hocVien.name} ma={hocVien.code} /> },
  { key: 'birth', label: 'Ngày sinh', render: hocVien => dinhDangNgay(hocVien.birth) },
  { key: 'phone', label: 'Số điện thoại', render: hocVien => hocVien.phone || '—' },
  {
    key: 'rate',
    label: 'Chuyên cần',
    render: hocVien => hocVien.rate == null ? '—' : (
      <Chip tone={Number(hocVien.rate) >= 80 ? 'green' : 'amber'}>{hocVien.rate}%</Chip>
    ),
  },
];

function DanhSachHocVien({ lopHoc, tuKhoaBanDau }) {
  const [tuKhoa, datTuKhoa] = useState(tuKhoaBanDau);
  const duocXemDanhSach = coQuyen(lopHoc, 'roster');
  const duLieuHocVien = useTaiDuLieu(
    () => duocXemDanhSach ? duLieuTroGiang.layDanhSachHocVien(lopHoc.id) : [],
    [lopHoc.id, duocXemDanhSach],
  );

  useEffect(() => { datTuKhoa(tuKhoaBanDau); }, [tuKhoaBanDau, lopHoc.id]);

  const danhSachDayDu = (duLieuHocVien.duLieu ?? []).map((hocVien, viTri) => ({
    ...hocVien,
    soThuTu: viTri + 1,
  }));
  const hocVienHienThi = locTheoTuKhoa(
    danhSachDayDu, tuKhoa, hocVien => `${hocVien.name} ${hocVien.code}`,
  );

  function xuatDanhSach() {
    taiVanBan(
      `danh-sach-${lopHoc.code || lopHoc.id}.csv`,
      taoCsvHocVien(hocVienHienThi),
    );
  }

  function noiDungDanhSach() {
    if (!duocXemDanhSach) {
      return (
        <TrangThaiTrong
          bieuTuong={LockKeyhole}
          tieuDe="Chưa có quyền xem danh sách"
          moTa="Giảng viên chưa cấp quyền xem danh sách học viên cho phân công này."
        />
      );
    }
    if (duLieuHocVien.dangTai) {
      return <div className="ta-inline-status" role="status">Đang tải danh sách học viên…</div>;
    }
    if (duLieuHocVien.loi) {
      return <TrangThaiTaiDuLieu loi={duLieuHocVien.loi} thuLai={duLieuHocVien.taiLai} />;
    }

    return (
      <>
        <div className="ta-roster-toolbar">
          <SearchBox value={tuKhoa} onChange={datTuKhoa} placeholder="Tìm tên hoặc mã học viên..." />
          <Btn variant="soft" icon={Download} disabled={!hocVienHienThi.length} onClick={xuatDanhSach}>
            Xuất danh sách
          </Btn>
        </div>
        <DataTable
          columns={CAC_COT_HOC_VIEN}
          rows={hocVienHienThi}
          empty={tuKhoa ? 'Không tìm thấy học viên phù hợp.' : 'Lớp chưa có học viên.'}
        />
        <div className="ta-table-footer">
          Hiển thị {hocVienHienThi.length} / {danhSachDayDu.length} học viên
        </div>
      </>
    );
  }

  return (
    <Card pad={false} className="ta-roster-card">
      <div className="ta-roster-heading">
        <div>
          <span className="ta-eyebrow">DANH SÁCH HỌC VIÊN</span>
          <h2>{lopHoc.name}</h2>
          <p>{lopHoc.teacher} · {lopHoc.room || 'Chưa xếp phòng'}</p>
        </div>
        <span className="ta-roster-count">
          <Users size={15} />{duLieuHocVien.duLieu?.length ?? lopHoc.size ?? 0} học viên
        </span>
      </div>
      {noiDungDanhSach()}
    </Card>
  );
}

export default function LopDuocPhanCong() {
  const { classId: maLop } = useParams();
  const [thamSoTimKiem] = useSearchParams();
  const { duLieu, dangTai, loiTai, taiLaiDuLieu, tuKhoa } = useTroGiang();
  const cacLopHienThi = locTheoTuKhoa(
    duLieu.classes, tuKhoa, lopHoc => `${lopHoc.name} ${lopHoc.code} ${lopHoc.teacher}`,
  );
  const lopDangChon = duLieu.classes.find(lopHoc => String(lopHoc.id) === String(maLop))
    ?? (!maLop ? cacLopHienThi[0] : null);

  if (dangTai && !duLieu.classes.length) return <TrangThaiTaiDuLieu />;
  if (loiTai) return <TrangThaiTaiDuLieu loi={loiTai} thuLai={taiLaiDuLieu} />;
  if (!duLieu.classes.length) {
    return (
      <Card>
        <TrangThaiTrong
          bieuTuong={BookOpen}
          tieuDe="Bạn chưa được phân công lớp"
          moTa="Danh sách lớp và học viên sẽ xuất hiện sau khi trung tâm hoặc giảng viên phân công cho bạn."
        />
      </Card>
    );
  }

  return (
    <div className="u-page ta-classes">
      <div className="ta-class-grid">
        {cacLopHienThi.map((lopHoc, thuTu) => (
          <TheLopHoc key={lopHoc.id} lopHoc={lopHoc} thuTu={thuTu} duocChon={lopDangChon?.id === lopHoc.id} />
        ))}
      </div>
      {!cacLopHienThi.length && (
        <Card>
          <TrangThaiTrong
            bieuTuong={Search}
            tieuDe="Không tìm thấy lớp học"
            moTa="Thử tìm theo tên lớp, mã lớp hoặc giảng viên khác."
          />
        </Card>
      )}
      {!lopDangChon && maLop && (
        <Card>
          <TrangThaiTrong
            bieuTuong={BookOpen}
            tieuDe="Không tìm thấy lớp được phân công"
            moTa="Lớp này không tồn tại hoặc bạn không còn được phân công hỗ trợ."
          />
        </Card>
      )}
      {lopDangChon && (
        <DanhSachHocVien
          key={lopDangChon.id}
          lopHoc={lopDangChon}
          tuKhoaBanDau={thamSoTimKiem.get('student') || ''}
        />
      )}
    </div>
  );
}
