import { Card, CardHead, Chip } from '../../../../common/ui';
import { useStudentParent } from '../../layout/NguCanhHocVien';
import { formatDate } from '../shared/tienIch';
import ProfileForm from './BieuMauHoSo';
import '../../styles/ca-nhan.css';

export default function Profile() {
  const { data, student, saveProfile, notify } = useStudentParent();
  return (
    <div className="sp-page sp-profile">
      <ProfileForm
        key={data.taiKhoan.ma}
        account={data.taiKhoan}
        saveProfile={saveProfile}
        notify={notify}
      />
      <Card>
        <CardHead
          title="Học viên liên kết"
          sub="Tài khoản gia đình dùng chung để theo dõi quá trình học tập"
        />
        <div className="sp-profile-children">
          {data.hocVien.map((studentDetails) => (
            <article
              key={studentDetails.ma}
              className={
                studentDetails.ma === student.ma
                  ? 'sp-profile-child is-selected'
                  : 'sp-profile-child'
              }
            >
              <span className="sp-profile-child__initial">
                {studentDetails.ten.trim().split(/\s+/).at(-1)?.charAt(0)}
              </span>
              <div>
                <strong>{studentDetails.ten}</strong>
                <span>{studentDetails.maSo}</span>
                <small>
                  {studentDetails.gioiTinh} · {formatDate(studentDetails.ngaySinh)}
                </small>
              </div>
              {studentDetails.ma === student.ma && <Chip tone="green">Đang xem</Chip>}
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}
