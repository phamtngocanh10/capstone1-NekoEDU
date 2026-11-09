import { BookOpen, Users, FileSpreadsheet, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, StatCard, Btn } from '../../../../common/ui/index';
import { apiGiangVien } from '../../../../api/giangvien';
import { DangTai, useDuLieu } from '../dungchung/dungchung';
import { DanhSachBuoiHoc } from '../lichgiangday';
import { parseIso, TODAY_ISO } from '../../../Manager/components/LichPhanCong/data';

export default function TongQuan() {
  async function loadOverview() {
    const classes = await apiGiangVien.classes();
    const documents = await apiGiangVien.documents();
    const comments = (await Promise.all(classes.map(classItem => apiGiangVien.comments(classItem.id)))).flat()
      .sort((first, second) => second.date.localeCompare(first.date));
    const sessions = await apiGiangVien.sessions(TODAY_ISO);
    return { classes, documents, comments, sessions };
  }
  const remote = useDuLieu(loadOverview);
  if (!remote.data) return <DangTai error={remote.error} retry={remote.reload} />;
  const { classes, documents, comments, sessions } = remote.data;
  const todayClassCount = sessions.filter(session => session.status !== 'cancelled').length;
  const studentCount = classes.reduce((total, classItem) => total + classItem.size, 0);

  return (
    <div className="u-page lc-page">
      <div className="lc-stats">
        <StatCard icon={BookOpen} label="Lớp hôm nay" value={`${todayClassCount} lớp`} />
        <StatCard icon={Users} label="Học viên đang phụ trách" value={studentCount} accent="blue" />
        <StatCard icon={FileSpreadsheet} label="Bảng điểm" value={`${classes.length} lớp`} accent="amber" />
        <StatCard icon={FolderOpen} label="Tài liệu đã tải lên" value={`${documents.length} file`} accent="green" />
      </div>
      <div className="lc-dashboard-grid">
        <Card>
          <div className="lc-toolbar">
            <h3 className="u-grow">Lịch giảng dạy hôm nay</h3>
            <Link to="/lecturer/lichgiangday">Xem cả tuần</Link>
          </div>
          <p className="u-muted lc-section-title">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
          <DanhSachBuoiHoc classes={classes} date={parseIso(TODAY_ISO)} />
        </Card>
        <div className="u-page">
          <Card>
            <h3 className="lc-section-title">Tải lên bảng điểm</h3>
            <Link className="lc-upload-link" to="/lecturer/bangdiem">
              <FileSpreadsheet size={30} />
              <strong>Chọn file điểm (.xlsx)</strong>
              <span>Kiểm tra dữ liệu trước khi nhập</span>
            </Link>
          </Card>
          <Card>
            <div className="lc-toolbar">
              <h3 className="u-grow">Nhận xét gần đây</h3>
              <Link to="/lecturer/nhanxet">Thêm mới</Link>
            </div>
            {comments.slice(0, 3).map(comment => (
              <div className="lc-comment-preview" key={comment.id}>
                <strong>{comment.studentName}</strong>
                <p>{comment.text}</p>
              </div>
            ))}
            <Btn variant="soft" to="/lecturer/nhanxet">Xem nhận xét học viên</Btn>
          </Card>
        </div>
      </div>
    </div>
  );
}
