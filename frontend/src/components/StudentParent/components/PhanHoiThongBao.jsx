import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCheck, MessageSquare, Send } from 'lucide-react';
import {
  BackLink as Nutquaylai,
  Btn as Nut,
  Card as The,
  Chip as Nhan,
  TextAreaField as Onhapnhieudong,
} from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Tieudekhoi, Trangtrong } from './DungChung';
import { dinhdangngaygio } from './tienIch';
import './hoc-phi-thong-bao.css';

export default function Phanhoithongbao() {
  const { maThongBao: mathongbao } = useParams();
  const {
    duLieu: dulieu,
    hocVien: hocvien,
    cacThongBao: cacthongbao,
    guiPhanHoi: guiphanhoi,
    thongBao: hienthongbao,
  } = useHocvienphuhuynh();
  const [noidung, datnoidung] = useState('');
  const [loi, datloi] = useState('');
  const mucthongbao = cacthongbao.find((muc) => muc.ma === mathongbao);
  useEffect(() => {
    datnoidung('');
    datloi('');
  }, [hocvien.ma, mathongbao]);
  if (!mucthongbao)
    return (
      <Trangtrong
        tieuDe="Không tìm thấy thông báo"
        moTa="Chọn một thông báo của học viên hiện tại để gửi phản hồi."
      >
        <Nut to="/student/thongbao" variant="soft">
          Về danh sách thông báo
        </Nut>
      </Trangtrong>
    );
  const cacphanhoi = dulieu.phanHoiThongBao.filter(
    (muc) => muc.maThongBao === mathongbao && muc.maHocVien === hocvien.ma
  );

  function guinoidung(sukien) {
    sukien.preventDefault();
    datloi('');
    try {
      guiphanhoi({ maThongBao: mathongbao, noiDung: noidung.trim() });
      datnoidung('');
      hienthongbao('Đã lưu phản hồi mẫu. Nội dung chưa được gửi đến trung tâm.');
    } catch (loiluu) {
      datloi(loiluu.message);
    }
  }

  return (
    <div className="sp-page sp-notification-reply" key={`${hocvien.ma}:${mathongbao}`}>
      <Nutquaylai to={`/student/thongbao/${mathongbao}`}>Chi tiết thông báo</Nutquaylai>
      <The className="sp-reply-card">
        <div className="sp-reply-about">
          <MessageSquare size={23} />
          <div>
            <h2>Về thông báo: {mucthongbao.tieuDe}</h2>
            <p>
              {mucthongbao.nguoiGui} · NEKO EDU · {dinhdangngaygio(mucthongbao.ngayGui)}
            </p>
            {mucthongbao.quanTrong && <Nhan tone="amber">Quan trọng</Nhan>}
          </div>
        </div>
        <form onSubmit={guinoidung} className="sp-stack">
          <Onhapnhieudong
            label="Nội dung phản hồi của bạn"
            placeholder="Nhập câu hỏi hoặc phản hồi của bạn về thông báo này..."
            value={noidung}
            onChange={(sukien) => datnoidung(sukien.target.value)}
            required
            maxLength={2000}
            rows={6}
          />
          <span className="sp-reply-counter">{noidung.length}/2000 ký tự</span>
          <p className="sp-note">
            Bản mẫu lưu phản hồi trên trình duyệt để bạn xem lại. Trung tâm chưa nhận được nội dung
            này.
          </p>
          {loi && (
            <p className="sp-error" role="alert">
              {loi}
            </p>
          )}
          <div>
            <Nut type="submit" icon={Send} disabled={!noidung.trim()}>
              Gửi phản hồi
            </Nut>
          </div>
        </form>
      </The>
      <The className="sp-reply-history">
        <Tieudekhoi
          tieuDe="Phản hồi đã gửi"
          moTa={`Lịch sử phản hồi của ${hocvien.ten} cho thông báo này`}
        />
        {cacphanhoi.length ? (
          <div>
            {[...cacphanhoi].reverse().map((muc) => (
              <article key={muc.ma}>
                <div className="sp-toolbar">
                  <strong>{hocvien.ten}</strong>
                  <span>
                    <CheckCheck size={14} /> Đã lưu trong bản mẫu
                  </span>
                </div>
                <p>{muc.noiDung}</p>
                <time dateTime={muc.ngayGui}>{dinhdangngaygio(muc.ngayGui)}</time>
              </article>
            ))}
          </div>
        ) : (
          <Trangtrong
            tieuDe="Chưa có phản hồi"
            moTa="Phản hồi bạn gửi trong bản mẫu sẽ được hiển thị ở đây."
          />
        )}
      </The>
    </div>
  );
}
