import { useState } from 'react';
import { Bell, CheckCheck, Search } from 'lucide-react';
import { Btn, Card, Chip, Pills, SearchBox } from '../../../common/ui';
import { norm as chuanHoaChuoi } from '../../../common/format';
import { useManager as useNguCanhTaiKhoan } from '../../Manager/layout/ManagerContext';
import { duLieuTroGiang } from '../duLieuTroGiang';
import { dinhDangNgayGio, TrangThaiTaiDuLieu, TrangThaiTrong, useTaiDuLieu } from './DungChung';

function NoiDungThongBao({ thongBao }) {
  return (
    <article className={`ta-notification-item ${!thongBao.read ? 'is-unread' : ''}`}>
      <span className="ta-notification-item__icon">
        <Bell size={20} />
      </span>
      <div>
        <div className="ta-notification-item__heading">
          <h2>{thongBao.title}</h2>
          {!thongBao.read && <Chip tone="blue">Chưa đọc</Chip>}
        </div>
        <p>{thongBao.text}</p>
        <time dateTime={thongBao.time}>{dinhDangNgayGio(thongBao.time)}</time>
      </div>
    </article>
  );
}

function KhongCoThongBao({ tuKhoa, boLoc }) {
  let tieuDe = 'Chưa có thông báo';
  let moTa = 'Thông báo từ trung tâm và giảng viên sẽ xuất hiện tại đây.';

  if (tuKhoa) {
    tieuDe = 'Không tìm thấy thông báo';
    moTa = 'Thử tìm bằng một từ khóa khác.';
  } else if (boLoc === 'chuaDoc') {
    tieuDe = 'Bạn đã đọc hết thông báo';
  }

  return (
    <TrangThaiTrong
      bieuTuong={tuKhoa ? Search : Bell}
      tieuDe={tieuDe}
      moTa={moTa}
    />
  );
}

export default function ThongBaoTroGiang() {
  const duLieuThongBao = useTaiDuLieu(duLieuTroGiang.layThongBao);
  const [boLoc, datBoLoc] = useState('tatCa');
  const [tuKhoa, datTuKhoa] = useState('');
  const [dangCapNhat, datDangCapNhat] = useState(false);
  const [loiCapNhat, datLoiCapNhat] = useState('');
  const { notify: hienThongBao } = useNguCanhTaiKhoan();

  const danhSach = duLieuThongBao.duLieu?.items ?? [];
  const soChuaDoc = duLieuThongBao.duLieu?.unread ?? 0;
  const tuKhoaChuanHoa = chuanHoaChuoi(tuKhoa);
  const thongBaoHienThi = danhSach.filter(thongBao => {
    const dungBoLoc = boLoc === 'tatCa' || !thongBao.read;
    const noiDung = chuanHoaChuoi(`${thongBao.title} ${thongBao.text}`);
    return dungBoLoc && noiDung.includes(tuKhoaChuanHoa);
  });
  const cacBoLoc = [
    { value: 'tatCa', label: `Tất cả (${danhSach.length})` },
    { value: 'chuaDoc', label: `Chưa đọc (${soChuaDoc})` },
  ];

  async function docTatCaThongBao() {
    datDangCapNhat(true);
    datLoiCapNhat('');
    try {
      await duLieuTroGiang.danhDauTatCaDaDoc();
      duLieuThongBao.taiLai();
      hienThongBao('Đã đánh dấu tất cả thông báo là đã đọc');
    } catch (loi) {
      datLoiCapNhat(loi.message);
    } finally {
      datDangCapNhat(false);
    }
  }

  return (
    <div className="u-page ta-notifications">
      <div className="ta-toolbar ta-toolbar--between">
        <Pills items={cacBoLoc} value={boLoc} onChange={datBoLoc} />
        <Btn
          icon={CheckCheck}
          variant="soft"
          disabled={dangCapNhat || !soChuaDoc}
          onClick={docTatCaThongBao}
        >
          {dangCapNhat ? 'Đang cập nhật…' : 'Đánh dấu tất cả đã đọc'}
        </Btn>
      </div>

      <SearchBox
        value={tuKhoa}
        onChange={datTuKhoa}
        placeholder="Tìm thông báo..."
      />
      {loiCapNhat && <p className="ta-error" role="alert">{loiCapNhat}</p>}

      {duLieuThongBao.dangTai || duLieuThongBao.loi ? (
        <TrangThaiTaiDuLieu
          loi={duLieuThongBao.loi}
          thuLai={duLieuThongBao.taiLai}
        />
      ) : (
        <Card pad={false}>
          {thongBaoHienThi.length ? (
            thongBaoHienThi.map(thongBao => (
              <NoiDungThongBao key={thongBao.id} thongBao={thongBao} />
            ))
          ) : (
            <KhongCoThongBao tuKhoa={tuKhoa} boLoc={boLoc} />
          )}
        </Card>
      )}
    </div>
  );
}
