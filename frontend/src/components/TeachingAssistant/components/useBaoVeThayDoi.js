import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

export default function useBaoVeThayDoi(chuaLuu, {
  choPhepRoiTrangRef,
  thongDiep = 'Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?',
} = {}) {
  const lanXacNhanRef = useRef(null);
  const chanDieuHuong = useBlocker(({ currentLocation: viTriHienTai, nextLocation: viTriTiepTheo }) => {
    const diaChiHienTai = `${viTriHienTai.pathname}${viTriHienTai.search}`;
    const diaChiTiepTheo = `${viTriTiepTheo.pathname}${viTriTiepTheo.search}`;
    return chuaLuu && !choPhepRoiTrangRef?.current && diaChiHienTai !== diaChiTiepTheo;
  });

  useEffect(() => {
    if (chanDieuHuong.state !== 'blocked') {
      lanXacNhanRef.current = null;
      return;
    }
    if (lanXacNhanRef.current === chanDieuHuong.location.key) return;
    lanXacNhanRef.current = chanDieuHuong.location.key;
    if (window.confirm(thongDiep)) chanDieuHuong.proceed();
    else chanDieuHuong.reset();
  }, [chanDieuHuong, thongDiep]);

  useEffect(() => {
    function canhBaoDongTrang(suKien) {
      if (!chuaLuu || choPhepRoiTrangRef?.current) return;
      suKien.preventDefault();
      suKien.returnValue = '';
    }
    window.addEventListener('beforeunload', canhBaoDongTrang);
    return () => window.removeEventListener('beforeunload', canhBaoDongTrang);
  }, [chuaLuu, choPhepRoiTrangRef]);
}
