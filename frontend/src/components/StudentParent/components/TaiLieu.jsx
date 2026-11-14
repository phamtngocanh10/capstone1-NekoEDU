import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, FileAudio, FileText, FolderOpen } from 'lucide-react';
import {
  Card as The,
  Chip as Nhan,
  Pills as Boloc,
  SearchBox as Otimkiem,
  SelectField as Ochon,
} from '../../../common/ui';
import { useHocvienphuhuynh } from '../layout/NguCanhHocVien';
import { Tepdinhkem, Tieudekhoi, Trangtrong } from './DungChung';
import { dinhdangngay, loctheotukhoa, tenkhoahoc } from './tienIch';
import './hoc-tap.css';

const cacloaitep = [
  { value: '', label: 'Tất cả' },
  { value: 'PDF', label: 'PDF' },
  { value: 'MP3', label: 'Âm thanh' },
  { value: 'DOCX', label: 'Tài liệu Word' },
];

export default function Tailieu() {
  const { duLieu: dulieu, hocVien: hocvien, cacKhoaDangHoc: cackhoadanghoc } = useHocvienphuhuynh();
  const [thamso, datthamso] = useSearchParams();
  const tukhoatudiachi = thamso.get('timkiem') ?? '';
  const [tukhoa, dattukhoa] = useState(tukhoatudiachi);
  const [makhoa, datmakhoa] = useState(thamso.get('khoa') ?? '');
  const [loaitep, datloaitep] = useState('');
  const mahocviencu = useRef(hocvien.ma);
  const cacmakhoa = new Set(cackhoadanghoc.map((khoa) => khoa.ma));
  const makhoahople = cacmakhoa.has(makhoa) ? makhoa : '';
  const cactailieu = dulieu.taiLieu.filter(
    (tep) =>
      cacmakhoa.has(tep.maKhoa) &&
      (!makhoahople || tep.maKhoa === makhoahople) &&
      (!loaitep || tep.loai === loaitep)
  );
  const cactailieuhienthi = loctheotukhoa(
    cactailieu,
    tukhoa,
    (tep) => `${tep.ten} ${tenkhoahoc(dulieu, tep.maKhoa)}`
  ).sort((truoc, sau) => sau.ngayDang.localeCompare(truoc.ngayDang));

  useEffect(() => {
    dattukhoa(tukhoatudiachi);
    datmakhoa(thamso.get('khoa') ?? '');
  }, [tukhoatudiachi, thamso]);

  useEffect(() => {
    if (mahocviencu.current === hocvien.ma) return;
    mahocviencu.current = hocvien.ma;
    dattukhoa('');
    datmakhoa('');
    datloaitep('');
    datthamso({}, { replace: true });
  }, [hocvien.ma, datthamso]);

  return (
    <div className="sp-page sp-study-page">
      <The className="sp-library-intro">
        <span className="sp-study-icon">
          <FolderOpen size={25} />
        </span>
        <div>
          <h2>Thư viện học tập</h2>
          <p>Tài liệu được giảng viên chia sẻ cho các khóa {hocvien.ten} đang theo học.</p>
        </div>
        <Nhan tone="blue">{cactailieu.length} tài liệu</Nhan>
      </The>
      <div className="sp-toolbar sp-library-toolbar">
        <Otimkiem value={tukhoa} onChange={dattukhoa} placeholder="Tìm tài liệu..." />
        <Ochon
          label="Khóa học"
          value={makhoahople}
          onChange={(sukien) => datmakhoa(sukien.target.value)}
          options={[
            { value: '', label: 'Tất cả khóa học' },
            ...cackhoadanghoc.map((khoa) => ({ value: khoa.ma, label: khoa.ten })),
          ]}
        />
      </div>
      <Boloc items={cacloaitep} value={loaitep} onChange={datloaitep} />
      <Tieudekhoi
        tieuDe="Tài liệu của lớp"
        moTa={`${cactailieuhienthi.length} tài liệu phù hợp · Chỉ hiển thị các khóa học đang theo học`}
      />
      {cactailieuhienthi.length ? (
        <div className="sp-grid-3 sp-library-grid">
          {cactailieuhienthi.map((tep) => {
            const Bieutuong = tep.loai === 'MP3' ? FileAudio : FileText;
            return (
              <The
                className={`sp-library-file sp-library-file--${tep.loai.toLowerCase()}`}
                key={tep.ma}
              >
                <div className="sp-library-file__visual">
                  <Bieutuong size={36} strokeWidth={1.5} />
                  <Nhan
                    tone={tep.loai === 'MP3' ? 'amber' : tep.loai === 'DOCX' ? 'blue' : 'green'}
                  >
                    .{tep.loai.toLowerCase()}
                  </Nhan>
                </div>
                <Tepdinhkem tep={tep} />
                <div className="sp-library-file__metadata">
                  <span>
                    <BookOpen size={13} />
                    {tenkhoahoc(dulieu, tep.maKhoa)}
                  </span>
                  <small>
                    {tep.dungLuong} · {dinhdangngay(tep.ngayDang)}
                  </small>
                </div>
              </The>
            );
          })}
        </div>
      ) : (
        <Trangtrong
          tieuDe="Chưa có tài liệu phù hợp"
          moTa={
            tukhoa
              ? 'Thử tìm kiếm bằng từ khóa khác hoặc đổi bộ lọc.'
              : 'Tài liệu của những khóa học đang theo học sẽ xuất hiện tại đây.'
          }
        />
      )}
      <p className="sp-muted">
        Các tệp được tạo từ nội dung minh họa để bạn dùng thử chức năng xem và tải xuống.
      </p>
    </div>
  );
}
