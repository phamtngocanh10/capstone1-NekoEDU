import { useRef, useState } from 'react';
import { CalendarClock, Send, UserRound } from 'lucide-react';
import { Btn, Dialog, SelectField, TextAreaField, TextField } from '../../../common/ui';
import { duLieuTroGiang } from '../duLieuTroGiang';
import { useTroGiang } from '../layout/NguCanhTroGiang';
import { dinhDangNgayGio, layThongBaoLoi } from './DungChung';

function ngayGioNhap(ngay) {
  if (!ngay) return '';
  const ngayDaDoc = new Date(ngay);
  if (Number.isNaN(ngayDaDoc.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(ngayDaDoc).replace(' ', 'T');
}

const docGioVietNam = giaTri => new Date(`${giaTri.length === 16 ? `${giaTri}:00` : giaTri}+07:00`);

export default function GuiYeuCauModal({ dong, maLopBanDau = '', khiGuiThanhCong }) {
  const { duLieu, taiLaiDuLieu } = useTroGiang();
  const [bieuMau, datBieuMau] = useState({ maLop: maLopBanDau, maKyDiem: '', tuLuc: '', denLuc: '', ghiChu: '' });
  const [loi, datLoi] = useState('');
  const [dangGui, datDangGui] = useState(false);
  const dangGuiRef = useRef(false);

  const cacKyDiem = duLieu.periods.filter(kyDiem => String(kyDiem.classId) === bieuMau.maLop
    && kyDiem.status !== 'PUBLISHED' && new Date(kyDiem.closesAt) > new Date());
  const kyDaChon = cacKyDiem.find(kyDiem => String(kyDiem.assessmentId) === bieuMau.maKyDiem);
  const lopDaChon = duLieu.classes.find(lop => String(lop.id) === bieuMau.maLop);

  function doiTruong(tenTruong, giaTri) {
    datBieuMau(duLieuCu => ({ ...duLieuCu, [tenTruong]: giaTri }));
    datLoi('');
  }

  function chonLop(maLop) {
    datBieuMau(duLieuCu => ({ ...duLieuCu, maLop, maKyDiem: '', tuLuc: '', denLuc: '' }));
    datLoi('');
  }

  function chonKyDiem(maKyDiem) {
    const kyDiem = cacKyDiem.find(kyDiem => String(kyDiem.assessmentId) === maKyDiem);
    const batDau = kyDiem ? Math.max(Date.now(), new Date(kyDiem.opensAt).getTime()) : null;
    datBieuMau(duLieuCu => ({
      ...duLieuCu, maKyDiem,
      tuLuc: batDau ? ngayGioNhap(new Date(Math.ceil(batDau / 60000) * 60000)) : '',
      denLuc: ngayGioNhap(kyDiem?.closesAt),
    }));
    datLoi('');
  }

  async function guiYeuCau(suKien) {
    suKien.preventDefault();
    if (dangGuiRef.current) return;
    const { maLop, maKyDiem, tuLuc, denLuc, ghiChu } = bieuMau;
    if (!kyDaChon || !tuLuc || !denLuc || !ghiChu.trim()) {
      datLoi('Vui lòng chọn lớp, kỳ điểm, thời gian và nhập lý do.');
      return;
    }
    const batDau = docGioVietNam(tuLuc);
    const ketThuc = docGioVietNam(denLuc);
    if (!Number.isFinite(batDau.getTime()) || !Number.isFinite(ketThuc.getTime()) || ketThuc <= batDau) {
      datLoi('Thời gian kết thúc phải hợp lệ và sau thời gian bắt đầu.');
      return;
    }
    if (batDau < new Date(kyDaChon.opensAt) || ketThuc > new Date(kyDaChon.closesAt)) {
      datLoi('Thời gian đề nghị phải nằm trong kỳ nhập điểm của lớp.');
      return;
    }
    dangGuiRef.current = true;
    datDangGui(true);
    datLoi('');
    try {
      await duLieuTroGiang.guiYeuCau({ classId: maLop, assessmentId: maKyDiem,
        from: batDau.toISOString(), to: ketThuc.toISOString(), note: ghiChu.trim() });
      taiLaiDuLieu();
      khiGuiThanhCong?.();
      dong();
    } catch (loiGui) {
      datLoi(layThongBaoLoi(loiGui, 'Chưa gửi được yêu cầu. Vui lòng thử lại.'));
    } finally {
      dangGuiRef.current = false;
      datDangGui(false);
    }
  }

  return (
    <Dialog
      title="Gửi yêu cầu nhập điểm" subtitle="Yêu cầu mẫu được lưu trong trình duyệt để xem trước quy trình"
      onClose={() => !dangGuiRef.current && dong()} size="md"
    >
      <form onSubmit={guiYeuCau}>
        <fieldset className="u-form ta-request-form ta-request-fields" disabled={dangGui}>
          <SelectField
            label="Lớp" required full value={bieuMau.maLop} placeholder="Chọn lớp được phân công"
            options={duLieu.classes.map(lop => ({ value: String(lop.id), label: lop.name }))}
            onChange={suKien => chonLop(suKien.target.value)}
          />
          <SelectField
            label="Kỳ điểm" required full value={bieuMau.maKyDiem} placeholder="Chọn kỳ điểm" disabled={!bieuMau.maLop}
            options={cacKyDiem.map(kyDiem => ({ value: String(kyDiem.assessmentId), label: kyDiem.title }))}
            onChange={suKien => chonKyDiem(suKien.target.value)}
          />
          {bieuMau.maLop && !cacKyDiem.length && (
            <p className="ta-field-note" role="status">Lớp này chưa có kỳ điểm có thể gửi yêu cầu. Vui lòng liên hệ giảng viên phụ trách.</p>
          )}
          <TextField
            label="Giảng viên nhận yêu cầu" icon={UserRound} full readOnly
            value={kyDaChon?.teacher || lopDaChon?.teacher || ''} placeholder="Tự động theo lớp và kỳ điểm"
          />
          <TextField
            label="Cần nhập từ" type="datetime-local" icon={CalendarClock} required value={bieuMau.tuLuc}
            onChange={suKien => doiTruong('tuLuc', suKien.target.value)} disabled={!kyDaChon}
            min={ngayGioNhap(kyDaChon?.opensAt)} max={ngayGioNhap(kyDaChon?.closesAt)}
          />
          <TextField
            label="Đến" type="datetime-local" icon={CalendarClock} required value={bieuMau.denLuc}
            onChange={suKien => doiTruong('denLuc', suKien.target.value)} disabled={!kyDaChon}
            min={bieuMau.tuLuc || ngayGioNhap(kyDaChon?.opensAt)} max={ngayGioNhap(kyDaChon?.closesAt)}
          />
          {kyDaChon && <p className="ta-field-note">Kỳ nhập điểm: {dinhDangNgayGio(kyDaChon.opensAt)} – {dinhDangNgayGio(kyDaChon.closesAt)}</p>}
          <TextAreaField
            label="Lý do / ghi chú" required value={bieuMau.ghiChu} onChange={suKien => doiTruong('ghiChu', suKien.target.value)}
            maxLength={500} rows={3} placeholder="Ví dụ: Em hỗ trợ nhập điểm bài kiểm tra giữa kỳ cho lớp."
          />
          {loi && <p className="ta-workflow-error" role="alert">{loi}</p>}
        </fieldset>
        <div className="u-modal__foot">
          <Btn variant="muted" disabled={dangGui} onClick={dong}>Hủy</Btn>
          <Btn type="submit" icon={Send} disabled={dangGui || !kyDaChon}>{dangGui ? 'Đang gửi…' : 'Gửi yêu cầu'}</Btn>
        </div>
      </form>
    </Dialog>
  );
}
