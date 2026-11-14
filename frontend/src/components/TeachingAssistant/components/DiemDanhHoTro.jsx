import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, ClipboardCheck, Clock3, Info, MapPin, Save, Users } from 'lucide-react';
import { Btn, Card, Chip, MiniStat, SearchBox, SelectField, TextField } from '../../../common/ui';
import { duLieuTroGiang, layBuoiDiemDanh } from '../duLieuTroGiang';
import { useManager as useNguCanhQuanLy, usePageHeader as useTieuDeTrang } from '../../Manager/layout/ManagerContext';
import { useTroGiang } from '../layout/NguCanhTroGiang';
import {
  coQuyen, dinhDangNgay, dinhDangNgayGio, layThongBaoLoi, locTheoTuKhoa,
  ngayHomNay, NguoiDung, TrangThaiTaiDuLieu, TrangThaiTrong, useTaiDuLieu,
} from './DungChung';
import useBaoVeThayDoi from './useBaoVeThayDoi';

const LUA_CHON_DIEM_DANH = [
  { giaTri: 'present', nhan: 'Có mặt', bieuTuong: Check },
  { giaTri: 'late', nhan: 'Đi trễ', bieuTuong: Clock3 },
  { giaTri: 'absent', nhan: 'Vắng', bieuTuong: Users },
];
const NHOM_THONG_KE = { present: 'coMat', late: 'diTre', absent: 'vang' };

function demDiemDanh(danhSach) {
  return danhSach.reduce((thongKe, hocVien) => {
    const nhom = NHOM_THONG_KE[hocVien.status] || 'chuaDiemDanh';
    thongKe[nhom] += 1;
    return thongKe;
  }, { coMat: 0, diTre: 0, vang: 0, chuaDiemDanh: 0 });
}

function taoBanLuu(danhSach) {
  return danhSach.map(({ studentId: maHocVien, status: trangThai, note: ghiChu }) => ({
    studentId: maHocVien, status: trangThai, note: ghiChu,
  }));
}

function lyDoChiXem(diemDanh, buoiHoc) {
  if (diemDanh.status === 'CANCELLED') return 'Buổi học đã bị hủy. Bạn chỉ có thể xem điểm danh.';
  const batDau = buoiHoc?.startTime ? new Date(`${diemDanh.date}T${buoiHoc.startTime}:00+07:00`) : null;
  if (batDau && batDau > new Date()) return 'Buổi học chưa bắt đầu. Bạn có thể điểm danh khi đến giờ hỗ trợ.';
  return 'Bạn chưa được cấp quyền sửa điểm danh cho buổi học này.';
}

function DongDiemDanh({ hocVien, duocSua, khiThayDoi }) {
  return (
    <tr>
      <td><NguoiDung ten={hocVien.name} ma={hocVien.code} /></td>
      <td>
        <div className="ta-attendance-options" role="radiogroup" aria-label={`Điểm danh ${hocVien.name}`}>
          {LUA_CHON_DIEM_DANH.map(({ giaTri, nhan, bieuTuong: BieuTuong }) => (
            <button
              key={giaTri} type="button" role="radio" aria-checked={hocVien.status === giaTri}
              disabled={!duocSua}
              className={`ta-attendance-option ta-attendance-option--${giaTri} ${hocVien.status === giaTri ? 'is-selected' : ''}`}
              onClick={() => khiThayDoi(hocVien.studentId, { status: giaTri })}
            >
              <BieuTuong size={13} />{nhan}
            </button>
          ))}
        </div>
      </td>
      <td>
        <input
          className="ta-attendance-note" aria-label={`Ghi chú ${hocVien.name}`}
          value={hocVien.note} maxLength={245} placeholder="Thêm ghi chú…" disabled={!duocSua}
          onChange={suKien => khiThayDoi(hocVien.studentId, { note: suKien.target.value })}
        />
      </td>
    </tr>
  );
}

