import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Eye, FileText, Inbox, X } from 'lucide-react';
import { Btn, Chip } from '../../../../common/ui/index';
import { downloadMaterial } from './tienIch';

export function EmptyState({ title = 'Chưa có dữ liệu', description, children }) {
  return (
    <div className="sp-empty">
      <span>
        <Inbox size={30} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function SectionHeader({ title, description, children }) {
  return (
    <div className="sp-section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}

const STATUS_LABELS = {
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

export function StatusBadge({ status }) {
  const [label, tone] = STATUS_LABELS[status] ?? [status, 'muted'];
  return <Chip tone={tone}>{label}</Chip>;
}

export function Dialog({ title, subtitle: description, onClose, size = 'md', children }) {
  const containerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previousElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const getFocusableElements = () =>
      [
        ...containerRef.current.querySelectorAll(
          'button, input, select, textarea, a[href], [tabindex]'
        ),
      ].filter(
        (element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length
      );
    const focusableElements = getFocusableElements();
    (
      focusableElements.find((field) => field.matches('input,select,textarea')) ??
      focusableElements[0] ??
      containerRef.current
    ).focus({ preventScroll: true });
    function handleKeyDown(event) {
      const dialogs = document.querySelectorAll('.sp-dialog');
      if (dialogs[dialogs.length - 1] !== containerRef.current) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== 'Tab') return;
      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      if (!firstElement) {
        event.preventDefault();
        containerRef.current.focus();
      } else if (
        !focusableElements.includes(document.activeElement) ||
        (event.shiftKey && document.activeElement === firstElement)
      ) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousElement?.isConnected) previousElement.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className="u-overlay sp-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`u-modal u-modal--${size} sp-dialog`}
      >
        <header className="u-modal__head">
          <div>
            <h2 id={titleId} className="u-modal__title">
              {title}
            </h2>
            {description && <p className="u-modal__sub">{description}</p>}
          </div>
          <button type="button" className="u-modal__close" aria-label="Đóng" onClick={onClose}>
            <X size={17} />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body
  );
}

export function FileAttachment({ file }) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  return (
    <>
      <div className="sp-file">
        <span className="sp-file-icon">
          <FileText size={21} />
        </span>
        <div className="sp-file-name">
          <strong>{file.ten}</strong>
          <small>
            {file.loai} · {file.dungLuong}
          </small>
        </div>
        <div className="sp-file-actions">
          <Btn size="xs" variant="ghost" icon={Eye} onClick={() => setIsPreviewOpen(true)}>
            Xem
          </Btn>
          <Btn size="xs" variant="soft" icon={Download} onClick={() => downloadMaterial(file)}>
            Tải xuống
          </Btn>
        </div>
      </div>
      {isPreviewOpen && (
        <Dialog
          title={file.ten}
          subtitle="Nội dung tài liệu mẫu · NEKO EDU"
          size="lg"
          onClose={() => setIsPreviewOpen(false)}
        >
          <div className="sp-dialog-body">
            <div className="sp-document-preview">
              <strong>NEKO EDU</strong>
              <h3>{file.ten}</h3>
              <p>{file.noiDung}</p>
            </div>
            {file.loai === 'MP3' && file.duongDan && (
              <audio className="sp-audio" controls src={file.duongDan}>
                Trình duyệt chưa hỗ trợ phát âm thanh.
              </audio>
            )}
          </div>
          <div className="sp-dialog-actions">
            <Btn variant="ghost" onClick={() => setIsPreviewOpen(false)}>
              Đóng
            </Btn>
            <Btn icon={Download} onClick={() => downloadMaterial(file)}>
              Tải tài liệu mẫu
            </Btn>
          </div>
        </Dialog>
      )}
    </>
  );
}
