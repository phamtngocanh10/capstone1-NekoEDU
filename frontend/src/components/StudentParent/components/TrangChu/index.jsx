import { Link } from 'react-router-dom';
import {
  Award,
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  CreditCard,
  MessageSquare,
  Star,
} from 'lucide-react';
import { Btn, Card, Chip, StatCard } from '../../../../common/ui/index';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { SectionHeader, EmptyState } from '../shared/DungChung';
import {
  startOfWeek,
  addDays,
  formatDate,
  formatCurrency,
  todayISO,
  formatWeekday,
  getCourseName,
} from '../shared/tienIch';

export default function Home() {
  const { data, student, invoices, notifications } = useStudentParent();
  const today = todayISO();
  const now = Date.now();
  const currentWeek = startOfWeek();
  const sessions = data.lichHoc
    .filter((session) => session.maHocVien === student.ma && session.trangThai !== 'daHuy')
    .sort((previous, next) =>
      `${previous.ngay}${previous.batDau}`.localeCompare(`${next.ngay}${next.batDau}`)
    );
  const nextSession = sessions.find(
    (session) => new Date(`${session.ngay}T${session.ketThuc}:00+07:00`).getTime() >= now
  );
  const weekSessions = sessions.filter(
    (session) => session.ngay >= currentWeek && session.ngay <= addDays(currentWeek, 6)
  );
  const results = data.ketQua
    .filter((result) => result.maHocVien === student.ma)
    .sort((previous, next) => next.ngay.localeCompare(previous.ngay));
  const attendanceRecords = data.diemDanh.filter(
    (session) => session.maHocVien === student.ma && session.ngay.startsWith(today.slice(0, 7))
  );
  const presentCount = attendanceRecords.filter((session) =>
    ['coMat', 'diTre'].includes(session.trangThai)
  ).length;
  const attendanceRate = attendanceRecords.length
    ? Math.round((presentCount / attendanceRecords.length) * 100)
    : null;
  const outstandingInvoices = invoices.filter((invoice) => invoice.trangThai !== 'daThanhToan');
  const outstandingTotal = outstandingInvoices.reduce(
    (total, invoice) => total + invoice.soTien,
    0
  );
  const nextInvoice = outstandingInvoices[0];
  return (
    <div className="sp-page sp-home">
      <div className="sp-stat-grid">
        <StatCard
          icon={CalendarDays}
          label="Buổi học sắp tới"
          value={
            nextSession
              ? `${nextSession.ngay === today ? 'Hôm nay' : formatDate(nextSession.ngay, { year: undefined })} ${nextSession.batDau}`
              : 'Chưa có lịch'
          }
          accent="brand"
        />
        <StatCard
          icon={CreditCard}
          label="Học phí cần thanh toán"
          value={
            outstandingTotal
              ? `${(outstandingTotal / 1000000).toLocaleString('vi-VN')}tr`
              : 'Đã hoàn tất'
          }
          accent="amber"
          tone="blue"
          badge={
            nextInvoice && (
              <Chip tone="amber">
                Hạn {formatDate(nextInvoice.hanThanhToan, { year: undefined })}
              </Chip>
            )
          }
        />
        <StatCard
          icon={Award}
          label="Kết quả gần nhất"
          value={results.length ? `${results[0].diemTong.toFixed(1)}/10` : 'Chưa có điểm'}
          accent="blue"
          tone="blue"
          delta={
            results.length > 1
              ? `+${(results[0].diemTong - results[1].diemTong).toFixed(1)}`
              : undefined
          }
        />
        <StatCard
          icon={CheckCheck}
          label="Điểm danh tháng này"
          value={attendanceRate === null ? 'Chưa có dữ liệu' : `${attendanceRate}%`}
          accent="green"
          tone="green"
          badge={
            attendanceRate !== null && (
              <Chip tone="green">
                {presentCount}/{attendanceRecords.length} buổi
              </Chip>
            )
          }
        />
      </div>
      <div className="sp-welcome-feedback">
        <div>
          <MessageSquare size={23} />
          <div>
            <h2>Buổi học vừa qua của {student.ten.split(' ').slice(-2).join(' ')} thế nào?</h2>
            <p>Đánh giá giảng viên và chất lượng lớp học giúp trung tâm cải thiện tốt hơn.</p>
          </div>
        </div>
        <Btn to="/student/danhgia" variant="soft">
          <span className="sp-stars-preview">
            {[1, 2, 3, 4, 5].map((score) => (
              <Star key={score} size={16} />
            ))}
          </span>
          Đánh giá lớp học
        </Btn>
      </div>
      <div className="sp-split">
        <Card>
          <SectionHeader
            title="Lịch học tuần này"
            description={`${formatDate(currentWeek)} – ${formatDate(addDays(currentWeek, 6))}`}
          >
            <Btn size="xs" variant="ghost" to="/student/lichhoc">
              Xem lịch học <ChevronRight size={13} />
            </Btn>
          </SectionHeader>
          <div className="sp-home-schedule">
            {weekSessions.length ? (
              weekSessions.map((session) => (
                <div className="sp-home-session" key={session.ma}>
                  <span className="sp-home-day">
                    <strong>{formatWeekday(session.ngay)}</strong>
                    <small>
                      {session.ngay.slice(8)}/{session.ngay.slice(5, 7)}
                    </small>
                  </span>
                  <div>
                    <h3>{getCourseName(data, session.maKhoa)}</h3>
                    <p>
                      {session.batDau} – {session.ketThuc} · {session.phong} · {session.giangVien}
                    </p>
                    <Chip tone={session.trangThai === 'daHoc' ? 'green' : 'blue'}>
                      {session.trangThai === 'daHoc' ? 'Đã học' : 'Sắp học'}
                    </Chip>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="Tuần này chưa có lịch học"
                description="Các buổi học mới sẽ hiển thị khi lịch được cập nhật."
              />
            )}
          </div>
        </Card>
        <Card>
          <SectionHeader title="Học phí & Hóa đơn" />
          {nextInvoice ? (
            <div className="sp-home-invoice">
              <small>{nextInvoice.tieuDe}</small>
              <strong className="sp-home-amount">{formatCurrency(nextInvoice.soTien)}</strong>
              <p>Hạn thanh toán: {formatDate(nextInvoice.hanThanhToan)}</p>
              <Btn to={`/student/hocphi?thanhToan=${nextInvoice.ma}`} icon={CreditCard}>
                Thanh toán ngay
              </Btn>
            </div>
          ) : (
            <div className="sp-home-invoice">
              <strong className="sp-home-amount">Đã hoàn tất</strong>
              <p>Hiện không có học phí cần thanh toán.</p>
              <Btn to="/student/hocphi" variant="soft">
                Xem hóa đơn
              </Btn>
            </div>
          )}
          {invoices
            .filter((invoice) => invoice.trangThai === 'daThanhToan')
            .slice(0, 2)
            .map((invoice) => (
              <Link className="sp-home-paid" key={invoice.ma} to={`/student/hocphi/${invoice.ma}`}>
                <span>{invoice.tieuDe.replace('Học phí ', '')}</span>
                <Chip tone="green">Đã thanh toán</Chip>
              </Link>
            ))}
        </Card>
      </div>
      <div className="sp-split">
        <Card>
          <SectionHeader title="Kết quả & nhận xét gần đây">
            <Btn variant="ghost" size="xs" to="/student/ketqua">
              Xem tất cả <ChevronRight size={13} />
            </Btn>
          </SectionHeader>
          {results.slice(0, 2).map((result) => (
            <Link className="sp-home-result" key={result.ma} to={`/student/ketqua/${result.ma}`}>
              <div>
                <strong>
                  {result.tieuDe} — {getCourseName(data, result.maKhoa)}
                </strong>
                <b>{result.diemTong.toFixed(1)} / 10</b>
              </div>
              <p>“{result.nhanXet}”</p>
            </Link>
          ))}
          {!results.length && (
            <EmptyState
              title="Chưa có kết quả công bố"
              description="Điểm và nhận xét của giảng viên sẽ hiển thị tại đây."
            />
          )}
        </Card>
        <Card>
          <SectionHeader title="Thông báo mới">
            <Btn variant="ghost" size="xs" to="/student/thongbao">
              Xem tất cả
            </Btn>
          </SectionHeader>
          {notifications.slice(0, 3).map((notification) => (
            <Link
              className="sp-home-notice"
              key={notification.ma}
              to={`/student/thongbao/${notification.ma}`}
            >
              <span>
                <Bell size={14} />
              </span>
              <div>
                <strong>{notification.tieuDe}</strong>
                <small>
                  {formatDate(notification.ngayGui)}
                  {!notification.daDoc && ' · Chưa đọc'}
                </small>
              </div>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}
