import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, Download, ReceiptText } from 'lucide-react';
import { BackLink, Btn, Card } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { StatusBadge, EmptyState } from '../shared/DungChung';
import {
  formatDate,
  formatCurrency,
  downloadPdfReport,
  getCourseName,
  getPaymentMethodLabel,
} from '../shared/tienIch';
import '../../styles/hoc-phi-thong-bao.css';

function getInvoiceDetails(data, student, invoice) {
  const discountAmount = Math.max(0, (invoice.soTienGoc ?? invoice.soTien) - invoice.soTien);

  return [
    ['Học viên', `${student.ten} · ${student.maSo}`],
    ['Lớp học', getCourseName(data, invoice.maKhoa)],
    ['Kỳ học phí', invoice.kyHocPhi],
    ['Học phí gốc', formatCurrency(invoice.soTienGoc ?? invoice.soTien)],
    [
      'Ưu đãi áp dụng',
      discountAmount > 0 ? formatCurrency(discountAmount) : 'Không áp dụng trong kỳ này',
    ],
    ['Tổng thanh toán', formatCurrency(invoice.soTien)],
    ['Hạn thanh toán', formatDate(invoice.hanThanhToan)],
    [
      'Ngày thanh toán',
      invoice.ngayThanhToan ? formatDate(invoice.ngayThanhToan) : 'Chưa thanh toán',
    ],
    ['Phương thức', invoice.phuongThuc ? getPaymentMethodLabel(invoice.phuongThuc) : '—'],
    ['Mã giao dịch mẫu', invoice.maGiaoDich || '—'],
  ];
}

export default function InvoiceDetails() {
  const { maHoaDon: invoiceId } = useParams();
  const { data, student, invoices } = useStudentParent();
  const [error, setError] = useState('');
  const invoice = invoices.find((invoiceItem) => invoiceItem.ma === invoiceId);

  if (!invoice) {
    return (
      <EmptyState
        title="Không tìm thấy hóa đơn"
        description="Hóa đơn không tồn tại hoặc không thuộc học viên đang chọn."
      >
        <Btn to="/student/hocphi" variant="soft">
          Về Học phí & Hóa đơn
        </Btn>
      </EmptyState>
    );
  }

  const invoiceDetails = getInvoiceDetails(data, student, invoice);
  const isPaid = invoice.trangThai === 'daThanhToan';

  function downloadInvoice() {
    setError('');
    try {
      downloadPdfReport(`Hoa-don-${invoice.ma}.pdf`, invoice.tieuDe, [
        'NEKO EDU — HÓA ĐƠN MẪU',
        ...invoiceDetails.map(([label, value]) => `${label}: ${value}`),
        `Trạng thái: ${isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}`,
        'Hóa đơn được tạo từ dữ liệu mẫu, không có giá trị giao dịch thực tế.',
      ]);
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  return (
    <div className="sp-page sp-invoice-detail">
      <BackLink to="/student/hocphi">Học phí & Hóa đơn</BackLink>
      <Card className="sp-invoice-paper">
        <div className="sp-invoice-heading">
          <div>
            <span className="sp-eyebrow">
              <ReceiptText size={16} /> NEKO EDU
            </span>
            <h2>{invoice.tieuDe}</h2>
          </div>
          <StatusBadge status={invoice.trangThai} />
        </div>
        <dl className="sp-invoice-lines">
          {invoiceDetails.map(([label, value]) => (
            <div key={label} className={label === 'Tổng thanh toán' ? 'sp-invoice-total' : ''}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="sp-muted">Hóa đơn trong bản mẫu chỉ dùng để trải nghiệm giao diện.</p>
        {error && (
          <p className="sp-error" role="alert">
            {error}
          </p>
        )}
        <div className="sp-toolbar">
          <Btn icon={Download} variant="soft" onClick={downloadInvoice}>
            Tải hóa đơn (PDF)
          </Btn>
          {invoice.trangThai === 'chuaThanhToan' && (
            <Btn
              icon={CreditCard}
              to={`/student/hocphi?thanhToan=${encodeURIComponent(invoice.ma)}`}
            >
              Thanh toán ngay
            </Btn>
          )}
        </div>
      </Card>
    </div>
  );
}
