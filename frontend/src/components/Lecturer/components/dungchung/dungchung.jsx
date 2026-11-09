import { useEffect, useState } from 'react';
import { SearchBox, Card, Btn } from '../../../../common/ui/index';
import { useLopGiangDay } from '../../layout/dulieulophoc';

export function useDuLieu(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');

    async function loadData() {
      try {
        const value = await loader();
        if (active) setData(value);
      } catch (err) {
        if (active) setError(err.message || 'Không tải được dữ liệu.');
      }
    }
    // Chờ sang lượt tiếp theo, giống các lời gọi API bất đồng bộ.
    Promise.resolve().then(loadData);
    return () => { active = false; };
  }, [...deps, version]);
  function reload() {
    setVersion(current => current + 1);
  }
  return { data, setData, error, reload };
}
export function DangTai({ error, retry }) {
  return (
    <Card>
      <p role={error ? 'alert' : 'status'}>{error || 'Đang tải dữ liệu…'}</p>
      {error && retry && <Btn onClick={retry}>Thử lại</Btn>}
    </Card>
  );
}
export function LoiDuLieu({ children }) {
  if (!children) return null;
  return <p className="lc-error" role="alert">{children}</p>;
}
export function ChonLop({ value, onChange, classes }) {
  const lecturerClasses = useLopGiangDay();
  const options = classes ?? lecturerClasses;
  return (
    <select className="lc-select" aria-label="Chọn lớp học" value={value} onChange={event => onChange(event.target.value)}>
      {options.map(classItem => <option key={classItem.id} value={classItem.id}>{classItem.name}</option>)}
    </select>
  );
}
export function HocVien({ student }) {
  const initial = student.name.split(' ').at(-1)[0];
  return (
    <span className="lc-person">
      <span className="lc-avatar">{initial}</span>
      <span><strong>{student.name}</strong><small>{student.id}</small></span>
    </span>
  );
}
export function BangDuLieu({ headings, children }) {
  return (
    <div className="lc-table-wrap">
      <table className="lc-table">
        <thead><tr>{headings.map((heading, index) => <th key={index}>{heading}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function TimKiem({ value, onChange }) {
  return <SearchBox value={value} onChange={onChange} placeholder="Tìm theo tên, mã học viên…" />;
}
export function khopTimKiem(student, query) {
  const studentText = `${student.name} ${student.id}`.toLocaleLowerCase('vi');
  return studentText.includes(query.toLocaleLowerCase('vi'));
}
export function diemTrungBinh(scores) {
  const valid = scores.length === 4 && scores.every(value => {
    const score = Number(value);
    return value !== '' && value !== null && Number.isFinite(score)
      && score >= 0 && score <= 9 && (score * 2) % 1 === 0;
  });
  if (!valid) return null;
  const total = scores.reduce((sum, value) => sum + Number(value), 0);
  return (total / 4).toFixed(1);
}
export function hienNgayGio(date) {
  return new Date(date).toLocaleString('vi-VN');
}
export function taiTep(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ngayHocKeTiep(lop, ngayGoc = new Date().toLocaleDateString('en-CA')) {
  const ngay = new Date(`${ngayGoc}T12:00:00`);
  for (let i = 0; i < 7; i++) {
    const weekday = (ngay.getDay() + 6) % 7;
    if (lop?.days.includes(weekday)) {
      const year = ngay.getFullYear();
      const month = String(ngay.getMonth() + 1).padStart(2, '0');
      const day = String(ngay.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    ngay.setDate(ngay.getDate() + 1);
  }
  return ngayGoc;
}
