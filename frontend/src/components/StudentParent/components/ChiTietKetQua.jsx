import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  MessageSquareQuote,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { BackLink as Nutquaylai, Btn as Nut, Card as The, Chip as Nhan } from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Tepdinhkem, Tieudekhoi, Trangtrong } from './DungChung';
import { dinhdangngay, taibaocaopdf, tenkhoahoc } from './tienIch';
import './hoc-tap.css';

function tylediem(diem) {
  return Math.max(0, Math.min(10, diem)) / 10;
}

function Bieudokynang({ cackynang }) {
  return (
    <>
      <Tieudekhoi tieuDe="Điểm theo kỹ năng">
        <div className="sp-skill-legend">
          <span>
            <i />
            Bạn
          </span>
          <span>
            <i className="is-average" />
            Trung bình lớp
          </span>
        </div>
      </Tieudekhoi>
      <div className="sp-result-skills">
        {cackynang.map((kynang) => (
          <div className="sp-result-skill" key={kynang.ten}>
            <div>
              <strong>{kynang.ten}</strong>
              <span>
                <b>{Number(kynang.diem).toFixed(1)}</b>
                <small>TB lớp {Number(kynang.trungBinhLop).toFixed(1)}</small>
              </span>
            </div>
            <div
              className="sp-result-skill__track"
              role="img"
              aria-label={`${kynang.ten}: ${kynang.diem}/10, trung bình lớp ${kynang.trungBinhLop}/10`}
            >
              <span
                className="sp-result-skill__average"
                style={{ width: `${tylediem(kynang.trungBinhLop) * 100}%` }}
              />
              <span
                className="sp-result-skill__personal"
                style={{ width: `${tylediem(kynang.diem) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="sp-skill-scale" aria-hidden="true">
        {[0, 2, 4, 6, 8, 10].map((moc) => (
          <span key={moc}>{moc}</span>
        ))}
      </div>
    </>
  );
}

function Duongtienbo({ cacKetQua: cacketqua }) {
  const rong = 320;
  const cao = 180;
  const le = 28;
  const daybieudo = cao - le;
  const caovungve = cao - le * 2;

  function tinhtungdo(diem) {
    return daybieudo - tylediem(diem) * caovungve;
  }

  const cacdiem = cacketqua.map((ketqua, chiso) => ({
    x: cacketqua.length === 1 ? rong / 2 : le + (chiso / (cacketqua.length - 1)) * (rong - le * 2),
    y: tinhtungdo(ketqua.diemTong),
    ketQua: ketqua,
  }));
  const duongdiem = cacdiem.map((diem) => `${diem.x},${diem.y}`).join(' ');

  return (
    <figure className="sp-result-trend">
      <svg
        viewBox={`0 0 ${rong} ${cao + 12}`}
        role="img"
        aria-label={`Tiến bộ điểm tổng: ${cacketqua.map((ketqua) => `${dinhdangngay(ketqua.ngay)}, ${ketqua.diemTong}/10`).join('; ')}`}
      >
        {[0, 5, 10].map((moc) => {
          const tungdo = tinhtungdo(moc);
          return (
            <g key={moc}>
              <line
                x1={le}
                x2={rong - le}
                y1={tungdo}
                y2={tungdo}
                className="sp-result-trend__grid"
              />
              <text x={5} y={tungdo + 4}>
                {moc}
              </text>
            </g>
          );
        })}
        {cacdiem.length > 1 && (
          <polygon
            points={`${cacdiem[0].x},${daybieudo} ${duongdiem} ${cacdiem.at(-1).x},${daybieudo}`}
            className="sp-result-trend__area"
          />
        )}
        <polyline points={duongdiem} className="sp-result-trend__line" />
        {cacdiem.map(({ x: hoanhdo, y: tungdo, ketQua: ketqua }) => (
          <g key={ketqua.ma}>
            <circle cx={hoanhdo} cy={tungdo} r={4} className="sp-result-trend__point" />
            <text
              x={hoanhdo}
              y={tungdo - 12}
              textAnchor="middle"
              className="sp-result-trend__score"
            >
              {Number(ketqua.diemTong).toFixed(1)}
            </text>
            <text x={hoanhdo} y={cao} textAnchor="middle">
              {dinhdangngay(ketqua.ngay, { year: undefined })}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>Thang điểm 0–10 · Các bài kiểm tra đến ngày đang xem</figcaption>
    </figure>
  );
}

export default function Chitietketqua() {
  const { maKetQua: maketqua } = useParams();
  const { duLieu: dulieu, hocVien: hocvien } = useHocvienphuhuynh();
  const [loi, datloi] = useState('');
  const ketqua = dulieu.ketQua.find((bai) => bai.ma === maketqua && bai.maHocVien === hocvien.ma);

  if (!ketqua)
    return (
      <div className="sp-page">
        <Nutquaylai to="/student/ketqua">Điểm danh & Kết quả</Nutquaylai>
        <Trangtrong
          tieuDe="Không tìm thấy kết quả học tập"
          moTa={`Bài kiểm tra này không thuộc học viên ${hocvien.ten} đang được chọn.`}
        >
          <Nut variant="soft" to="/student/ketqua">
            Xem kết quả của học viên
          </Nut>
        </Trangtrong>
      </div>
    );

  const khoahoc = dulieu.khoaHoc.find((khoa) => khoa.ma === ketqua.maKhoa);
  const lichsuketqua = dulieu.ketQua
    .filter(
      (bai) =>
        bai.maHocVien === hocvien.ma && bai.maKhoa === ketqua.maKhoa && bai.ngay <= ketqua.ngay
    )
    .sort((truoc, sau) => truoc.ngay.localeCompare(sau.ngay));
  const tepdinhkem = dulieu.taiLieu.find(
    (tep) => tep.ma === ketqua.maTaiLieu && tep.maKhoa === ketqua.maKhoa
  );

  function taiphieudiem() {
    try {
      taibaocaopdf(`phieu-diem-${hocvien.maSo}-${ketqua.ma}.pdf`, ketqua.tieuDe, [
        'NEKO EDU — PHIẾU ĐIỂM MẪU',
        `Học viên: ${hocvien.ten} (${hocvien.maSo})`,
        `Khóa học: ${tenkhoahoc(dulieu, ketqua.maKhoa)}`,
        `Ngày kiểm tra: ${dinhdangngay(ketqua.ngay)}`,
        `Điểm tổng: ${Number(ketqua.diemTong).toFixed(1)}/10 | Hạng ${ketqua.hang}/${ketqua.siSo}`,
        ...ketqua.kyNang.map(
          (kynang) =>
            `${kynang.ten}: ${Number(kynang.diem).toFixed(1)}/10 | Trung bình lớp ${Number(kynang.trungBinhLop).toFixed(1)}`
        ),
        `Nhận xét của giảng viên: ${ketqua.nhanXet}`,
        ...ketqua.goiY.map((goiy) => `Gợi ý: ${goiy}`),
      ]);
      datloi('');
    } catch (loitai) {
      datloi(loitai.message || 'Chưa tải được phiếu điểm.');
    }
  }

  return (
    <div className="sp-page sp-study-page">
      <Nutquaylai to="/student/ketqua">Điểm danh & Kết quả</Nutquaylai>
      <The className="sp-result-hero">
        <div className="sp-stack">
          <Nhan tone="green" icon={CheckCircle2}>
            Đã công bố
          </Nhan>
          <h2>{ketqua.tieuDe}</h2>
          <p>
            {dinhdangngay(ketqua.ngay)} · {tenkhoahoc(dulieu, ketqua.maKhoa)}
          </p>
          <span className="sp-study-meta">
            <Award size={15} />
            {hocvien.ten} · {khoahoc?.giangVien}
          </span>
        </div>
        <div className="sp-result-total">
          <span>Điểm tổng</span>
          <strong>
            {Number(ketqua.diemTong).toFixed(1)}
            <small>/ 10</small>
          </strong>
          <Nhan tone="amber" icon={Trophy}>
            Hạng {ketqua.hang} / {ketqua.siSo}
          </Nhan>
        </div>
        <Nut icon={Download} variant="soft" onClick={taiphieudiem}>
          Tải phiếu điểm (PDF)
        </Nut>
      </The>
      {loi && (
        <p className="sp-error" role="alert">
          {loi}
        </p>
      )}

      <div className="sp-result-detail-grid">
        <The className="sp-stack">
          <Bieudokynang cackynang={ketqua.kyNang} />
          <Tieudekhoi tieuDe="Nhận xét của giảng viên" />
          <div className="sp-teacher-comment">
            <MessageSquareQuote size={23} />
            <p>{ketqua.nhanXet || 'Chưa có nhận xét chi tiết.'}</p>
            <small>
              {khoahoc?.giangVien} · {dinhdangngay(ketqua.ngay)}
            </small>
          </div>
          {tepdinhkem && (
            <div className="sp-stack">
              <Tieudekhoi tieuDe="Tệp đính kèm (1)" />
              <Tepdinhkem tep={tepdinhkem} />
            </div>
          )}
        </The>
        <aside className="sp-stack">
          <The>
            <Tieudekhoi tieuDe="Tiến bộ điểm tổng">
              <TrendingUp size={17} />
            </Tieudekhoi>
            <Duongtienbo cacKetQua={lichsuketqua} />
          </The>
          <The className="sp-stack">
            <Tieudekhoi tieuDe="Gợi ý luyện tập" />
            <ul className="sp-result-suggestions">
              {ketqua.goiY.map((goiy) => (
                <li key={goiy}>
                  <CheckCircle2 size={17} />
                  <span>{goiy}</span>
                </li>
              ))}
            </ul>
            <Nut variant="soft" icon={BookOpen} to={`/student/tailieu?khoa=${ketqua.maKhoa}`}>
              Xem tài liệu gợi ý
            </Nut>
          </The>
        </aside>
      </div>
    </div>
  );
}
