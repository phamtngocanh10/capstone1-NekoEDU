import { useState } from 'react';
import { Banknote, CheckCircle2, Landmark, Wallet } from 'lucide-react';
import { Btn, Chip } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { Dialog } from '../shared/DungChung';
import { formatDate, formatCurrency, getCourseName } from '../shared/tienIch';

const PAYMENT_METHODS = [
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

function DemoPaymentCode() {
  const cells = Array.from({ length: 21 * 21 }, (_, index) => ({
    x: index % 21,
    y: Math.floor(index / 21),
  }));
  return (
    <svg
      viewBox="0 0 25 25"
      className="sp-payment-qr"
      role="img"
      aria-label="Hình minh họa mã thanh toán mẫu, không dùng để chuyển tiền"
    >
      <rect width="25" height="25" fill="white" />
      {cells
        .filter(({ x, y }) => (x * 7 + y * 11 + x * y) % 5 < 2)
        .map(({ x, y }) => (
          <rect key={`${x}-${y}`} x={x + 2} y={y + 2} width="1" height="1" fill="currentColor" />
        ))}
      {[
        [2, 2],
        [16, 2],
        [2, 16],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="7" height="7" fill="currentColor" />
          <rect x={x + 1} y={y + 1} width="5" height="5" fill="white" />
          <rect x={x + 2} y={y + 2} width="3" height="3" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

export default function DemoPaymentModal({ invoice, onClose }) {
  const { data, student, payInvoice, notify } = useStudentParent();
  const [paymentMethod, setPaymentMethod] = useState('chuyenKhoan');
  const [error, setError] = useState('');

  function confirmPayment(event) {
    event.preventDefault();
    setError('');
    try {
      payInvoice(invoice.ma, paymentMethod);
      notify('Đã cập nhật thanh toán mẫu. Không có giao dịch hay khoản tiền thật được thực hiện.');
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <Dialog
      title="Thanh toán học phí"
      subtitle={`${invoice.tieuDe} · ${getCourseName(data, invoice.maKhoa)}`}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={confirmPayment}>
        <div className="sp-dialog-body sp-stack">
          <div className="sp-payment-total">
            <div>
              <span>Số tiền cần thanh toán</span>
              <strong>{formatCurrency(invoice.soTien)}</strong>
            </div>
            <Chip tone="amber">Hạn: {formatDate(invoice.hanThanhToan)}</Chip>
          </div>
          <fieldset className="sp-payment-methods">
            <legend>Chọn phương thức thanh toán</legend>
            {PAYMENT_METHODS.map(({ ma: id, ten: name, moTa: description, bieuTuong: Icon }) => (
              <label
                key={id}
                className={`sp-payment-method ${paymentMethod === id ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="phuongThucThanhToan"
                  value={id}
                  checked={paymentMethod === id}
                  onChange={() => setPaymentMethod(id)}
                />
                <Icon size={21} />
                <span>
                  <strong>{name}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          {paymentMethod !== 'tienMat' ? (
            <div className="sp-payment-preview">
              <DemoPaymentCode />
              <div>
                <strong>Mã minh họa · Không dùng để chuyển tiền</strong>
                <p>NEKO EDUCATION CENTER</p>
                <p>
                  {student.maSo} · {invoice.kyHocPhi}
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
          {error && (
            <p className="sp-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="sp-dialog-actions">
          <Btn variant="ghost" onClick={onClose}>
            Hủy
          </Btn>
          <Btn type="submit" icon={CheckCircle2}>
            Xác nhận thanh toán mẫu
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}
