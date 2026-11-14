import { useState } from 'react';
import { Award, CalendarCheck, Download, Eye, TrendingUp } from 'lucide-react';
import {
  Btn as Nut,
  Card as The,
  Chip as Nhan,
  DataTable as Bangdulieu,
  SelectField as Ochon,
} from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Tieudekhoi, Trangtrong } from './DungChung';
import { dinhdangngay, ngayhomnay, taibaocaopdf, tenkhoahoc } from './tienIch';
import './hoc-tap.css';

const nhandiemdanh = {
  coMat: { nhan: 'Có mặt', mau: 'green' },
  diTre: { nhan: 'Đi trễ', mau: 'amber' },
  vangCoPhep: { nhan: 'Vắng có phép', mau: 'blue' },
  vangKhongPhep: { nhan: 'Vắng không phép', mau: 'red' },
};

function Chuyencan({ cacBuoi: cacbuoi, thangDangXem: thangdangxem }) {
  const socomat = cacbuoi.filter((buoi) => ['coMat', 'diTre'].includes(buoi.trangThai)).length;
  const soditre = cacbuoi.filter((buoi) => buoi.trangThai === 'diTre').length;
  const sovangcophep = cacbuoi.filter((buoi) => buoi.trangThai === 'vangCoPhep').length;
  const sovangkhongphep = cacbuoi.filter((buoi) => buoi.trangThai === 'vangKhongPhep').length;
  const tyle = cacbuoi.length ? Math.round((socomat / cacbuoi.length) * 100) : 0;
  const chuvi = 2 * Math.PI * 56;

  return (
    <The className="sp-attendance-summary">
      <Tieudekhoi tieuDe={`Chuyên cần tháng ${Number(thangdangxem.slice(5))}`} />
      {cacbuoi.length ? (
        <>
          <div
            className="sp-attendance-donut"
            role="img"
            aria-label={`Chuyên cần ${tyle}%, có mặt ${socomat} trên ${cacbuoi.length} buổi`}
          >
            <svg viewBox="0 0 144 144" aria-hidden="true">
              <circle className="sp-attendance-donut__track" cx="72" cy="72" r="56" />
              <circle
                className="sp-attendance-donut__value"
                cx="72"
                cy="72"
                r="56"
                strokeDasharray={chuvi}
                strokeDashoffset={chuvi * (1 - tyle / 100)}
              />
            </svg>
            <div>
              <strong>{tyle}%</strong>
              <span>
                {socomat}/{cacbuoi.length} buổi
              </span>
            </div>
          </div>
          <div className="sp-attendance-counts">
            <span>
              <i className="is-present" />
              Có mặt <strong>{socomat}</strong>
            </span>
            <span>
              <i className="is-excused" />
              Vắng có phép <strong>{sovangcophep}</strong>
            </span>
            <span>
              <i className="is-absent" />
              Vắng không phép <strong>{sovangkhongphep}</strong>
            </span>
          </div>
          {soditre > 0 && (
            <p className="sp-muted sp-attendance-late">
              Có {soditre} buổi đi trễ, được tính vào số buổi có mặt.
            </p>
          )}
        </>
      ) : (
        <Trangtrong
          tieuDe="Chưa có điểm danh"
          moTa="Tháng này chưa có dữ liệu điểm danh cho lựa chọn hiện tại."
        />
      )}
    </The>
  );
}

