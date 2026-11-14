import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';
import { Btn, Card } from '../../../../common/ui';
import { norm } from '../../../../common/format.js';

export function getErrorMessage(error, fallback = 'Không thể tải dữ liệu.') {
  return error?.message || fallback;
}

// dependencies quyết định lúc tải lại. Bỏ qua phản hồi cũ khi đổi trang/bộ lọc.
export function useAsyncData(loader, dependencies = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadCount, setLoadCount] = useState(0);
  const reload = useCallback(() => setLoadCount((count) => count + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setData(null);

    async function loadData() {
      try {
        const result = await loader();
        if (active) setData(result);
      } catch (loadError) {
        if (active) setError(getErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [...dependencies, loadCount]);

  return { data, setData, error, loading, reload };
}

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Chưa có dữ liệu',
  description,
  children: content,
}) {
  return (
    <div className="ta-empty">
      <span className="ta-empty__icon">
        <Icon size={27} strokeWidth={1.6} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {content && <div className="ta-empty__actions">{content}</div>}
    </div>
  );
}

export function LoadingState({ error, onRetry }) {
  return (
    <Card className="ta-load" aria-live="polite">
      {error ? <CircleAlert size={22} /> : <LoaderCircle className="ta-spin" size={22} />}
      <p role={error ? 'alert' : 'status'}>{error || 'Đang tải dữ liệu…'}</p>
      {error && onRetry && (
        <Btn variant="soft" onClick={onRetry}>
          Thử lại
        </Btn>
      )}
    </Card>
  );
}

export function StudentIdentity({ name = '', code }) {
  const initial = name.trim().split(/\s+/).at(-1)?.charAt(0) || '?';
  return (
    <span className="ta-person">
      <span className="ta-person__avatar">{initial}</span>
      <span>
        <strong>{name || 'Chưa có tên'}</strong>
        {code && <small>{code}</small>}
      </span>
    </span>
  );
}

export const hasPermission = (classItem, grant) => classItem?.permissions?.includes(grant) ?? false;

export function filterByQuery(items, query, getSearchText) {
  const normalizedQuery = norm(query.trim());
  if (!normalizedQuery) return items;
  return items.filter((item) => norm(getSearchText(item)).includes(normalizedQuery));
}

export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDays(date, dayCount) {
  const nextDate = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + dayCount);
  const year = nextDate.getFullYear();
  const month = String(nextDate.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(nextDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
}

export function startOfWeek(date = todayISO()) {
  const targetDate = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  return addDays(date, -((targetDate.getDay() + 6) % 7));
}

export function formatDate(date, options = {}) {
  if (!date) return '—';
  const dateString = String(date);
  const vietnameseDateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateString);
  let parsedDate;
  if (vietnameseDateMatch) {
    parsedDate = new Date(
      `${vietnameseDateMatch[3]}-${vietnameseDateMatch[2]}-${vietnameseDateMatch[1]}T12:00:00`
    );
  } else {
    parsedDate = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateString) ? `${dateString}T12:00:00` : date);
  }
  if (Number.isNaN(parsedDate.getTime())) return dateString;
  return parsedDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
}

export function formatDateTime(date) {
  if (!date) return '—';
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return String(date);
  return parsedDate.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
