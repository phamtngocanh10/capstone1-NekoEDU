import { createContext, useContext, useMemo, useState } from 'react';
import { duLieuTroGiang } from '../duLieuTroGiang';
import { useTaiDuLieu } from '../components/DungChung';

const NguCanhTroGiang = createContext(null);
const DU_LIEU_RONG = { staffId: null, classes: [], periods: [], grants: [], requests: [], submissions: [] };

export function CungCapTroGiang({ children: noiDung }) {
  const {
    duLieu: duLieuDaTai,
    dangTai,
    loi: loiTai,
    taiLai: taiLaiDuLieu,
  } = useTaiDuLieu(() => duLieuTroGiang.layKhongGian());
  const duLieu = useMemo(() => ({ ...DU_LIEU_RONG, ...duLieuDaTai }), [duLieuDaTai]);
  const [tuKhoa, datTuKhoa] = useState('');

  const nguCanh = useMemo(() => ({ duLieu, taiLaiDuLieu, dangTai, loiTai, tuKhoa, datTuKhoa }),
    [duLieu, taiLaiDuLieu, dangTai, loiTai, tuKhoa]);
  return <NguCanhTroGiang.Provider value={nguCanh}>{noiDung}</NguCanhTroGiang.Provider>;
}

export function useTroGiang() {
  const nguCanh = useContext(NguCanhTroGiang);
  if (!nguCanh) throw new Error('useTroGiang cần nằm trong CungCapTroGiang.');
  return nguCanh;
}
