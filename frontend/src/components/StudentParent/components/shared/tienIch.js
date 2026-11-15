// Hàm định dạng và tìm kiếm dùng chung cho các trang StudentParent.
export {
  createId,
  todayISO,
  addDays,
  startOfWeek,
  formatWeekday,
  formatDate,
  formatDateTime,
  formatCurrency,
  getCourseName,
  getPaymentMethodLabel,
  filterByQuery,
} from './dinhDang.js';

// Mã tạo PDF, Word và lịch được giữ riêng để trang giao diện dễ đọc.
export { downloadPdfReport, downloadMaterial, exportCalendar } from './xuatTep.js';
