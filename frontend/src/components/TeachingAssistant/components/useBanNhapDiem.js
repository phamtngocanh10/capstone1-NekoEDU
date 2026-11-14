import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { duLieuTroGiang } from '../duLieuTroGiang';
import { MA_LOI } from '../luuTruMau';
import { useTaiDuLieu } from './DungChung';
import { daNhapDuDiem, diemHopLe, taoDuLieuDiem } from './xuLyDiem';
import useBaoVeThayDoi from './useBaoVeThayDoi';

const THOI_GIAN_TU_LUU = 1000;
const CHU_KY_KIEM_TRA_QUYEN = 15000;

export default function useBanNhapDiem(maQuyen) {
  const { duLieu: banNhap, loi: loiTai, taiLai } = useTaiDuLieu(() => duLieuTroGiang.layBanNhap(maQuyen), [maQuyen]);
  const [cacDong, datCacDong] = useState([]);
  const [noiDungDaLuu, datNoiDungDaLuu] = useState('');
  const [luuLuc, datLuuLuc] = useState(null);
  const [loi, datLoi] = useState('');
  const [trangThaiLuu, datTrangThaiLuu] = useState('chuaLuu');
  const [dangGui, datDangGui] = useState(false);
  const [dangTaiLai, datDangTaiLai] = useState(false);
  const [xungDot, datXungDot] = useState(false);
  const [thoiDiemHienTai, datThoiDiemHienTai] = useState(Date.now());

  const cacDongHienTaiRef = useRef([]);
  const phienBanRef = useRef(null);
  const noiDungDaLuuRef = useRef('');
  const hangDoiLuuRef = useRef(Promise.resolve());
  const dangHienThiRef = useRef(true);
  const dangGuiRef = useRef(false);
  const dangTaiLaiRef = useRef(false);
  const xungDotRef = useRef(false);
  const choPhepRoiTrangRef = useRef(false);

  useEffect(() => {
    dangHienThiRef.current = true;
    const boDem = setInterval(() => datThoiDiemHienTai(Date.now()), CHU_KY_KIEM_TRA_QUYEN);
    return () => {
      dangHienThiRef.current = false;
      clearInterval(boDem);
    };
  }, []);

  useEffect(() => {
    if (!banNhap) return;
    const cacDongBanDau = banNhap.rows.map(dong => ({
      ...dong,
      scores: dong.scores.map(giaTri => giaTri ?? ''),
      note: dong.note || '',
    }));
    const noiDungBanDau = JSON.stringify(taoDuLieuDiem(cacDongBanDau));
    cacDongHienTaiRef.current = cacDongBanDau;
    phienBanRef.current = banNhap.version;
    noiDungDaLuuRef.current = noiDungBanDau;
    xungDotRef.current = false;
    datCacDong(cacDongBanDau);
    datNoiDungDaLuu(noiDungBanDau);
    datLuuLuc(banNhap.updatedAt);
    datLoi('');
    datTrangThaiLuu('chuaLuu');
    datXungDot(false);
  }, [banNhap]);

  const noiDungHienTai = useMemo(() => JSON.stringify(taoDuLieuDiem(cacDong)), [cacDong]);
  const coThayDoi = Boolean(noiDungDaLuu) && noiDungHienTai !== noiDungDaLuu;
  const coDiemSai = cacDong.some(dong => dong.scores.some(giaTri => !diemHopLe(giaTri)));
  const hetHanLuc = banNhap?.closesAt ? new Date(banNhap.closesAt).getTime() : Infinity;
  const duocNhap = Boolean(banNhap?.editable) && thoiDiemHienTai <= hetHanLuc;

  const luuTheoThuTu = useCallback(cacDongCanLuu => {
    const duLieuDiem = taoDuLieuDiem(cacDongCanLuu);
    const noiDungCanLuu = JSON.stringify(duLieuDiem);

    // Mỗi yêu cầu dùng phiên bản từ lần lưu trước, kể cả khi người dùng nhập nhanh.
    const thaoTacLuu = hangDoiLuuRef.current.catch(() => {}).then(async () => {
      if (!dangHienThiRef.current) return false;
      if (xungDotRef.current) throw new Error('Bản nháp đã thay đổi. Hãy tải lại trước khi tiếp tục.');
      if (noiDungCanLuu === noiDungDaLuuRef.current) return true;
      datTrangThaiLuu('dangLuu');

      try {
        const ketQua = await duLieuTroGiang.luuBanNhap(maQuyen, {
          rows: duLieuDiem,
          version: phienBanRef.current,
        });
        phienBanRef.current = ketQua.version;
        noiDungDaLuuRef.current = noiDungCanLuu;
        if (dangHienThiRef.current) {
          datNoiDungDaLuu(noiDungCanLuu);
          datLuuLuc(ketQua.updatedAt);
          datTrangThaiLuu('daLuu');
          datLoi('');
        }
        return true;
      } catch (loiLuu) {
        if ([MA_LOI.PHIEN_BAN_CU, MA_LOI.QUYEN_DA_DONG].includes(loiLuu.ma)) {
          xungDotRef.current = true;
          if (dangHienThiRef.current) datXungDot(true);
        }
        if (dangHienThiRef.current) {
          datTrangThaiLuu('loi');
          datLoi(loiLuu.message || 'Chưa lưu được bản nháp. Các điểm bạn nhập vẫn được giữ trên màn hình.');
        }
        throw loiLuu;
      }
    });

    hangDoiLuuRef.current = thaoTacLuu;
    return thaoTacLuu;
  }, [maQuyen]);

  useEffect(() => {
    if (!coThayDoi || !duocNhap || coDiemSai || dangGui || dangTaiLai || trangThaiLuu === 'loi') return;
    const boDem = setTimeout(() => {
      luuTheoThuTu(cacDongHienTaiRef.current).catch(() => {});
    }, THOI_GIAN_TU_LUU);
    return () => clearTimeout(boDem);
  }, [noiDungHienTai, coThayDoi, duocNhap, coDiemSai, dangGui, dangTaiLai, trangThaiLuu, luuTheoThuTu]);

  useBaoVeThayDoi(coThayDoi, {
    choPhepRoiTrangRef,
    thongDiep: 'Điểm chưa được lưu nháp. Rời trang và bỏ các điểm chưa lưu?',
  });

  function doiDiem(maHocVien, chiSoKyNang, giaTri) {
    if (!duocNhap || dangGuiRef.current || dangTaiLaiRef.current || xungDotRef.current) return;
    const cacDongMoi = cacDongHienTaiRef.current.map(dong => dong.studentId === maHocVien
      ? { ...dong, scores: dong.scores.map((diem, chiSo) => chiSo === chiSoKyNang ? giaTri : diem) }
      : dong);
    cacDongHienTaiRef.current = cacDongMoi;
    datCacDong(cacDongMoi);
  }

  async function luuBanNhap() {
    if (!duocNhap || dangGuiRef.current || dangTaiLaiRef.current) return false;
    if (coDiemSai) {
      datLoi('Điểm phải từ 0 đến 9, theo bước 0,5.');
      return false;
    }
    return luuTheoThuTu(cacDongHienTaiRef.current);
  }

  async function guiBangDiem() {
    if (!duocNhap || dangGuiRef.current || dangTaiLaiRef.current) return false;
    const cacDongCanGui = cacDongHienTaiRef.current;
    if (!cacDongCanGui.length || !cacDongCanGui.every(daNhapDuDiem)) {
      datLoi('Cần nhập đủ bốn kỹ năng của tất cả học viên trước khi gửi duyệt.');
      return false;
    }

    dangGuiRef.current = true;
    datDangGui(true);
    datLoi('');
    try {
      if (!await luuTheoThuTu(cacDongCanGui)) return false;
      await duLieuTroGiang.guiDuyetDiem(maQuyen, {
        rows: taoDuLieuDiem(cacDongCanGui),
        version: phienBanRef.current,
      });
      choPhepRoiTrangRef.current = true;
      return true;
    } catch (loiGui) {
      if (dangHienThiRef.current) datLoi(loiGui.message || 'Chưa gửi được bảng điểm. Vui lòng thử lại.');
      throw loiGui;
    } finally {
      dangGuiRef.current = false;
      if (dangHienThiRef.current) datDangGui(false);
    }
  }

  async function taiLaiBanNhap() {
    if (dangGuiRef.current || dangTaiLaiRef.current) return;
    dangTaiLaiRef.current = true;
    datDangTaiLai(true);
    try {
      // Đợi lần lưu đang chạy kết thúc để phản hồi cũ không ghi đè phiên bản vừa tải.
      await hangDoiLuuRef.current.catch(() => {});
      if (dangHienThiRef.current) taiLai();
    } finally {
      dangTaiLaiRef.current = false;
      if (dangHienThiRef.current) datDangTaiLai(false);
    }
  }

  return {
    banNhap, cacDong, coThayDoi, coDiemSai, duocNhap, xungDot,
    trangThaiLuu, luuLuc, loi, loiTai, dangGui, dangTaiLai,
    doiDiem, luuBanNhap, guiBangDiem, taiLaiBanNhap,
  };
}
