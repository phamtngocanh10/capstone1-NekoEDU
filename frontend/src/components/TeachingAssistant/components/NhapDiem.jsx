import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ClipboardList, Clock3, Info, RefreshCw, Save, Send, ShieldCheck } from 'lucide-react';
import { Btn, Card, Chip, Dialog, SearchBox } from '../../../common/ui';
import {
  useManager as useNguCanhQuanLy,
  usePageHeader as useTieuDeTrang,
} from '../../Manager/layout/ManagerContext';
import { useTroGiang } from '../layout/NguCanhTroGiang';
import { dinhDangNgayGio, NguoiDung, TrangThaiTaiDuLieu, TrangThaiTrong } from './DungChung';
import { daNhapDuDiem, diemHopLe, TEN_KY_NANG, tinhDiemTrungBinh } from './xuLyDiem';
import { TRANG_THAI_QUYEN } from './ChamDiem';
import useBanNhapDiem from './useBanNhapDiem';

export default function NhapDiem() {
  const { grantId: maQuyen } = useParams();
  return <BienTapBangDiem key={maQuyen} maQuyen={maQuyen} />;
}

function BienTapBangDiem({ maQuyen }) {
  useTieuDeTrang('Nhập điểm', 'Điểm bạn nhập sẽ được giảng viên duyệt trước khi vào bảng điểm');
  const dieuHuong = useNavigate();
  const { notify: thongBao } = useNguCanhQuanLy();
  const { duLieu, taiLaiDuLieu } = useTroGiang();
  const [tuKhoa, datTuKhoa] = useState('');
  const [hienXacNhan, datHienXacNhan] = useState(false);
  const {
    banNhap, cacDong, coThayDoi, coDiemSai, duocNhap, xungDot,
    trangThaiLuu, luuLuc, loi, loiTai, dangGui, dangTaiLai,
    doiDiem, luuBanNhap, guiBangDiem, taiLaiBanNhap,
  } = useBanNhapDiem(maQuyen);

  const cacDongHienThi = useMemo(() => {
    const noiDungTim = tuKhoa.trim().toLocaleLowerCase('vi');
    return cacDong.filter(dong => `${dong.name} ${dong.code}`.toLocaleLowerCase('vi').includes(noiDungTim));
  }, [cacDong, tuKhoa]);
  const soHocVienDaNhap = cacDong.filter(daNhapDuDiem).length;
  const phanHoiTraLai = duLieu.submissions.find(
    lanGui => String(lanGui.grantId) === String(maQuyen) && lanGui.status === 'RETURNED',
  );
  const khoaNhap = !duocNhap || dangGui || dangTaiLai || xungDot;

  async function luuThuCong() {
    try {
      if (await luuBanNhap()) thongBao('Đã lưu bản nháp');
    } catch {
      // Hook giữ nguyên điểm đã nhập và hiển thị lỗi tại bảng điểm.
    }
  }

  async function guiDuyet() {
    try {
      if (!await guiBangDiem()) return;
      datHienXacNhan(false);
      taiLaiDuLieu();
      thongBao('Đã lưu bảng điểm mẫu ở trạng thái chờ duyệt.');
      dieuHuong('/assistant/chamdiem/yeucau');
    } catch {
      datHienXacNhan(false);
    }
  }

  function taiLaiSauXungDot() {
    if (coThayDoi && !window.confirm('Tải lại sẽ thay điểm chưa lưu bằng bản nháp trong trình duyệt. Bạn muốn tiếp tục?')) return;
    taiLaiBanNhap();
  }

  if (!banNhap) {
    return (
      <div className="ta-workflow-page">
        <Btn to="/assistant/chamdiem" variant="ghost" icon={ArrowLeft}>Quay lại chấm điểm</Btn>
        <TrangThaiTaiDuLieu loi={loiTai} thuLai={taiLaiBanNhap} />
      </div>
    );
  }

  return (
    <div className="ta-workflow-page">
      <div className="ta-workflow-toolbar">
        <Btn to="/assistant/chamdiem" variant="ghost" icon={ArrowLeft}>Quay lại chấm điểm</Btn>
        <Btn to="/assistant/chamdiem/yeucau" variant="muted">Yêu cầu của tôi</Btn>
      </div>
      <ThongTinQuyenNhap banNhap={banNhap} duocNhap={duocNhap} />
      {phanHoiTraLai && (
        <div className="ta-feedback" role="status">
          <Info size={18} />
          <p>
            <strong>Giảng viên yêu cầu chỉnh sửa</strong>
            {phanHoiTraLai.reviewNote || 'Vui lòng kiểm tra bảng điểm và gửi lại.'}
          </p>
        </div>
      )}
      <Card className="ta-grade-card">
        <div className="ta-grade-heading">
          <div><h2>{banNhap.className}</h2><p>{banNhap.title}</p></div>
          <SearchBox value={tuKhoa} onChange={datTuKhoa} placeholder="Tìm học viên…" />
        </div>
        {cacDong.length === 0 ? (
          <TrangThaiTrong
            bieuTuong={ClipboardList}
            tieuDe="Chưa có học viên trong kỳ điểm"
            moTa="Giảng viên cần kiểm tra danh sách ghi danh của lớp."
          />
        ) : (
          <div className="ta-grade-table-wrap">
            <table className="ta-grade-table">
              <thead>
                <tr>
                  <th>HỌC VIÊN</th>
                  {TEN_KY_NANG.map(ten => <th key={ten}>{ten.toLocaleUpperCase('vi')}</th>)}
                  <th>TRUNG BÌNH</th>
                </tr>
              </thead>
              <tbody>
                {cacDongHienThi.map(dong => (
                  <HangDiemHocVien key={dong.studentId} dongDiem={dong} khoaNhap={khoaNhap} doiDiem={doiDiem} />
                ))}
                {cacDongHienThi.length === 0 && (
                  <tr><td colSpan={6} className="ta-no-results">Không tìm thấy học viên phù hợp.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="ta-grade-footer">
          <div>
            <strong>Đã nhập đủ {soHocVienDaNhap} / {cacDong.length} học viên</strong>
            <TrangThaiBanNhap trangThaiLuu={trangThaiLuu} coThayDoi={coThayDoi} luuLuc={luuLuc} />
          </div>
          <div className="ta-button-row">
            <Btn
              variant="muted"
              icon={Save}
              disabled={khoaNhap || coDiemSai || trangThaiLuu === 'dangLuu'}
              onClick={luuThuCong}
            >
              Lưu nháp
            </Btn>
            <Btn
              icon={Send}
              disabled={khoaNhap || coDiemSai || soHocVienDaNhap !== cacDong.length || !cacDong.length}
              onClick={() => datHienXacNhan(true)}
            >
              Gửi giảng viên duyệt
            </Btn>
          </div>
        </div>
        {coDiemSai && (
          <p className="ta-workflow-error" role="alert">
            Điểm phải từ 0 đến 9, theo bước 0,5. Kiểm tra các ô được đánh dấu.
          </p>
        )}
        {loi && (
          <div className="ta-save-error" role="alert">
            <p>{loi}</p>
            {xungDot && (
              <Btn variant="muted" size="sm" icon={RefreshCw} disabled={dangTaiLai} onClick={taiLaiSauXungDot}>
                Tải lại bản nháp
              </Btn>
            )}
          </div>
        )}
      </Card>
      <div className="ta-workflow-note">
        <Clock3 size={16} />
        <p>Bản nháp được lưu trong trình duyệt này. Bạn có thể nhập từng phần; cần đủ bốn kỹ năng của tất cả học viên trước khi gửi duyệt.</p>
      </div>
      {hienXacNhan && (
        <Dialog
          title="Gửi bảng điểm cho giảng viên?"
          subtitle={`${banNhap.className} · ${banNhap.title}`}
          onClose={() => !dangGui && datHienXacNhan(false)}
          size="sm"
        >
          <div className="ta-confirm-body">
            <p>
              Bảng điểm mẫu của <strong>{cacDong.length} học viên</strong> sẽ chuyển sang trạng thái chờ <strong>{banNhap.teacher}</strong> duyệt.
              Sau khi gửi, bạn chỉ có thể xem trong lúc chờ phê duyệt.
            </p>
            <p>Trong bản mẫu, thao tác này chỉ lưu trạng thái trên trình duyệt của bạn.</p>
          </div>
          <div className="u-modal__foot">
            <Btn variant="muted" disabled={dangGui} onClick={() => datHienXacNhan(false)}>Kiểm tra lại</Btn>
            <Btn icon={Send} disabled={dangGui} onClick={guiDuyet}>{dangGui ? 'Đang gửi…' : 'Gửi duyệt'}</Btn>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ThongTinQuyenNhap({ banNhap, duocNhap }) {
  const trangThai = TRANG_THAI_QUYEN[banNhap.state] ?? TRANG_THAI_QUYEN.expired;
  const tieuDe = banNhap.pending
    ? 'Bảng điểm đã gửi và đang chờ giảng viên duyệt'
    : duocNhap
      ? `Quyền nhập điểm đang mở đến ${dinhDangNgayGio(banNhap.closesAt)}`
      : 'Bảng điểm hiện ở chế độ xem';
  const nhanTrangThai = banNhap.pending
    ? 'Chờ duyệt'
    : !duocNhap && banNhap.state === 'open' ? 'Đã hết hạn' : trangThai.nhan;

  return (
    <div className={`ta-grading-banner ${!duocNhap ? 'is-closed' : ''}`}>
      <span className="ta-grading-banner-icon"><ShieldCheck size={23} /></span>
      <div>
        <strong>{tieuDe}</strong>
        <p>Giảng viên {banNhap.teacher} · {dinhDangNgayGio(banNhap.opensAt)} – {dinhDangNgayGio(banNhap.closesAt)}</p>
        <small>Điểm bạn nhập sẽ gửi giảng viên duyệt trước khi vào bảng điểm lớp.</small>
      </div>
      <Chip tone={banNhap.pending ? 'amber' : duocNhap ? 'green' : trangThai.mau}>{nhanTrangThai}</Chip>
    </div>
  );
}

function HangDiemHocVien({ dongDiem, khoaNhap, doiDiem }) {
  return (
    <tr>
      <td><NguoiDung ten={dongDiem.name} ma={dongDiem.code} /></td>
      {TEN_KY_NANG.map((tenKyNang, chiSoKyNang) => {
        const giaTri = dongDiem.scores[chiSoKyNang];
        const diemSai = !diemHopLe(giaTri);
        return (
          <td key={tenKyNang}>
            <input
              className={`ta-score-input ${diemSai ? 'is-invalid' : ''}`}
              type="number"
              inputMode="decimal"
              min="0"
              max="9"
              step="0.5"
              placeholder="—"
              aria-label={`${tenKyNang} - ${dongDiem.name}`}
              aria-invalid={diemSai}
              value={giaTri}
              disabled={khoaNhap}
              onChange={suKien => doiDiem(dongDiem.studentId, chiSoKyNang, suKien.target.value)}
            />
          </td>
        );
      })}
      <td><strong className="ta-average">{tinhDiemTrungBinh(dongDiem.scores) ?? '—'}</strong></td>
    </tr>
  );
}

function TrangThaiBanNhap({ trangThaiLuu, coThayDoi, luuLuc }) {
  let noiDung = 'Điểm từ 0–9, bước 0,5 · Tự động lưu nháp';
  if (trangThaiLuu === 'dangLuu') noiDung = 'Đang lưu nháp…';
  else if (coThayDoi) noiDung = 'Có thay đổi chưa lưu';
  else if (luuLuc) noiDung = <><Check size={13} /> Đã lưu nháp lúc {dinhDangNgayGio(luuLuc)}</>;
  return <span role="status" aria-live="polite">{noiDung}</span>;
}
