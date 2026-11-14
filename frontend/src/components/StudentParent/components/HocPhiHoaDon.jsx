import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Download,
  Landmark,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import {
  Btn as Nut,
  Card as The,
  Chip as Nhan,
  DataTable as Bangdulieu,
  MiniStat as Thongkegon,
} from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Hopthoai, Nhantrangthai, Tieudekhoi, Trangtrong } from './DungChung';
import { dinhdangngay, dinhdangtien, taibaocaopdf, tenkhoahoc, tenphuongthuc } from './tienIch';
import './hoc-phi-thong-bao.css';

const cacphuongthuc = [
  {
    ma: 'chuyenKhoan',
    ten: 'Chuyển khoản ngân hàng',
    moTa: 'Xem minh họa thanh toán bằng mã QR',
    bieuTuong: Landmark,
  },
  {
    ma: 'viDienTu',
    ten: 'Ví MoMo / ZaloPay',
    moTa: 'Mô phỏng thanh toán bằng ví điện tử',
    bieuTuong: Wallet,
  },
  {
    ma: 'tienMat',
    ten: 'Tiền mặt tại quầy',
    moTa: 'Mô phỏng xác nhận thanh toán tại trung tâm',
    bieuTuong: Banknote,
  },
];

function Mathanhtoanminhhoa() {
  const caco = Array.from({ length: 21 * 21 }, (_, chiso) => ({
    x: chiso % 21,
    y: Math.floor(chiso / 21),
  }));
  return (
    <svg
      viewBox="0 0 25 25"
      className="sp-payment-qr"
      role="img"
      aria-label="Hình minh họa mã thanh toán mẫu, không dùng để chuyển tiền"
    >
      <rect width="25" height="25" fill="white" />
      {caco
        .filter(
          ({ x: hoanhdo, y: tungdo }) => (hoanhdo * 7 + tungdo * 11 + hoanhdo * tungdo) % 5 < 2
        )
        .map(({ x: hoanhdo, y: tungdo }) => (
          <rect
            key={`${hoanhdo}-${tungdo}`}
            x={hoanhdo + 2}
            y={tungdo + 2}
            width="1"
            height="1"
            fill="currentColor"
          />
        ))}
      {[
        [2, 2],
        [16, 2],
        [2, 16],
      ].map(([hoanhdo, tungdo]) => (
        <g key={`${hoanhdo}-${tungdo}`}>
          <rect x={hoanhdo} y={tungdo} width="7" height="7" fill="currentColor" />
          <rect x={hoanhdo + 1} y={tungdo + 1} width="5" height="5" fill="white" />
          <rect x={hoanhdo + 2} y={tungdo + 2} width="3" height="3" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function Thanhtoanmau({ hoaDon: hoadon, dong }) {
  const {
    duLieu: dulieu,
    hocVien: hocvien,
    thanhToanHoaDon: thanhtoanhoadon,
    thongBao: hienthongbao,
  } = useHocvienphuhuynh();
  const [phuongthuc, datphuongthuc] = useState('chuyenKhoan');
  const [loi, datloi] = useState('');

  function xacnhan(sukien) {
    sukien.preventDefault();
    datloi('');
    try {
      thanhtoanhoadon(hoadon.ma, phuongthuc);
      hienthongbao(
        'Đã cập nhật thanh toán mẫu. Không có giao dịch hay khoản tiền thật được thực hiện.'
      );
      dong();
    } catch (loiluu) {
      datloi(loiluu.message);
    }
  }

  return (
    <Hopthoai
      title="Thanh toán học phí"
      subtitle={`${hoadon.tieuDe} · ${tenkhoahoc(dulieu, hoadon.maKhoa)}`}
      onClose={dong}
      size="md"
    >
      <form onSubmit={xacnhan}>
        <div className="sp-dialog-body sp-stack">
          <div className="sp-payment-total">
            <div>
              <span>Số tiền cần thanh toán</span>
              <strong>{dinhdangtien(hoadon.soTien)}</strong>
            </div>
            <Nhan tone="amber">Hạn: {dinhdangngay(hoadon.hanThanhToan)}</Nhan>
          </div>
          <fieldset className="sp-payment-methods">
            <legend>Chọn phương thức thanh toán</legend>
            {cacphuongthuc.map(({ ma, ten, moTa: mota, bieuTuong: Bieutuong }) => (
              <label
                key={ma}
                className={`sp-payment-method ${phuongthuc === ma ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="phuongThucThanhToan"
                  value={ma}
                  checked={phuongthuc === ma}
                  onChange={() => datphuongthuc(ma)}
                />
                <Bieutuong size={21} />
                <span>
                  <strong>{ten}</strong>
                  <small>{mota}</small>
                </span>
              </label>
            ))}
          </fieldset>
          {phuongthuc !== 'tienMat' ? (
            <div className="sp-payment-preview">
              <Mathanhtoanminhhoa />
              <div>
                <strong>Mã minh họa · Không dùng để chuyển tiền</strong>
                <p>NEKO EDUCATION CENTER</p>
                <p>
                  {hocvien.maSo} · {hoadon.kyHocPhi}
                </p>
                <small>Đây là bản mẫu giao diện, không liên kết ngân hàng hoặc ví điện tử.</small>
              </div>
            </div>
          ) : (
            <div className="sp-note">
              Trong hệ thống thật, bạn sẽ đến quầy NEKO EDU để thanh toán. Bản mẫu chỉ cập nhật
              trạng thái hóa đơn trên trình duyệt.
            </div>
          )}
          <p className="sp-muted">
            Nút xác nhận bên dưới chỉ mô phỏng thanh toán để bạn trải nghiệm giao diện.
          </p>
          {loi && (
            <p className="sp-error" role="alert">
              {loi}
            </p>
          )}
        </div>
        <div className="sp-dialog-actions">
          <Nut variant="ghost" onClick={dong}>
            Hủy
          </Nut>
          <Nut type="submit" icon={CheckCircle2}>
            Xác nhận thanh toán mẫu
          </Nut>
        </div>
      </form>
    </Hopthoai>
  );
}

export default function Hocphihoadon() {
  const { duLieu: dulieu, hocVien: hocvien, cacHoaDon: cachoadon } = useHocvienphuhuynh();
  const [thamso, datthamso] = useSearchParams();
  const [loi, datloi] = useState('');
  const macanthanhtoan = thamso.get('thanhToan');
  const hoadondangchon = cachoadon.find((hoadon) => hoadon.ma === macanthanhtoan);
  const cackhoanchuadong = cachoadon
    .filter((hoadon) => hoadon.trangThai === 'chuaThanhToan')
    .sort((truoc, sau) => truoc.hanThanhToan.localeCompare(sau.hanThanhToan));
  const hoadonsapdenhan = cackhoanchuadong[0];
  const cackhoandadong = cachoadon.filter((hoadon) => hoadon.trangThai === 'daThanhToan');
  const tongdadong = cackhoandadong.reduce((tong, hoadon) => tong + hoadon.soTien, 0);

  function chonthanhtoan(mahoadon) {
    const thamsomoi = new URLSearchParams(thamso);
    if (mahoadon) thamsomoi.set('thanhToan', mahoadon);
    else thamsomoi.delete('thanhToan');
    datthamso(thamsomoi, { replace: true });
  }

  function taitatcahoadon() {
    datloi('');
    try {
      taibaocaopdf(
        `Hoa-don-${hocvien.maSo}.pdf`,
        `Lịch sử học phí — ${hocvien.ten}`,
        cachoadon.flatMap((hoadon) => [
          `${hoadon.tieuDe} - ${tenkhoahoc(dulieu, hoadon.maKhoa)}`,
          `${dinhdangtien(hoadon.soTien)} | ${hoadon.trangThai === 'daThanhToan' ? 'Đã thanh toán' : 'Chưa thanh toán'}`,
          `Ngày thanh toán: ${hoadon.ngayThanhToan ? dinhdangngay(hoadon.ngayThanhToan) : 'Chưa có'} | ${hoadon.phuongThuc ? tenphuongthuc(hoadon.phuongThuc) : 'Chưa thanh toán'}`,
          '',
        ])
      );
    } catch (loitai) {
      datloi(loitai.message);
    }
  }

  const caccot = [
    {
      key: 'tieuDe',
      label: 'Kỳ học phí',
      render: (hoadon) => (
        <Link className="sp-invoice-title" to={`/student/hocphi/${hoadon.ma}`}>
          {hoadon.tieuDe}
          <small>{tenkhoahoc(dulieu, hoadon.maKhoa)}</small>
        </Link>
      ),
    },
    {
      key: 'soTien',
      label: 'Số tiền',
      render: (hoadon) => <strong>{dinhdangtien(hoadon.soTien)}</strong>,
    },
    {
      key: 'ngayThanhToan',
      label: 'Ngày thanh toán',
      render: (hoadon) => (hoadon.ngayThanhToan ? dinhdangngay(hoadon.ngayThanhToan) : '—'),
    },
    {
      key: 'phuongThuc',
      label: 'Phương thức',
      render: (hoadon) => (hoadon.phuongThuc ? tenphuongthuc(hoadon.phuongThuc) : '—'),
    },
    {
      key: 'trangThai',
      label: 'Trạng thái',
      render: (hoadon) => <Nhantrangthai trangThai={hoadon.trangThai} />,
    },
    {
      key: 'thaoTac',
      label: '',
      render: (hoadon) =>
        hoadon.trangThai === 'chuaThanhToan' ? (
          <Nut size="xs" variant="soft" onClick={() => chonthanhtoan(hoadon.ma)}>
            Thanh toán
          </Nut>
        ) : (
          <Nut size="xs" variant="ghost" to={`/student/hocphi/${hoadon.ma}`}>
            Chi tiết
          </Nut>
        ),
    },
  ];

  return (
    <div className="sp-page sp-fees">
      {hoadonsapdenhan ? (
        <The className="sp-fees-hero">
          <div>
            <span className="sp-eyebrow">Học phí cần thanh toán</span>
            <h2>{hoadonsapdenhan.tieuDe}</h2>
            <strong className="sp-fees-amount">{dinhdangtien(hoadonsapdenhan.soTien)}</strong>
            <p>
              Hạn thanh toán: {dinhdangngay(hoadonsapdenhan.hanThanhToan)} ·{' '}
              {tenkhoahoc(dulieu, hoadonsapdenhan.maKhoa)}
            </p>
          </div>
          <Nut icon={CreditCard} onClick={() => chonthanhtoan(hoadonsapdenhan.ma)}>
            Thanh toán ngay
          </Nut>
        </The>
      ) : (
        <The className="sp-fees-hero sp-fees-hero--paid">
          <CheckCircle2 size={34} />
          <div>
            <h2>
              {cachoadon.length
                ? 'Học phí đã được thanh toán đầy đủ'
                : 'Chưa có khoản học phí cần thanh toán'}
            </h2>
            <p>Bạn có thể xem các hóa đơn của {hocvien.ten} bên dưới.</p>
          </div>
        </The>
      )}
      <div className="sp-grid-3">
        <Thongkegon label="Tổng học phí đã đóng" value={dinhdangtien(tongdadong)} />
        <Thongkegon
          label="Số kỳ đã đóng"
          value={`${cackhoandadong.length}/${cachoadon.length} kỳ`}
        />
        <Thongkegon label="Ưu đãi tham khảo" value="Giảm 5% kỳ sau" />
      </div>
      {loi && (
        <p className="sp-error" role="alert">
          {loi}
        </p>
      )}
      <The className="sp-invoice-history">
        <Tieudekhoi tieuDe="Lịch sử hóa đơn" moTa={`Học phí của ${hocvien.ten}`}>
          <Nut
            variant="ghost"
            size="sm"
            icon={Download}
            onClick={taitatcahoadon}
            disabled={!cachoadon.length}
          >
            Tải tất cả
          </Nut>
        </Tieudekhoi>
        {cachoadon.length ? (
          <Bangdulieu columns={caccot} rows={cachoadon} rowKey="ma" />
        ) : (
          <Trangtrong
            tieuDe="Chưa có hóa đơn"
            moTa="Hóa đơn học phí của học viên sẽ được hiển thị tại đây."
          />
        )}
      </The>
      {macanthanhtoan && (!hoadondangchon || hoadondangchon.trangThai === 'daThanhToan') && (
        <div className="sp-note">
          <ReceiptText size={18} />
          <span>
            {hoadondangchon
              ? 'Hóa đơn này đã thanh toán.'
              : 'Không tìm thấy hóa đơn thuộc học viên đang chọn.'}
          </span>
          <Nut size="xs" variant="ghost" onClick={() => chonthanhtoan(null)}>
            Đóng
          </Nut>
        </div>
      )}
      {hoadondangchon?.trangThai === 'chuaThanhToan' && (
        <Thanhtoanmau
          key={hoadondangchon.ma}
          hoaDon={hoadondangchon}
          dong={() => chonthanhtoan(null)}
        />
      )}
    </div>
  );
}
