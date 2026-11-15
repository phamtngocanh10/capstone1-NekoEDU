export const createId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDays(date, dayCount) {
  const dateValue = new Date(`${date}T12:00:00+07:00`);
  dateValue.setUTCDate(dateValue.getUTCDate() + dayCount);
  return dateValue.toISOString().slice(0, 10);
}

export function startOfWeek(date = todayISO()) {
  const weekday = new Date(`${date}T12:00:00+07:00`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export function formatWeekday(date) {
  const weekday = new Date(`${date}T12:00:00+07:00`).getUTCDay();
  return weekday === 0 ? 'CN' : `T${weekday + 1}`;
}

export function formatDate(date, options = {}) {
  if (!date) return '—';
  const value = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00+07:00` : date);
  if (!Number.isFinite(value.getTime())) return '—';
  return value.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
}

export function formatDateTime(date) {
  if (!date) return '—';
  const value = new Date(date);
  return Number.isFinite(value.getTime())
    ? value.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
}

export const formatCurrency = (amount) => `${Number(amount || 0).toLocaleString('vi-VN')}đ`;
export const getCourseName = (data, courseId) =>
  data.khoaHoc.find((course) => course.ma === courseId)?.ten ?? 'Khóa học';
export const getPaymentMethodLabel = (value) =>
  ({
    chuyenKhoan: 'Chuyển khoản ngân hàng',
    viDienTu: 'Ví MoMo / ZaloPay',
    tienMat: 'Tiền mặt tại quầy',
  })[value] ??
  value ??
  '—';

function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function filterByQuery(items, query, getSearchText) {
  const normalizedQuery = normalizeText(query).trim();
  return normalizedQuery
    ? items.filter((item) => normalizeText(getSearchText(item)).includes(normalizedQuery))
    : items;
}
