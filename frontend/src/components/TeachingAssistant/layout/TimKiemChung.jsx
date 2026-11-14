import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Search, X } from 'lucide-react';
import useBamNgoai from '../../../common/useClickOutside';
import { duLieuTroGiang } from '../duLieuTroGiang';
import { coQuyen, locTheoTuKhoa, useTaiDuLieu } from '../components/DungChung';
import { useTroGiang } from './NguCanhTroGiang';

function KetQuaLopHoc({ lopHoc, dongTimKiem }) {
  return (
    <Link to={`/assistant/lophoc/${lopHoc.id}`} onClick={dongTimKiem}>
      <BookOpen size={16} />
      <span>
        <strong>{lopHoc.name}</strong>
        <small>{lopHoc.code} · {lopHoc.teacher}</small>
      </span>
      <ChevronRight size={14} />
    </Link>
  );
}

function KetQuaHocVien({ hocVien, dongTimKiem }) {
  const chuCaiDau = hocVien.name?.trim().split(/\s+/).at(-1)?.charAt(0);
  const tuKhoaHocVien = encodeURIComponent(hocVien.code || hocVien.name);

  return (
    <Link
      to={`/assistant/lophoc/${hocVien.maLop}?student=${tuKhoaHocVien}`}
      onClick={dongTimKiem}
    >
      <span className="ta-search-initial">{chuCaiDau}</span>
      <span>
        <strong>{hocVien.name}</strong>
        <small>{hocVien.code} · {hocVien.tenLop}</small>
      </span>
      <ChevronRight size={14} />
    </Link>
  );
}

function useTimHocVien(cacLop, choPhepTai) {
  const khoaPhanCong = cacLop.map(lop => `${lop.id}:${lop.size ?? 0}`).sort().join(',');
  const nguonHocVien = useTaiDuLieu(async () => {
    if (!choPhepTai) return [];
    const cacDanhSach = await Promise.all(cacLop.map(async lopHoc => {
      const hocVien = await duLieuTroGiang.layDanhSachHocVien(lopHoc.id);
      return hocVien.map(thongTin => ({ ...thongTin, maLop: lopHoc.id, tenLop: lopHoc.name }));
    }));
    return cacDanhSach.flat();
  }, [choPhepTai, khoaPhanCong]);

  // Gõ tiếp chỉ lọc danh sách đã đọc; không tạo bản sao dữ liệu cho mỗi từ khóa.
  const cacMaLopHopLe = new Set(cacLop.map(lopHoc => String(lopHoc.id)));
  return {
    danhSach: choPhepTai
      ? (nguonHocVien.duLieu ?? []).filter(hocVien => cacMaLopHopLe.has(String(hocVien.maLop)))
      : [],
    dangTai: choPhepTai && cacLop.length > 0 && nguonHocVien.dangTai,
    loiTai: choPhepTai ? nguonHocVien.loi : '',
  };
}

export default function TimKiemChung() {
  const { duLieu, tuKhoa, datTuKhoa } = useTroGiang();
  const [dangMo, datDangMo] = useState(false);
  const vungTimKiem = useRef(null);
  const lopDuocXem = duLieu.classes.filter(lopHoc => coQuyen(lopHoc, 'roster'));
  const coTuKhoa = Boolean(tuKhoa.trim());
  const danhSachHocVien = useTimHocVien(lopDuocXem, dangMo && coTuKhoa);

  useBamNgoai(vungTimKiem, () => datDangMo(false), dangMo);
  const cacLopTimThay = coTuKhoa
    ? locTheoTuKhoa(duLieu.classes, tuKhoa, lopHoc => `${lopHoc.name} ${lopHoc.code}`).slice(0, 4)
    : [];
  const hocVienTimThay = coTuKhoa
    ? locTheoTuKhoa(danhSachHocVien.danhSach, tuKhoa, hocVien => `${hocVien.name} ${hocVien.code}`).slice(0, 5)
    : [];
  const coKetQua = cacLopTimThay.length > 0 || hocVienTimThay.length > 0;

  function dongTimKiem() {
    datDangMo(false);
    datTuKhoa('');
  }

  function doiTuKhoa(suKien) {
    datTuKhoa(suKien.target.value);
    datDangMo(true);
  }

  return (
    <div className="ta-global-search" ref={vungTimKiem}>
      <label className="search">
        <Search size={15} />
        <input
          placeholder="Tìm học viên, lớp học..."
          aria-label="Tìm học viên, lớp học"
          value={tuKhoa}
          onChange={doiTuKhoa}
          onFocus={() => datDangMo(true)}
          onKeyDown={suKien => {
            if (suKien.key === 'Escape') datDangMo(false);
          }}
        />
        {tuKhoa && (
          <button type="button" onClick={dongTimKiem} aria-label="Xóa tìm kiếm">
            <X size={13} />
          </button>
        )}
      </label>

      {dangMo && coTuKhoa && (
        <div className="ta-search-results" role="region" aria-label="Kết quả tìm kiếm">
          {cacLopTimThay.length > 0 && <small>Lớp học</small>}
          {cacLopTimThay.map(lopHoc => (
            <KetQuaLopHoc key={lopHoc.id} lopHoc={lopHoc} dongTimKiem={dongTimKiem} />
          ))}
          {hocVienTimThay.length > 0 && <small>Học viên</small>}
          {hocVienTimThay.map(hocVien => (
            <KetQuaHocVien
              key={`${hocVien.maLop}-${hocVien.id}`}
              hocVien={hocVien}
              dongTimKiem={dongTimKiem}
            />
          ))}
          {danhSachHocVien.dangTai && <p role="status">Đang tìm học viên…</p>}
          {danhSachHocVien.loiTai && <p role="alert">{danhSachHocVien.loiTai}</p>}
          {!coKetQua && !danhSachHocVien.dangTai && !danhSachHocVien.loiTai && (
            <p>Không tìm thấy học viên hoặc lớp phù hợp.</p>
          )}
        </div>
      )}
    </div>
  );
}
