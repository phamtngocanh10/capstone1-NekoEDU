import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CreditCard, Download, ReceiptText } from 'lucide-react';
import { Btn, Card, DataTable, MiniStat } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { StatusBadge, SectionHeader, EmptyState } from '../shared/DungChung';
import {
  formatDate,
  formatCurrency,
  downloadPdfReport,
  getCourseName,
  getPaymentMethodLabel,
} from '../shared/tienIch';
import DemoPaymentModal from './ThanhToanMau';
import '../../styles/hoc-phi-thong-bao.css';

export default function TuitionInvoices() {
  const { data, student, invoices } = useStudentParent();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState('');
  const paymentInvoiceId = searchParams.get('thanhToan');
  const selectedInvoice = invoices.find((invoice) => invoice.ma === paymentInvoiceId);
  const unpaidInvoices = invoices
    .filter((invoice) => invoice.trangThai === 'chuaThanhToan')
    .sort((previous, next) => previous.hanThanhToan.localeCompare(next.hanThanhToan));
  const nextDueInvoice = unpaidInvoices[0];
  const paidInvoices = invoices.filter((invoice) => invoice.trangThai === 'daThanhToan');
  const paidTotal = paidInvoices.reduce((total, invoice) => total + invoice.soTien, 0);

  function selectPaymentInvoice(invoiceId) {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (invoiceId) nextSearchParams.set('thanhToan', invoiceId);
    else nextSearchParams.delete('thanhToan');
    setSearchParams(nextSearchParams, { replace: true });
  }

  function downloadAllInvoices() {
    setError('');
    try {
      downloadPdfReport(
        `Hoa-don-${student.maSo}.pdf`,
        `Lịch sử học phí — ${student.ten}`,
        invoices.flatMap((invoice) => [
          `${invoice.tieuDe} - ${getCourseName(data, invoice.maKhoa)}`,
          `${formatCurrency(invoice.soTien)} | ${invoice.trangThai === 'daThanhToan' ? 'Đã thanh toán' : 'Chưa thanh toán'}`,
          `Ngày thanh toán: ${invoice.ngayThanhToan ? formatDate(invoice.ngayThanhToan) : 'Chưa có'} | ${invoice.phuongThuc ? getPaymentMethodLabel(invoice.phuongThuc) : 'Chưa thanh toán'}`,
          '',
        ])
      );
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  const columns = [
    {
      key: 'tieuDe',
      label: 'Kỳ học phí',
      render: (invoice) => (
        <Link className="sp-invoice-title" to={`/student/hocphi/${invoice.ma}`}>
          {invoice.tieuDe}
          <small>{getCourseName(data, invoice.maKhoa)}</small>
        </Link>
      ),
    },
    {
      key: 'soTien',
      label: 'Số tiền',
      render: (invoice) => <strong>{formatCurrency(invoice.soTien)}</strong>,
    },
    {
      key: 'ngayThanhToan',
      label: 'Ngày thanh toán',
      render: (invoice) => (invoice.ngayThanhToan ? formatDate(invoice.ngayThanhToan) : '—'),
    },
    {
      key: 'phuongThuc',
      label: 'Phương thức',
      render: (invoice) => (invoice.phuongThuc ? getPaymentMethodLabel(invoice.phuongThuc) : '—'),
    },
    {
      key: 'trangThai',
      label: 'Trạng thái',
      render: (invoice) => <StatusBadge status={invoice.trangThai} />,
    },
    {
      key: 'thaoTac',
      label: '',
      render: (invoice) =>
        invoice.trangThai === 'chuaThanhToan' ? (
          <Btn size="xs" variant="soft" onClick={() => selectPaymentInvoice(invoice.ma)}>
            Thanh toán
          </Btn>
        ) : (
          <Btn size="xs" variant="ghost" to={`/student/hocphi/${invoice.ma}`}>
            Chi tiết
          </Btn>
        ),
    },
  ];

  return (
    <div className="sp-page sp-fees">
      {nextDueInvoice ? (
        <Card className="sp-fees-hero">
          <div>
            <span className="sp-eyebrow">Học phí cần thanh toán</span>
            <h2>{nextDueInvoice.tieuDe}</h2>
            <strong className="sp-fees-amount">{formatCurrency(nextDueInvoice.soTien)}</strong>
            <p>
              Hạn thanh toán: {formatDate(nextDueInvoice.hanThanhToan)} ·{' '}
              {getCourseName(data, nextDueInvoice.maKhoa)}
            </p>
          </div>
          <Btn icon={CreditCard} onClick={() => selectPaymentInvoice(nextDueInvoice.ma)}>
            Thanh toán ngay
          </Btn>
        </Card>
      ) : (
        <Card className="sp-fees-hero sp-fees-hero--paid">
          <CheckCircle2 size={34} />
          <div>
            <h2>
              {invoices.length
                ? 'Học phí đã được thanh toán đầy đủ'
                : 'Chưa có khoản học phí cần thanh toán'}
            </h2>
            <p>Bạn có thể xem các hóa đơn của {student.ten} bên dưới.</p>
          </div>
        </Card>
      )}
      <div className="sp-grid-3">
        <MiniStat label="Tổng học phí đã đóng" value={formatCurrency(paidTotal)} />
        <MiniStat label="Số kỳ đã đóng" value={`${paidInvoices.length}/${invoices.length} kỳ`} />
        <MiniStat label="Ưu đãi tham khảo" value="Giảm 5% kỳ sau" />
      </div>
      {error && (
        <p className="sp-error" role="alert">
          {error}
        </p>
      )}
      <Card className="sp-invoice-history">
        <SectionHeader title="Lịch sử hóa đơn" description={`Học phí của ${student.ten}`}>
          <Btn
            variant="ghost"
            size="sm"
            icon={Download}
            onClick={downloadAllInvoices}
            disabled={!invoices.length}
          >
            Tải tất cả
          </Btn>
        </SectionHeader>
        {invoices.length ? (
          <DataTable columns={columns} rows={invoices} rowKey="ma" />
        ) : (
          <EmptyState
            title="Chưa có hóa đơn"
            description="Hóa đơn học phí của học viên sẽ được hiển thị tại đây."
          />
        )}
      </Card>
      {paymentInvoiceId && (!selectedInvoice || selectedInvoice.trangThai === 'daThanhToan') && (
        <div className="sp-note">
          <ReceiptText size={18} />
          <span>
            {selectedInvoice
              ? 'Hóa đơn này đã thanh toán.'
              : 'Không tìm thấy hóa đơn thuộc học viên đang chọn.'}
          </span>
          <Btn size="xs" variant="ghost" onClick={() => selectPaymentInvoice(null)}>
            Đóng
          </Btn>
        </div>
      )}
      {selectedInvoice?.trangThai === 'chuaThanhToan' && (
        <DemoPaymentModal
          key={selectedInvoice.ma}
          invoice={selectedInvoice}
          onClose={() => selectPaymentInvoice(null)}
        />
      )}
    </div>
  );
}