export default function Ketquahoctap() {
  const { duLieu: dulieu, hocVien: hocvien, cacKhoaDangHoc: cackhoadanghoc } = useHocvienphuhuynh();
  const [makhoa, datmakhoa] = useState('');
  const [thang, datthang] = useState(() => ngayhomnay().slice(0, 7));
  const [loi, datloi] = useState('');
  const cacmakhoa = new Set(cackhoadanghoc.map((khoa) => khoa.ma));
  const makhoahople = cacmakhoa.has(makhoa) ? makhoa : '';
  const cacdiemdanhcuahocvien = dulieu.diemDanh.filter(
    (buoi) => buoi.maHocVien === hocvien.ma && (!makhoahople || buoi.maKhoa === makhoahople)
  );
  const cacthang = [
    ...new Set([
      ngayhomnay().slice(0, 7),
      ...cacdiemdanhcuahocvien.map((buoi) => buoi.ngay.slice(0, 7)),
    ]),
  ]
    .sort()
    .reverse();
  const thanghople = cacthang.includes(thang) ? thang : cacthang[0];
  const cacbuoitrongthang = cacdiemdanhcuahocvien
    .filter((buoi) => buoi.ngay.startsWith(thanghople))
    .sort((truoc, sau) => sau.ngay.localeCompare(truoc.ngay));
  const cacketqua = dulieu.ketQua
    .filter(
      (ketqua) => ketqua.maHocVien === hocvien.ma && (!makhoahople || ketqua.maKhoa === makhoahople)
    )
    .sort((truoc, sau) => sau.ngay.localeCompare(truoc.ngay));
  const ketquamoinhat = cacketqua[0];

  function taibangdiem() {
    try {
      taibaocaopdf(`bang-diem-${hocvien.maSo}.pdf`, 'BẢNG ĐIỂM HỌC TẬP — DỮ LIỆU MẪU', [
        `Học viên: ${hocvien.ten} (${hocvien.maSo})`,
        ...cacketqua.flatMap((ketqua) => [
          `${dinhdangngay(ketqua.ngay)} | ${ketqua.tieuDe} | ${tenkhoahoc(dulieu, ketqua.maKhoa)}`,
          `Điểm tổng: ${Number(ketqua.diemTong).toFixed(1)}/10`,
          ...ketqua.kyNang.map((kynang) => `${kynang.ten}: ${Number(kynang.diem).toFixed(1)}/10`),
          `Nhận xét: ${ketqua.nhanXet}`,
          '',
        ]),
      ]);
      datloi('');
    } catch (loitai) {
      datloi(loitai.message || 'Chưa tải được bảng điểm.');
    }
  }

  const caccotketqua = [
    {
      key: 'tieuDe',
      label: 'Bài kiểm tra',
      render: (ketqua) => (
        <div className="sp-result-test">
          <strong>{ketqua.tieuDe}</strong>
          <small>
            {dinhdangngay(ketqua.ngay)} · {tenkhoahoc(dulieu, ketqua.maKhoa)}
          </small>
        </div>
      ),
    },
    {
      key: 'diemTong',
      label: 'Điểm tổng',
      width: '14%',
      render: (ketqua) => (
        <span className="sp-score">
          {Number(ketqua.diemTong).toFixed(1)}
          <small>/10</small>
        </span>
      ),
    },
    { key: 'nhanXet', label: 'Nhận xét của giảng viên', width: '37%' },
    {
      key: 'chiTiet',
      label: '',
      width: '16%',
      render: (ketqua) => (
        <Nut size="sm" variant="soft" icon={Eye} to={`/student/ketqua/${ketqua.ma}`}>
          Xem chi tiết
        </Nut>
      ),
    },
  ];

  return (
    <div className="sp-page sp-study-page">
      <div className="sp-toolbar sp-results-filters">
        <Ochon
          label="Khóa học"
          value={makhoahople}
          onChange={(sukien) => datmakhoa(sukien.target.value)}
          options={[
            { value: '', label: 'Tất cả khóa học' },
            ...cackhoadanghoc.map((khoa) => ({ value: khoa.ma, label: khoa.ten })),
          ]}
        />
        <Ochon
          label="Tháng chuyên cần"
          value={thanghople}
          onChange={(sukien) => datthang(sukien.target.value)}
          options={cacthang.map((ngaythang) => ({
            value: ngaythang,
            label: `Tháng ${Number(ngaythang.slice(5))}/${ngaythang.slice(0, 4)}`,
          }))}
        />
      </div>
      <div className="sp-results-summary">
        <Chuyencan cacBuoi={cacbuoitrongthang} thangDangXem={thanghople} />
        <The className="sp-skills-overview">
          <Tieudekhoi
            tieuDe="Điểm số theo kỹ năng"
            moTa={
              ketquamoinhat
                ? `Kết quả gần nhất: ${ketquamoinhat.tieuDe} · ${dinhdangngay(ketquamoinhat.ngay)}`
                : undefined
            }
          />
          {ketquamoinhat ? (
            <div className="sp-skills-bars">
              {ketquamoinhat.kyNang.map((kynang, chiso) => (
                <div className="sp-skill-column" key={kynang.ten}>
                  <strong>{Number(kynang.diem).toFixed(1)}</strong>
                  <div className="sp-skill-column__track">
                    <span
                      style={{
                        height: `${Math.max(0, Math.min(10, kynang.diem)) * 10}%`,
                        '--sp-skill-color': `var(--glass-${['ice', 'turquoise', 'peach', 'lavender'][chiso % 4]})`,
                      }}
                    />
                  </div>
                  <span>{kynang.ten}</span>
                </div>
              ))}
            </div>
          ) : (
            <Trangtrong
              tieuDe="Chưa có kết quả học tập"
              moTa="Kết quả đã công bố của học viên sẽ xuất hiện tại đây."
            />
          )}
          <p className="sp-study-meta">
            <Award size={14} />
            Thang điểm 0–10 · Kết quả minh họa
          </p>
        </The>
      </div>

      <The className="sp-study-results-table">
        <Tieudekhoi
          tieuDe="Lịch sử kiểm tra & nhận xét"
          moTa={`Các bài kiểm tra đã công bố của ${hocvien.ten}`}
        >
          <Nut
            variant="soft"
            size="sm"
            icon={Download}
            disabled={!cacketqua.length}
            onClick={taibangdiem}
          >
            Tải bảng điểm (PDF)
          </Nut>
        </Tieudekhoi>
        {loi && (
          <p className="sp-error" role="alert">
            {loi}
          </p>
        )}
        <Bangdulieu
          columns={caccotketqua}
          rows={cacketqua}
          rowKey="ma"
          empty="Chưa có bài kiểm tra đã công bố cho lựa chọn hiện tại."
        />
      </The>

      <The className="sp-stack">
        <Tieudekhoi
          tieuDe="Lịch sử điểm danh"
          moTa={`Tháng ${Number(thanghople.slice(5))}/${thanghople.slice(0, 4)}`}
        />
        {cacbuoitrongthang.length ? (
          <details className="sp-attendance-history">
            <summary>
              <CalendarCheck size={16} />
              Xem điểm danh {cacbuoitrongthang.length} buổi học
            </summary>
            <div className="sp-attendance-history__rows">
              {cacbuoitrongthang.map((buoi) => (
                <div key={buoi.ma}>
                  <time>{dinhdangngay(buoi.ngay)}</time>
                  <span>{tenkhoahoc(dulieu, buoi.maKhoa)}</span>
                  <Nhan tone={nhandiemdanh[buoi.trangThai]?.mau}>
                    {nhandiemdanh[buoi.trangThai]?.nhan ?? buoi.trangThai}
                  </Nhan>
                </div>
              ))}
            </div>
          </details>
        ) : (
          <p className="sp-muted">Chưa có buổi điểm danh trong tháng đã chọn.</p>
        )}
        <p className="sp-study-meta">
          <TrendingUp size={14} />
          Đi học đều và luyện tập hằng ngày giúp duy trì tiến bộ.
        </p>
      </The>
    </div>
  );
}
