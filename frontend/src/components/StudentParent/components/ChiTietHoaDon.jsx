import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, Download, ReceiptText } from 'lucide-react';
import { BackLink as Nutquaylai, Btn as Nut, Card as The } from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Nhantrangthai, Trangtrong } from './DungChung';
import { dinhdangngay, dinhdangtien, taibaocaopdf, tenkhoahoc, tenphuongthuc } from './tienIch';
import './hoc-phi-thong-bao.css';

function laythongtinhoadon(dulieu, hocvien, hoadon) {
  const sotiengiam = Math.max(0, (hoadon.soTienGoc ?? hoadon.soTien) - hoadon.soTien);

  return [
    ['Học viên', `${hocvien.ten} · ${hocvien.maSo}`],
    ['Lớp học', tenkhoahoc(dulieu, hoadon.maKhoa)],
    ['Kỳ học phí', hoadon.kyHocPhi],
    ['Học phí gốc', dinhdangtien(hoadon.soTienGoc ?? hoadon.soTien)],
    ['Ưu đãi áp dụng', sotiengiam > 0 ? dinhdangtien(sotiengiam) : 'Không áp dụng trong kỳ này'],
    ['Tổng thanh toán', dinhdangtien(hoadon.soTien)],
    ['Hạn thanh toán', dinhdangngay(hoadon.hanThanhToan)],
    [
      'Ngày thanh toán',
      hoadon.ngayThanhToan ? dinhdangngay(hoadon.ngayThanhToan) : 'Chưa thanh toán',
    ],
    ['Phương thức', hoadon.phuongThuc ? tenphuongthuc(hoadon.phuongThuc) : '—'],
    ['Mã giao dịch mẫu', hoadon.maGiaoDich || '—'],
  ];
}

export default function Chitiethoadon() {
  const { maHoaDon: mahoadon } = useParams();
  const { duLieu: dulieu, hocVien: hocvien, cacHoaDon: cachoadon } = useHocvienphuhuynh();
  const [loi, datloi] = useState('');
  const hoadon = cachoadon.find((muc) => muc.ma === mahoadon);

  if (!hoadon) {
    return (
      <Trangtrong
        tieuDe="Không tìm thấy hóa đơn"
        moTa="Hóa đơn không tồn tại hoặc không thuộc học viên đang chọn."
      >
        <Nut to="/student/hocphi" variant="soft">
          Về Học phí & Hóa đơn
        </Nut>
      </Trangtrong>
    );
  }

  const cacthongtin = laythongtinhoadon(dulieu, hocvien, hoadon);
  const dathanhtoan = hoadon.trangThai === 'daThanhToan';

  function taihoadon() {
    datloi('');
    try {
      taibaocaopdf(`Hoa-don-${hoadon.ma}.pdf`, hoadon.tieuDe, [
        'NEKO EDU — HÓA ĐƠN MẪU',
        ...cacthongtin.map(([nhan, giatri]) => `${nhan}: ${giatri}`),
        `Trạng thái: ${dathanhtoan ? 'Đã thanh toán' : 'Chưa thanh toán'}`,
        'Hóa đơn được tạo từ dữ liệu mẫu, không có giá trị giao dịch thực tế.',
      ]);
    } catch (loitai) {
      datloi(loitai.message);
    }
  }

  return (
    <div className="sp-page sp-invoice-detail">
      <Nutquaylai to="/student/hocphi">Học phí & Hóa đơn</Nutquaylai>
      <The className="sp-invoice-paper">
        <div className="sp-invoice-heading">
          <div>
            <span className="sp-eyebrow">
              <ReceiptText size={16} /> NEKO EDU
            </span>
            <h2>{hoadon.tieuDe}</h2>
          </div>
          <Nhantrangthai trangThai={hoadon.trangThai} />
        </div>
        <dl className="sp-invoice-lines">
          {cacthongtin.map(([nhan, giatri]) => (
            <div key={nhan} className={nhan === 'Tổng thanh toán' ? 'sp-invoice-total' : ''}>
              <dt>{nhan}</dt>
              <dd>{giatri}</dd>
            </div>
          ))}
        </dl>
        <p className="sp-muted">Hóa đơn trong bản mẫu chỉ dùng để trải nghiệm giao diện.</p>
        {loi && (
          <p className="sp-error" role="alert">
            {loi}
          </p>
        )}
        <div className="sp-toolbar">
          <Nut icon={Download} variant="soft" onClick={taihoadon}>
            Tải hóa đơn (PDF)
          </Nut>
          {hoadon.trangThai === 'chuaThanhToan' && (
            <Nut
              icon={CreditCard}
              to={`/student/hocphi?thanhToan=${encodeURIComponent(hoadon.ma)}`}
            >
              Thanh toán ngay
            </Nut>
          )}
        </div>
      </The>
    </div>
  );
}
