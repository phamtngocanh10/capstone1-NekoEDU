import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Download, MessageSquare } from 'lucide-react';
import { BackLink as Nutquaylai, Btn as Nut, Card as The, Chip as Nhan } from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Tepdinhkem, Tieudekhoi, Trangtrong } from './DungChung';
import { dinhdangngaygio, taitailieu } from './tienIch';
import './hoc-phi-thong-bao.css';

const tenloai = {
  hocPhi: 'Học phí',
  lichHoc: 'Lịch học',
  ketQua: 'Kết quả học tập',
  chung: 'Thông báo chung',
};

export default function Chitietthongbao() {
  const { maThongBao: mathongbao } = useParams();
  const {
    hocVien: hocvien,
    cacThongBao: cacthongbao,
    danhDauThongBao: danhdauthongbao,
    thongBao: hienthongbao,
  } = useHocvienphuhuynh();
  const [loi, datloi] = useState('');
  const madamoref = useRef('');
  const mucthongbao = cacthongbao.find((muc) => muc.ma === mathongbao);

  useEffect(() => {
    const khoatrang = `${hocvien.ma}:${mathongbao}`;
    if (!mucthongbao || madamoref.current === khoatrang) return;
    madamoref.current = khoatrang;
    datloi('');
    if (!mucthongbao.daDoc) {
      try {
        danhdauthongbao(mathongbao);
      } catch (loiluu) {
        datloi(loiluu.message);
      }
    }
  }, [hocvien.ma, mathongbao, mucthongbao, danhdauthongbao]);

  if (!mucthongbao)
    return (
      <Trangtrong
        tieuDe="Không tìm thấy thông báo"
        moTa="Thông báo không tồn tại hoặc không thuộc học viên đang chọn."
      >
        <Nut to="/student/thongbao" variant="soft">
          Về danh sách thông báo
        </Nut>
      </Trangtrong>
    );

  const vitri = cacthongbao.findIndex((muc) => muc.ma === mathongbao);
  const muctruoc = cacthongbao[vitri - 1];
  const mucsau = cacthongbao[vitri + 1];
  const cactep = mucthongbao.tepDinhKem ?? [];
  const cacthongbaokhac = cacthongbao.filter((muc) => muc.ma !== mathongbao).slice(0, 3);
  const cacdoan = Array.isArray(mucthongbao.noiDung)
    ? mucthongbao.noiDung
    : String(mucthongbao.noiDung ?? '').split(/\n\s*\n/);

  function doitrangthaidoc() {
    datloi('');
    try {
      danhdauthongbao(mathongbao, !mucthongbao.daDoc);
      hienthongbao(
        mucthongbao.daDoc
          ? 'Đã đánh dấu thông báo là chưa đọc.'
          : 'Đã đánh dấu thông báo là đã đọc.'
      );
    } catch (loiluu) {
      datloi(loiluu.message);
    }
  }

  function taitatcatep() {
    datloi('');
    try {
      cactep.forEach((tep) => taitailieu(tep));
      hienthongbao(`Đã tạo ${cactep.length} tệp tải xuống từ dữ liệu mẫu.`);
    } catch (loitai) {
      datloi(loitai.message);
    }
  }

  return (
    <div className="sp-page sp-notification-detail">
      <div className="sp-toolbar">
        <Nutquaylai to="/student/thongbao">Quay lại danh sách thông báo</Nutquaylai>
        <div className="sp-notification-paging">
          <Nut
            variant="icon"
            icon={ChevronLeft}
            to={muctruoc ? `/student/thongbao/${muctruoc.ma}` : undefined}
            disabled={!muctruoc}
            aria-label="Thông báo trước"
          />
          <span>
            {vitri + 1} / {cacthongbao.length}
          </span>
          <Nut
            variant="icon"
            icon={ChevronRight}
            to={mucsau ? `/student/thongbao/${mucsau.ma}` : undefined}
            disabled={!mucsau}
            aria-label="Thông báo sau"
          />
        </div>
      </div>
      {loi && (
        <p className="sp-error" role="alert">
          {loi}
        </p>
      )}
      <div className="sp-split">
        <The className="sp-notification-content">
          <div className="sp-notification-chips">
            <Nhan tone="blue">{tenloai[mucthongbao.loai] || tenloai.chung}</Nhan>
            {mucthongbao.quanTrong && <Nhan tone="amber">Quan trọng</Nhan>}
          </div>
          <h2>{mucthongbao.tieuDe}</h2>
          <div className="sp-notification-sender">
            <span className="sp-sender-avatar">{mucthongbao.nguoiGui?.charAt(0) || 'N'}</span>
            <div>
              <strong>{mucthongbao.nguoiGui} · NEKO EDU</strong>
              <small>
                {dinhdangngaygio(mucthongbao.ngayGui)} · Gửi tới: {mucthongbao.doiTuong}
              </small>
            </div>
          </div>
          <div className="sp-notification-body">
            {cacdoan.map((doan, chiso) => (
              <p key={chiso}>{doan}</p>
            ))}
          </div>
          {cactep.length > 0 && (
            <section className="sp-notification-attachments">
              <Tieudekhoi tieuDe={`Tệp đính kèm (${cactep.length})`}>
                <Nut size="xs" variant="ghost" icon={Download} onClick={taitatcatep}>
                  Tải tất cả
                </Nut>
              </Tieudekhoi>
              <div className="sp-stack">
                {cactep.map((tep) => (
                  <Tepdinhkem key={tep.ma} tep={tep} />
                ))}
              </div>
            </section>
          )}
          <div className="sp-notification-footer">
            <span className="sp-read-state">
              <CheckCheck size={16} />
              {mucthongbao.daDoc
                ? 'Bạn đã đọc thông báo này'
                : 'Thông báo đang được đánh dấu chưa đọc'}
            </span>
            <div>
              <Nut size="sm" variant="ghost" onClick={doitrangthaidoc}>
                {mucthongbao.daDoc ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
              </Nut>
              <Nut size="sm" icon={MessageSquare} to={`/student/thongbao/${mathongbao}/phanhoi`}>
                Phản hồi trung tâm
              </Nut>
            </div>
          </div>
        </The>
        <aside className="sp-stack">
          <The>
            <Tieudekhoi tieuDe="Thông tin thông báo" />
            <dl className="sp-notification-info">
              {[
                ['Người gửi', mucthongbao.nguoiGui],
                ['Ngày gửi', dinhdangngaygio(mucthongbao.ngayGui)],
                ['Đối tượng', mucthongbao.doiTuong],
                ['Loại', tenloai[mucthongbao.loai] || tenloai.chung],
                ['Mức ưu tiên', mucthongbao.quanTrong ? 'Quan trọng' : 'Thông thường'],
                ['Tệp đính kèm', `${cactep.length} tệp`],
              ].map(([nhan, giatri]) => (
                <div key={nhan}>
                  <dt>{nhan}</dt>
                  <dd>{giatri}</dd>
                </div>
              ))}
            </dl>
          </The>
          {cacthongbaokhac.length > 0 && (
            <The>
              <Tieudekhoi tieuDe="Thông báo khác" />
              <div className="sp-related-notifications">
                {cacthongbaokhac.map((muc) => (
                  <Link key={muc.ma} to={`/student/thongbao/${muc.ma}`}>
                    <Bell size={16} />
                    <span>
                      <strong>{muc.tieuDe}</strong>
                      <small>{dinhdangngaygio(muc.ngayGui)}</small>
                    </span>
                    <ChevronRight size={14} />
                  </Link>
                ))}
              </div>
            </The>
          )}
        </aside>
      </div>
    </div>
  );
}
