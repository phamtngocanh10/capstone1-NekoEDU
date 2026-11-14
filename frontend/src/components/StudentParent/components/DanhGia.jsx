import { useId, useState } from 'react';
import {
  CheckCircle2,
  GraduationCap,
  HeartHandshake,
  MessageSquare,
  Send,
  ShieldCheck,
  Star,
} from 'lucide-react';
import {
  Btn as Nut,
  Card as The,
  CardHead as Dauthe,
  Chip as Nhan,
  SelectField as Ochon,
  TextAreaField as Onhapnhieudong,
} from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Trangtrong } from './DungChung';
import { dinhdangngay, tenkhoahoc } from './tienIch';
import './ca-nhan.css';

const cactieuchi = [
  {
    ma: 'chatLuongGiangDay',
    ten: 'Chất lượng giảng dạy',
    moTa: 'Nội dung bài học và cách giảng dạy của giảng viên',
  },
  { ma: 'coSoVatChat', ten: 'Cơ sở vật chất', moTa: 'Phòng học, thiết bị và không gian học tập' },
  {
    ma: 'hoTroTrungTam',
    ten: 'Hỗ trợ từ trung tâm',
    moTa: 'Sự hỗ trợ và giải đáp từ đội ngũ NEKO EDU',
  },
];
const cacmucdiem = ['Chưa hài lòng', 'Cần cải thiện', 'Bình thường', 'Hài lòng', 'Rất hài lòng'];

