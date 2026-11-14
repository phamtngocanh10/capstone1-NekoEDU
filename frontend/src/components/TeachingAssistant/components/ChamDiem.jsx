import { useState } from 'react';
import { CalendarClock, ChevronRight, ClipboardList, Clock3, LockKeyhole, Plus, ShieldCheck } from 'lucide-react';
import { Btn, Card, CardHead, Chip } from '../../../common/ui';
import { usePageHeader as useTieuDeTrang, useManager as useNguCanhQuanLy } from '../../Manager/layout/ManagerContext';
import { useTroGiang } from '../layout/NguCanhTroGiang';
import { dinhDangNgayGio, TrangThaiTaiDuLieu } from './DungChung';
import GuiYeuCauModal from './GuiYeuCauModal';

export const TRANG_THAI_QUYEN = {
  open: { nhan: 'Đang mở', mau: 'green' },
  scheduled: { nhan: 'Chưa đến thời gian', mau: 'blue' },
  expired: { nhan: 'Đã hết hạn', mau: 'gray' },
  revoked: { nhan: 'Đã thu hồi', mau: 'red' },
  published: { nhan: 'Đã công bố', mau: 'gray' },
};

function DongQuyenNhapDiem({ quyen, tenLop }) {
  const trangThai = TRANG_THAI_QUYEN[quyen.state] ?? TRANG_THAI_QUYEN.expired;
  const duocNhap = quyen.state === 'open' && !quyen.pending;
  return (
    <article className={`ta-grant-row ${quyen.state === 'open' ? 'is-open' : ''}`}>
      <span className="ta-grant-icon"><ShieldCheck size={20} /></span>
      <div className="ta-grant-info">
        <strong>{tenLop || 'Lớp được phân công'}</strong>
        <span>{quyen.title} · {quyen.teacher}</span>
        <small><Clock3 size={12} />{dinhDangNgayGio(quyen.opensAt)} – {dinhDangNgayGio(quyen.closesAt)}</small>
      </div>
      <Chip tone={quyen.pending ? 'amber' : trangThai.mau}>
        {quyen.pending ? 'Chờ giảng viên duyệt' : trangThai.nhan}
      </Chip>
      <Btn
        variant={duocNhap ? 'primary' : 'muted'} size="sm" iconRight={ChevronRight}
        to={`/assistant/chamdiem/nhap/${quyen.id}`}
      >
        {duocNhap ? 'Nhập điểm' : 'Xem chi tiết'}
      </Btn>
    </article>
  );
}

export default function ChamDiem() {
  useTieuDeTrang('Chấm điểm', 'Nhập điểm theo quyền được cấp và gửi giảng viên duyệt');
  const { duLieu, dangTai, loiTai, taiLaiDuLieu } = useTroGiang();
  const { notify: thongBao } = useNguCanhQuanLy();
  const [moYeuCau, datMoYeuCau] = useState(false);

  if (loiTai) return <TrangThaiTaiDuLieu loi={loiTai} thuLai={taiLaiDuLieu} />;
  if (dangTai && !duLieu.classes.length) return <TrangThaiTaiDuLieu />;

  const cacQuyen = duLieu.grants;
  const soQuyenDangMo = cacQuyen.filter(quyen => quyen.state === 'open' && !quyen.pending).length;
  const tenLopTheoMa = new Map(duLieu.classes.map(lop => [String(lop.id), lop.name]));

  return (
    <div className="ta-workflow-page">
      <div className="ta-workflow-toolbar">
        <div className="ta-workflow-tabs" aria-label="Chấm điểm">
          <Btn variant="soft" to="/assistant/chamdiem" icon={ShieldCheck} aria-current="page">Quyền nhập điểm</Btn>
          <Btn variant="ghost" to="/assistant/chamdiem/yeucau" icon={ClipboardList}>Yêu cầu của tôi</Btn>
        </div>
        <Btn icon={Plus} onClick={() => datMoYeuCau(true)}>Gửi yêu cầu nhập điểm</Btn>
      </div>

      {!soQuyenDangMo && (
        <Card className="ta-grading-locked">
          <span className="ta-lock-illustration"><LockKeyhole size={30} strokeWidth={1.6} /></span>
          <h2>Giảng viên chưa mở quyền nhập điểm cho bạn</h2>
          <p>
            Bạn có thể xem lịch, danh sách lớp và hỗ trợ điểm danh.<br />
            Để nhập điểm, hãy gửi yêu cầu để giảng viên mở quyền;<br className="ta-desktop-break" />
            điểm bạn nhập sẽ được giảng viên duyệt trước khi vào bảng điểm.
          </p>
          <div className="ta-button-row">
            <Btn variant="muted" to="/assistant/lichhotro" icon={CalendarClock}>Về lịch hỗ trợ</Btn>
            <Btn icon={Plus} onClick={() => datMoYeuCau(true)}>Gửi yêu cầu</Btn>
          </div>
        </Card>
      )}
      {cacQuyen.length > 0 && (
        <Card>
          <CardHead title="Quyền nhập điểm của bạn" sub={`${soQuyenDangMo} quyền đang mở · Thời gian và phạm vi do giảng viên cấp`} />
          <div className="ta-grant-list">
            {cacQuyen.map(quyen => (
              <DongQuyenNhapDiem key={quyen.id} quyen={quyen} tenLop={tenLopTheoMa.get(String(quyen.classId)) || quyen.className} />
            ))}
          </div>
        </Card>
      )}
      <div className="ta-workflow-note">
        <ShieldCheck size={16} /><p>Điểm được lưu nháp riêng và chỉ cập nhật bảng điểm lớp sau khi giảng viên phê duyệt.</p>
      </div>
      {dangTai && <span className="ta-muted" role="status">Đang cập nhật quyền…</span>}
      {moYeuCau && (
        <GuiYeuCauModal
          dong={() => datMoYeuCau(false)}
          khiGuiThanhCong={() => thongBao('Đã lưu yêu cầu nhập điểm mẫu')}
        />
      )}
    </div>
  );
}
