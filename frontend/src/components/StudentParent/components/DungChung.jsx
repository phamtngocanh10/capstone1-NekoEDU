import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Eye, FileText, Inbox, X } from 'lucide-react';
import { Btn as Nut, Chip as Nhan } from '../../../common/ui';
import { taitailieu } from './tienIch';

export function Trangtrong({ tieuDe: tieude = 'Chưa có dữ liệu', moTa: mota, children: noidung }) {
  return (
    <div className="sp-empty">
      <span>
        <Inbox size={30} strokeWidth={1.4} />
      </span>
      <h3>{tieude}</h3>
      <p>{mota}</p>
      {noidung}
    </div>
  );
}

export function Tieudekhoi({ tieuDe: tieude, moTa: mota, children: noidung }) {
  return (
    <div className="sp-section-heading">
      <div>
        <h2>{tieude}</h2>
        {mota && <p>{mota}</p>}
      </div>
      {noidung}
    </div>
  );
}

const cactrangthai = {
  dangHoc: ['Đang học', 'blue'],
  choXacNhan: ['Chờ xác nhận', 'amber'],
  hoanThanh: ['Hoàn thành', 'green'],
  sapToi: ['Sắp tới', 'muted'],
  sapHoc: ['Sắp học', 'blue'],
  daHoc: ['Đã học', 'green'],
  daHuy: ['Đã hủy', 'red'],
  daThanhToan: ['Đã thanh toán', 'green'],
  chuaThanhToan: ['Chưa thanh toán', 'amber'],
  daGui: ['Đã gửi', 'blue'],
  coMat: ['Có mặt', 'green'],
  diTre: ['Đi trễ', 'amber'],
  vangCoPhep: ['Vắng có phép', 'muted'],
  vangKhongPhep: ['Vắng không phép', 'red'],
};

export function Nhantrangthai({ trangThai: trangthai }) {
  const [nhan, mau] = cactrangthai[trangthai] ?? [trangthai, 'muted'];
  return <Nhan tone={mau}>{nhan}</Nhan>;
}

export function Hopthoai({
  title: tieude,
  subtitle: mota,
  onClose: dong,
  size: kichthuoc = 'md',
  children: noidung,
}) {
  const khung = useRef(null);
  const dongref = useRef(dong);
  dongref.current = dong;
  const matieude = useId();
  useEffect(() => {
    const phantutruoc = document.activeElement;
    const trancu = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const layphantu = () =>
      [
        ...khung.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex]'),
      ].filter(
        (phantu) => !phantu.disabled && phantu.tabIndex >= 0 && phantu.getClientRects().length
      );
    const cactruong = layphantu();
    (
      cactruong.find((truong) => truong.matches('input,select,textarea')) ??
      cactruong[0] ??
      khung.current
    ).focus({ preventScroll: true });
    function xulyphim(sukien) {
      const cachopthoai = document.querySelectorAll('.sp-dialog');
      if (cachopthoai[cachopthoai.length - 1] !== khung.current) return;
      if (sukien.key === 'Escape') {
        sukien.preventDefault();
        dongref.current();
      }
      if (sukien.key !== 'Tab') return;
      const cacnut = layphantu();
      const dau = cacnut[0];
      const cuoi = cacnut.at(-1);
      if (!dau) {
        sukien.preventDefault();
        khung.current.focus();
      } else if (
        !cacnut.includes(document.activeElement) ||
        (sukien.shiftKey && document.activeElement === dau)
      ) {
        sukien.preventDefault();
        (sukien.shiftKey ? cuoi : dau).focus();
      } else if (!sukien.shiftKey && document.activeElement === cuoi) {
        sukien.preventDefault();
        dau.focus();
      }
    }
    document.addEventListener('keydown', xulyphim);
    return () => {
      document.removeEventListener('keydown', xulyphim);
      document.body.style.overflow = trancu;
      if (phantutruoc?.isConnected) phantutruoc.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className="u-overlay sp-dialog-overlay"
      onMouseDown={(sukien) => {
        if (sukien.target === sukien.currentTarget) dong();
      }}
    >
      <section
        ref={khung}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={matieude}
        className={`u-modal u-modal--${kichthuoc} sp-dialog`}
      >
        <header className="u-modal__head">
          <div>
            <h2 id={matieude} className="u-modal__title">
              {tieude}
            </h2>
            {mota && <p className="u-modal__sub">{mota}</p>}
          </div>
          <button type="button" className="u-modal__close" aria-label="Đóng" onClick={dong}>
            <X size={17} />
          </button>
        </header>
        {noidung}
      </section>
    </div>,
    document.body
  );
}

export function Tepdinhkem({ tep }) {
  const [dangxem, datdangxem] = useState(false);
  return (
    <>
      <div className="sp-file">
        <span className="sp-file-icon">
          <FileText size={21} />
        </span>
        <div className="sp-file-name">
          <strong>{tep.ten}</strong>
          <small>
            {tep.loai} · {tep.dungLuong}
          </small>
        </div>
        <div className="sp-file-actions">
          <Nut size="xs" variant="ghost" icon={Eye} onClick={() => datdangxem(true)}>
            Xem
          </Nut>
          <Nut size="xs" variant="soft" icon={Download} onClick={() => taitailieu(tep)}>
            Tải xuống
          </Nut>
        </div>
      </div>
      {dangxem && (
        <Hopthoai
          title={tep.ten}
          subtitle="Nội dung tài liệu mẫu · NEKO EDU"
          size="lg"
          onClose={() => datdangxem(false)}
        >
          <div className="sp-dialog-body">
            <div className="sp-document-preview">
              <strong>NEKO EDU</strong>
              <h3>{tep.ten}</h3>
              <p>{tep.noiDung}</p>
            </div>
            {tep.loai === 'MP3' && tep.duongDan && (
              <audio className="sp-audio" controls src={tep.duongDan}>
                Trình duyệt chưa hỗ trợ phát âm thanh.
              </audio>
            )}
          </div>
          <div className="sp-dialog-actions">
            <Nut variant="ghost" onClick={() => datdangxem(false)}>
              Đóng
            </Nut>
            <Nut icon={Download} onClick={() => taitailieu(tep)}>
              Tải tài liệu mẫu
            </Nut>
          </div>
        </Hopthoai>
      )}
    </>
  );
}