function Chonsosao({ ten, moTa: mota, giaTri: giatri, khiChon: khichon }) {
  const manhom = useId();
  return (
    <fieldset className="sp-rating-field" role="radiogroup" aria-label={ten}>
      <legend>{ten}</legend>
      <p>{mota}</p>
      <div className="sp-rating-field__row">
        <div className="sp-stars">
          {cacmucdiem.map((nhan, vitri) => {
            const diem = vitri + 1;
            return (
              <label key={diem} className="sp-star-choice" title={`${diem}/5 — ${nhan}`}>
                <input
                  type="radio"
                  name={manhom}
                  value={diem}
                  checked={giatri === diem}
                  aria-label={`${diem} sao — ${nhan}`}
                  onChange={() => khichon(diem)}
                />
                <span className={diem <= giatri ? 'sp-star is-on' : 'sp-star'}>
                  <Star
                    size={27}
                    fill={diem <= giatri ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  />
                </span>
              </label>
            );
          })}
        </div>
        <span className="sp-rating-field__value" aria-live="polite">
          {giatri ? `${giatri}/5 · ${cacmucdiem[giatri - 1]}` : 'Chọn mức đánh giá'}
        </span>
      </div>
    </fieldset>
  );
}

function Bieumaudanhgia({
  cacKhoaDangHoc: cackhoadanghoc,
  hocVien: hocvien,
  guiDanhGia: guidanhgia,
  thongBao: thongbao,
}) {
  const [makhoa, datmakhoa] = useState(cackhoadanghoc[0]?.ma ?? '');
  const [diemdanhgia, datdiemdanhgia] = useState({
    chatLuongGiangDay: 0,
    coSoVatChat: 0,
    hoTroTrungTam: 0,
  });
  const [nhanxet, datnhanxet] = useState('');
  const [loi, datloi] = useState('');
  const khoaduocchon = cackhoadanghoc.find((khoa) => khoa.ma === makhoa) ?? cackhoadanghoc[0];

  function guibieumau(sukien) {
    sukien.preventDefault();
    datloi('');
    if (cactieuchi.some((tieuchi) => !diemdanhgia[tieuchi.ma])) {
      datloi('Vui lòng chọn số sao cho cả ba tiêu chí trước khi gửi.');
      return;
    }
    if (!nhanxet.trim()) {
      datloi('Vui lòng chia sẻ thêm nhận xét của bạn.');
      return;
    }
    try {
      guidanhgia({ maKhoa: khoaduocchon?.ma, ...diemdanhgia, nhanXet: nhanxet.trim() });
      datdiemdanhgia({ chatLuongGiangDay: 0, coSoVatChat: 0, hoTroTrungTam: 0 });
      datnhanxet('');
      thongbao('Đã lưu đánh giá mẫu. Cảm ơn bạn đã chia sẻ trải nghiệm học tập!');
    } catch (loigui) {
      datloi(loigui.message || 'Chưa lưu được đánh giá. Vui lòng thử lại.');
    }
  }

  if (!khoaduocchon) {
    return (
      <The>
        <Trangtrong
          tieuDe="Chưa có lớp để đánh giá"
          moTa="Lớp đang theo học của học viên sẽ xuất hiện tại đây."
        />
      </The>
    );
  }

  return (
    <The className="sp-review-form">
      <Dauthe
        title={`Đánh giá lớp ${khoaduocchon.ten}`}
        sub={`Chia sẻ trải nghiệm học tập của ${hocvien.ten}`}
      />
      <form onSubmit={guibieumau}>
        <Ochon
          label="Lớp học"
          value={khoaduocchon.ma}
          options={cackhoadanghoc.map((khoa) => ({ value: khoa.ma, label: khoa.ten }))}
          onChange={(sukien) => {
            datmakhoa(sukien.target.value);
            datloi('');
          }}
        />
        <div className="sp-review-form__criteria">
          {cactieuchi.map((tieuchi) => (
            <Chonsosao
              key={tieuchi.ma}
              ten={tieuchi.ten}
              moTa={tieuchi.moTa}
              giaTri={diemdanhgia[tieuchi.ma]}
              khiChon={(diem) => datdiemdanhgia((cacdiem) => ({ ...cacdiem, [tieuchi.ma]: diem }))}
            />
          ))}
        </div>
        <Onhapnhieudong
          label="Nhận xét thêm"
          value={nhanxet}
          maxLength={1000}
          rows={4}
          placeholder={`Chia sẻ trải nghiệm học tập của ${hocvien.ten}...`}
          onChange={(sukien) => datnhanxet(sukien.target.value)}
        />
        <div className="sp-review-form__count">{nhanxet.length}/1000 ký tự</div>
        {loi && (
          <p className="sp-error" role="alert">
            {loi}
          </p>
        )}
        <div className="sp-review-form__footer">
          <p>Đánh giá được lưu trong bản mẫu trên trình duyệt này.</p>
          <Nut type="submit" icon={Send}>
            Gửi đánh giá
          </Nut>
        </div>
      </form>
    </The>
  );
}

function Diemdanhgia({ danhGia: danhgia }) {
  const diemtrungbinh =
    (danhgia.chatLuongGiangDay + danhgia.coSoVatChat + danhgia.hoTroTrungTam) / 3;
  return (
    <span
      className="sp-review-score"
      aria-label={`Đánh giá trung bình ${diemtrungbinh.toFixed(1)} trên 5 sao`}
    >
      {Array.from({ length: 5 }, (_, vitri) => (
        <Star
          key={vitri}
          size={14}
          fill={vitri + 1 <= Math.round(diemtrungbinh) ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      ))}
      <strong>{diemtrungbinh.toFixed(1)}/5</strong>
    </span>
  );
}

export default function Danhgia() {
  const {
    duLieu: dulieu,
    hocVien: hocvien,
    cacKhoaDangHoc: cackhoadanghoc,
    guiDanhGia: guidanhgia,
    thongBao: thongbao,
  } = useHocvienphuhuynh();
  const cacdanhgia = dulieu.danhGia
    .filter((danhgia) => danhgia.maHocVien === hocvien.ma)
    .sort((truoc, sau) => new Date(sau.ngayGui) - new Date(truoc.ngayGui));

  return (
    <div className="sp-page sp-reviews">
      <div className="sp-split sp-reviews__top">
        <Bieumaudanhgia
          key={hocvien.ma}
          {...{
            cacKhoaDangHoc: cackhoadanghoc,
            hocVien: hocvien,
            guiDanhGia: guidanhgia,
            thongBao: thongbao,
          }}
        />
        <aside className="sp-stack">
          <The className="sp-review-benefits">
            <span className="sp-review-benefits__icon">
              <HeartHandshake size={24} />
            </span>
            <h2>Vì sao đánh giá của bạn quan trọng?</h2>
            <ul>
              <li>
                <GraduationCap size={19} />
                <span>Giúp trung tâm cải thiện chất lượng giảng dạy từng lớp học.</span>
              </li>
              <li>
                <CheckCircle2 size={19} />
                <span>Hỗ trợ Manager theo dõi hiệu quả giảng viên chính xác hơn.</span>
              </li>
              <li>
                <ShieldCheck size={19} />
                <span>Mọi đánh giá đều ẩn danh với giảng viên đứng lớp.</span>
              </li>
            </ul>
          </The>
          <div className="sp-note sp-review-note">
            <MessageSquare size={19} />
            <span>Mỗi góp ý là một bước giúp trải nghiệm học tập của con tốt hơn.</span>
          </div>
        </aside>
      </div>

      <The>
        <Dauthe title="Đánh giá đã gửi" sub={`Lịch sử đánh giá của ${hocvien.ten}`} />
        {cacdanhgia.length ? (
          <div className="sp-review-history">
            {cacdanhgia.map((danhgia) => (
              <article className="sp-review-history__item" key={danhgia.ma}>
                <div className="sp-review-history__top">
                  <div>
                    <strong>{tenkhoahoc(dulieu, danhgia.maKhoa)}</strong>
                    <span>{dinhdangngay(danhgia.ngayGui)}</span>
                  </div>
                  <Diemdanhgia danhGia={danhgia} />
                </div>
                <p>{danhgia.nhanXet}</p>
                <div className="sp-review-history__bottom">
                  <Nhan tone="green" icon={CheckCircle2}>
                    Đã gửi
                  </Nhan>
                  <span>
                    Giảng dạy {danhgia.chatLuongGiangDay}/5 · Cơ sở vật chất {danhgia.coSoVatChat}/5
                    · Hỗ trợ {danhgia.hoTroTrungTam}/5
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Trangtrong
            tieuDe="Chưa có đánh giá"
            moTa="Đánh giá bạn gửi cho học viên này sẽ được lưu tại đây."
          />
        )}
      </The>
    </div>
  );
}
