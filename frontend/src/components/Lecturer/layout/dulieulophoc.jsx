import { createContext, useContext, useEffect, useState } from 'react';
import { apiGiangVien } from '../../../api/giangvien';

const NguCanhLopHoc = createContext([]);
export function useLopGiangDay() {
  return useContext(NguCanhLopHoc);
}
export function CungCapLopHoc({ children }) {
  const [classes, setClasses] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    async function loadClasses() {
      try {
        const data = await apiGiangVien.classes();
        if (active) setClasses(data);
      } catch (err) {
        if (active) setError(err.message);
      }
    }
    loadClasses();
    return () => { active = false; };
  }, [version]);
  if (error) {
    return (
      <div className="lc-pad" role="alert">
        {error}<button onClick={() => setVersion(current => current + 1)}>Thử lại</button>
      </div>
    );
  }
  if (!classes) return <p className="lc-pad" role="status">Đang tải lớp học…</p>;
  if (!classes.length) {
    return <div className="lc-pad">Bạn chưa được phân công lớp học nào. <a href="/login">Quay lại đăng nhập</a></div>;
  }
  return <NguCanhLopHoc.Provider value={classes}>{children}</NguCanhLopHoc.Provider>;
}