export default function DiemDanhHoTro() {
  useTieuDeTrang('Điểm danh hỗ trợ', 'Hỗ trợ điểm danh thủ công cho các buổi học được phân công');
  const { duLieu, dangTai, loiTai, taiLaiDuLieu } = useTroGiang();
  const { notify: thongBao } = useNguCanhQuanLy();
  const [thamSo, datThamSo] = useSearchParams();
  const ngay = thamSo.get('date') || ngayHomNay();
  const maLop = thamSo.get('classId') || '';
  const maBuoiHoc = thamSo.get('sessionId') || '';
  const [danhSach, datDanhSach] = useState([]);
  const [banDaLuu, datBanDaLuu] = useState('');
  const [tuKhoa, datTuKhoa] = useState('');
  const [loi, datLoi] = useState('');
  const [dangLuu, datDangLuu] = useState(false);
  const dangLuuRef = useRef(false);
  const nguonDiemDanh = useTaiDuLieu(() => layBuoiDiemDanh({ maBuoiHoc, maLop, ngay }), [ngay, maLop, maBuoiHoc]);

  useEffect(() => {
    const cacDong = nguonDiemDanh.duLieu?.diemDanh?.rows ?? [];
    datDanhSach(cacDong.map(dong => ({ ...dong })));
    datBanDaLuu(JSON.stringify(taoBanLuu(cacDong)));
    datLoi('');
  }, [nguonDiemDanh.duLieu]);

  const chuaLuu = Boolean(nguonDiemDanh.duLieu?.diemDanh)
    && JSON.stringify(taoBanLuu(danhSach)) !== banDaLuu;
  useBaoVeThayDoi(chuaLuu, { thongDiep: 'Điểm danh chưa được lưu. Rời trang và bỏ các thay đổi này?' });

  function doiBuoiHoc(thayDoi) {
    if (dangLuuRef.current) return;
    const thamSoMoi = new URLSearchParams(thamSo);
    thamSoMoi.delete('sessionId');
    for (const [tenThamSo, giaTri] of Object.entries(thayDoi)) {
      if (giaTri) thamSoMoi.set(tenThamSo, giaTri);
      else thamSoMoi.delete(tenThamSo);
    }
    datThamSo(thamSoMoi);
  }

  function doiDiemDanh(maHocVien, thayDoi) {
    datDanhSach(cacDong => cacDong.map(dong => dong.studentId === maHocVien ? { ...dong, ...thayDoi } : dong));
    datLoi('');
  }

  async function luuDiemDanh() {
    if (dangLuuRef.current) return;
    if (danhSach.some(hocVien => !hocVien.status)) {
      datLoi('Vui lòng chọn trạng thái cho tất cả học viên trước khi lưu.');
      return;
    }
    dangLuuRef.current = true;
    datDangLuu(true);
    datLoi('');
    const maBuoiCanLuu = nguonDiemDanh.duLieu.diemDanh.sessionId;
    try {
      const diemDanhMoi = await duLieuTroGiang.luuDiemDanh(maBuoiCanLuu, {
        records: taoBanLuu(danhSach), reason: 'Cập nhật từ màn hình điểm danh hỗ trợ',
      });
      // Dùng ngay phản hồi lưu thành công, không tải lại cả lịch và danh sách.
      nguonDiemDanh.datDuLieu(duLieuCu => String(duLieuCu?.diemDanh?.sessionId) === String(maBuoiCanLuu)
        ? { ...duLieuCu, diemDanh: diemDanhMoi }
        : duLieuCu);
      thongBao('Đã lưu điểm danh hỗ trợ');
    } catch (loiLuu) {
      datLoi(layThongBaoLoi(loiLuu, 'Chưa lưu được điểm danh. Vui lòng thử lại.'));
    } finally {
      dangLuuRef.current = false;
      datDangLuu(false);
    }
  }

  if (loiTai) return <TrangThaiTaiDuLieu loi={loiTai} thuLai={taiLaiDuLieu} />;
  if (dangTai && !duLieu.classes.length) return <TrangThaiTaiDuLieu />;

  const cacLop = duLieu.classes.filter(lop => coQuyen(lop, 'attendance'));
  const diemDanh = nguonDiemDanh.duLieu?.diemDanh;
  const buoiDaChon = nguonDiemDanh.duLieu?.buoiDaChon;
  const cacBuoiHoc = nguonDiemDanh.duLieu?.cacBuoiHoc ?? [];
  const duocSua = diemDanh?.editable && !dangLuu;
  const danhSachLoc = locTheoTuKhoa(danhSach, tuKhoa, hocVien => `${hocVien.name} ${hocVien.code}`);
  const thongKe = demDiemDanh(danhSach);
  const tenLop = buoiDaChon?.name || duLieu.classes.find(lop => String(lop.id) === String(diemDanh?.classId))?.name;

  return (
    <div className="ta-workflow-page">
      <Card className="ta-attendance-selectors">
        <SelectField
          label="Lớp hỗ trợ" value={diemDanh?.classId ?? maLop}
          onChange={suKien => doiBuoiHoc({ classId: suKien.target.value })}
          options={[{ value: '', label: 'Tất cả lớp được phân công' }, ...cacLop.map(lop => ({ value: String(lop.id), label: lop.name }))]}
        />
        <TextField
          label="Ngày hỗ trợ" type="date" icon={CalendarDays} value={diemDanh?.date ?? ngay}
          onChange={suKien => doiBuoiHoc({ date: suKien.target.value })}
        />
        {cacBuoiHoc.length > 1 && (
          <SelectField
            label="Buổi học" value={buoiDaChon?.id ?? ''}
            options={[{ value: '', label: 'Chọn buổi học' }, ...cacBuoiHoc.filter(buoiHoc => coQuyen(buoiHoc, 'attendance')).map(buoiHoc => ({ value: String(buoiHoc.id), label: `${buoiHoc.time} · ${buoiHoc.name}` }))]}
            onChange={suKien => doiBuoiHoc({ sessionId: suKien.target.value, date: diemDanh?.date ?? ngay })}
          />
        )}
      </Card>

      {!nguonDiemDanh.duLieu ? (
        <TrangThaiTaiDuLieu loi={nguonDiemDanh.loi} thuLai={nguonDiemDanh.taiLai} />
      ) : !diemDanh ? (
        <Card>
          <TrangThaiTrong
            bieuTuong={ClipboardCheck}
            tieuDe={cacLop.length ? 'Không có buổi hỗ trợ trong ngày đã chọn' : 'Bạn chưa được cấp quyền điểm danh lớp nào'}
            moTa="Chọn ngày khác hoặc mở buổi học từ lịch hỗ trợ để điểm danh đúng lớp."
          >
            <Btn to="/assistant/lichhotro" variant="muted" icon={CalendarDays}>Xem lịch hỗ trợ</Btn>
          </TrangThaiTrong>
        </Card>
      ) : (
        <>
          <Card className="ta-attendance-card">
            <div className="ta-attendance-heading">
              <div>
                <h2>{tenLop}</h2>
                <p>{dinhDangNgay(diemDanh.date)}{buoiDaChon && <> · {buoiDaChon.time} · <MapPin size={12} /> {buoiDaChon.room} · Hỗ trợ {buoiDaChon.teacher}</>}</p>
              </div>
              <Btn icon={Save} onClick={luuDiemDanh} disabled={!duocSua || !chuaLuu || thongKe.chuaDiemDanh > 0 || !danhSach.length}>
                {dangLuu ? 'Đang lưu…' : 'Lưu điểm danh'}
              </Btn>
            </div>
            {!diemDanh.editable && (
              <div className="ta-attendance-readonly" role="status">
                <Info size={16} />{lyDoChiXem(diemDanh, buoiDaChon)}
              </div>
            )}
            <div className="ta-attendance-stats">
              <MiniStat label="Có mặt" value={thongKe.coMat} />
              <MiniStat label="Đi trễ" value={thongKe.diTre} />
              <MiniStat label="Vắng" value={thongKe.vang} />
              <MiniStat label="Chưa điểm danh" value={thongKe.chuaDiemDanh} />
            </div>
            <div className="ta-workflow-filters">
              <SearchBox value={tuKhoa} onChange={datTuKhoa} placeholder="Tìm học viên theo tên hoặc mã…" />
              <Btn variant="muted" size="sm" icon={Check} disabled={!duocSua || !danhSach.length} onClick={() => datDanhSach(cacDong => cacDong.map(dong => ({ ...dong, status: 'present' })))}>
                Tất cả có mặt
              </Btn>
            </div>
            <div className="ta-grade-table-wrap">
              <table className="ta-attendance-table">
                <thead><tr><th>HỌC VIÊN</th><th>TRẠNG THÁI ĐIỂM DANH</th><th>GHI CHÚ</th></tr></thead>
                <tbody>
                  {danhSachLoc.map(hocVien => <DongDiemDanh key={hocVien.studentId} hocVien={hocVien} duocSua={duocSua} khiThayDoi={doiDiemDanh} />)}
                  {!danhSachLoc.length && <tr><td colSpan={3} className="ta-no-results">{danhSach.length ? 'Không tìm thấy học viên phù hợp.' : 'Buổi học chưa có học viên ghi danh.'}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="ta-attendance-footer">
              <span role="status">
                {chuaLuu ? <Chip tone="amber">Có thay đổi chưa lưu</Chip> : diemDanh.savedAt ? <><Check size={14} /> Đã lưu lúc {dinhDangNgayGio(diemDanh.savedAt)}</> : 'Chọn trạng thái cho từng học viên'}
                {thongKe.chuaDiemDanh > 0 && ` · Còn ${thongKe.chuaDiemDanh} học viên chưa điểm danh`}
              </span>
              <span>{danhSach.length} học viên</span>
            </div>
            {loi && <p className="ta-workflow-error" role="alert">{loi}</p>}
          </Card>
          <div className="ta-workflow-note">
            <Info size={16} /><p>Điểm danh được lưu theo từng buổi học. Quyền chấm điểm được giảng viên cấp riêng tại mục <strong>Chấm điểm</strong>.</p>
          </div>
        </>
      )}
    </div>
  );
}
