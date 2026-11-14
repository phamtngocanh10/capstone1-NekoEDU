import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  CreditCard,
  FileText,
  GraduationCap,
} from 'lucide-react';
import {
  Btn as Nut,
  Card as The,
  Chip as Nhan,
  Pills as Boloc,
  SearchBox as Otimkiem,
} from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Trangtrong } from './DungChung';
import { dinhdangngaygio, loctheotukhoa } from './tienIch';
import './hoc-phi-thong-bao.css';

const bieutuongloai = {
  hocPhi: CreditCard,
  lichHoc: CalendarDays,
  ketQua: GraduationCap,
  chung: Bell,
};

export default function Thongbao() {
  const {
    cacThongBao: cacthongbao,
    docTatCaThongBao: doctatcathongbao,
    thongBao: hienthongbao,
  } = useHocvienphuhuynh();
  const [boloc, datboloc] = useState('tatCa');
  const [tukhoa, dattukhoa] = useState('');
  const [loi, datloi] = useState('');
  const sochuadoc = cacthongbao.filter((muc) => !muc.daDoc).length;
  const cacmucloc = [
    { value: 'tatCa', label: 'Tất cả' },
    { value: 'chuaDoc', label: `Chưa đọc (${sochuadoc})` },
    { value: 'hocPhi', label: 'Học phí' },
    { value: 'lichHoc', label: 'Lịch học' },
    { value: 'ketQua', label: 'Kết quả học tập' },
  ];
  const cacmuchienthi = loctheotukhoa(
    cacthongbao,
    tukhoa,
    (muc) => `${muc.tieuDe} ${muc.tomTat}`
  ).filter((muc) => boloc === 'tatCa' || (boloc === 'chuaDoc' ? !muc.daDoc : muc.loai === boloc));

  function danhdautatca() {
    datloi('');
    try {
      doctatcathongbao();
      hienthongbao('Đã đánh dấu các thông báo của học viên đang chọn là đã đọc.');
    } catch (loiluu) {
      datloi(loiluu.message);
    }
  }

  return (
    <div className="sp-page sp-notifications">
      <div className="sp-toolbar">
        <Boloc items={cacmucloc} value={boloc} onChange={datboloc} />
        <Nut
          icon={CheckCheck}
          variant="ghost"
          size="sm"
          onClick={danhdautatca}
          disabled={!sochuadoc}
        >
          Đánh dấu tất cả đã đọc
        </Nut>
      </div>
      <Otimkiem value={tukhoa} onChange={dattukhoa} placeholder="Tìm thông báo..." />
      {loi && (
        <p className="sp-error" role="alert">
          {loi}
        </p>
      )}
      <The pad={false} className="sp-notification-list">
        {cacmuchienthi.length ? (
          cacmuchienthi.map((muc) => {
            const Bieutuong = bieutuongloai[muc.loai] || Bell;
            return (
              <Link
                key={muc.ma}
                to={`/student/thongbao/${muc.ma}`}
                className={`sp-notification-row ${muc.daDoc ? '' : 'is-unread'}`}
              >
                <span className={`sp-notification-icon sp-notification-icon--${muc.loai}`}>
                  <Bieutuong size={21} />
                </span>
                <span className="sp-notification-main">
                  <span className="sp-notification-title">
                    {!muc.daDoc && <span className="sp-unread-dot" aria-label="Chưa đọc" />}
                    {muc.tieuDe}
                    {muc.quanTrong && (
                      <Nhan tone="amber" size="xs">
                        Quan trọng
                      </Nhan>
                    )}
                  </span>
                  <span className="sp-notification-summary">{muc.tomTat}</span>
                </span>
                <span className="sp-notification-meta">
                  <time dateTime={muc.ngayGui}>{dinhdangngaygio(muc.ngayGui)}</time>
                  {Boolean(muc.tepDinhKem?.length) && (
                    <small>
                      <FileText size={12} /> {muc.tepDinhKem.length} tệp
                    </small>
                  )}
                </span>
                <ChevronRight className="sp-notification-chevron" size={16} />
              </Link>
            );
          })
        ) : (
          <Trangtrong
            tieuDe={
              boloc === 'chuaDoc' && !tukhoa
                ? 'Bạn đã đọc hết thông báo'
                : 'Không có thông báo phù hợp'
            }
            moTa="Thử đổi bộ lọc hoặc từ khóa tìm kiếm để xem thêm."
          />
        )}
      </The>
      {cacmuchienthi.length > 0 && (
        <p className="sp-list-caption">
          Đã hiển thị {cacmuchienthi.length} thông báo · Nhấn vào tiêu đề để xem nội dung và tệp
          đính kèm.
        </p>
      )}
    </div>
  );
}
