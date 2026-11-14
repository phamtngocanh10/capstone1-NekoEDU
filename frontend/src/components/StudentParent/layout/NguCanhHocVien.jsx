import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { taodulieumau } from './duLieuMau';
import { docdulieu, khoadulieu, luudulieu, saochep } from './luuTruMau';
import * as xulydulieu from './xulydulieu';

const Ngucanhhocvien = createContext(null);

export function Cungcaphocvien({ children: noidung }) {
  const [dulieu, datdulieu] = useState(docdulieu);
  const dulieuhientai = useRef(dulieu);
  const [loinhan, datloinhan] = useState('');
  const thongbao = useCallback((noidung) => datloinhan(String(noidung)), []);
  const xoathongbao = useCallback(() => datloinhan(''), []);

  useEffect(() => {
    function nhandulieutucuasokhac(sukien) {
      if (sukien.key !== khoadulieu) return;
      const dulieumoi = docdulieu();
      dulieuhientai.current = dulieumoi;
      datdulieu(dulieumoi);
    }
    window.addEventListener('storage', nhandulieutucuasokhac);
    return () => window.removeEventListener('storage', nhandulieutucuasokhac);
  }, []);

  const capnhat = useCallback((hamthaydoi) => {
    // Hai thao tác liên tiếp luôn dùng bản vừa lưu, kể cả khi React chưa render lại.
    const banmoi = saochep(dulieuhientai.current);
    const ketqua = hamthaydoi(banmoi);
    luudulieu(banmoi);
    dulieuhientai.current = banmoi;
    datdulieu(banmoi);
    return ketqua;
  }, []);

  const hocvien = xulydulieu.layhocvien(dulieu);
  const cackhoadanghoc = xulydulieu.laykhoadanghoc(dulieu, hocvien.ma);
  const cachoadon = xulydulieu.layhoadon(dulieu, hocvien.ma);
  const cacthongbao = xulydulieu.laythongbao(dulieu, hocvien.ma);

  function doihocvien(ma) {
    return capnhat((banmoi) => xulydulieu.doihocvien(banmoi, ma));
  }

  function dangkykhoahoc(noidung) {
    return capnhat((banmoi) => xulydulieu.dangkykhoahoc(banmoi, noidung));
  }

  function thanhtoanhoadon(mahoadon, phuongthuc) {
    return capnhat((banmoi) => xulydulieu.thanhtoanhoadon(banmoi, mahoadon, phuongthuc));
  }

  function danhdauthongbao(mathongbao, dadoc = true) {
    return capnhat((banmoi) => xulydulieu.danhdauthongbao(banmoi, mathongbao, dadoc));
  }

  function doctatcathongbao() {
    return capnhat((banmoi) => xulydulieu.doctatcathongbao(banmoi));
  }

  function guiphanhoi(noidung) {
    return capnhat((banmoi) => xulydulieu.guiphanhoi(banmoi, noidung));
  }

  function guidanhgia(noidung) {
    return capnhat((banmoi) => xulydulieu.guidanhgia(banmoi, noidung));
  }

  function luuhoso(noidung) {
    return capnhat((banmoi) => xulydulieu.luuhoso(banmoi, noidung));
  }

  function khoiphucmau() {
    const dulieumoi = taodulieumau();
    luudulieu(dulieumoi);
    dulieuhientai.current = dulieumoi;
    datdulieu(dulieumoi);
  }

  const ngucanh = {
    duLieu: dulieu,
    hocVien: hocvien,
    cacKhoaDangHoc: cackhoadanghoc,
    cacHoaDon: cachoadon,
    cacThongBao: cacthongbao,
    doiHocVien: doihocvien,
    thongBao: thongbao,
    loiNhan: loinhan,
    xoaThongBao: xoathongbao,
    dangKyKhoaHoc: dangkykhoahoc,
    thanhToanHoaDon: thanhtoanhoadon,
    danhDauThongBao: danhdauthongbao,
    docTatCaThongBao: doctatcathongbao,
    guiPhanHoi: guiphanhoi,
    guiDanhGia: guidanhgia,
    luuHoSo: luuhoso,
    khoiPhucMau: khoiphucmau,
  };
  return <Ngucanhhocvien.Provider value={ngucanh}>{noidung}</Ngucanhhocvien.Provider>;
}

export function useHocvienphuhuynh() {
  const ngucanh = useContext(Ngucanhhocvien);
  if (!ngucanh) throw new Error('useHocvienphuhuynh cần nằm trong Cungcaphocvien.');
  return ngucanh;
}
