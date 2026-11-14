import { ngayhomnay, taoma } from '../components/tienIch.js';

const cacphuongthuc = ['chuyenKhoan', 'viDienTu', 'tienMat'];

function batbuoc(dieukien, thongdiep) {
  if (!dieukien) throw new Error(thongdiep);
}

export function layhocvien(dulieu) {
  return dulieu.hocVien.find((hocvien) => hocvien.ma === dulieu.maHocVien) ?? dulieu.hocVien[0];
}

export function laykhoadanghoc(dulieu, mahocvien) {
  const cacmakhoa = new Set(
    dulieu.ghiDanh
      .filter((ghidanh) => ghidanh.maHocVien === mahocvien && ghidanh.trangThai === 'dangHoc')
      .map((ghidanh) => ghidanh.maKhoa)
  );
  return dulieu.khoaHoc.filter((khoa) => cacmakhoa.has(khoa.ma));
}

export function layhoadon(dulieu, mahocvien) {
  return dulieu.hoaDon.filter((hoadon) => hoadon.maHocVien === mahocvien);
}

export function laythongbao(dulieu, mahocvien) {
  return dulieu.thongBao.filter(
    (thongbao) => !thongbao.maHocVien || thongbao.maHocVien === mahocvien
  );
}

// Các thao tác chỉ sửa bản sao được truyền vào; provider lưu thành công rồi mới cập nhật giao diện.
export function doihocvien(dulieu, ma) {
  batbuoc(
    dulieu.hocVien.some((hocvien) => hocvien.ma === ma),
    'Không tìm thấy hồ sơ học viên.'
  );
  dulieu.maHocVien = ma;
}

export function dangkykhoahoc(
  dulieu,
  { maKhoa: makhoa, maHocVien: mahocvien, phuongThuc: phuongthuc }
) {
  const khoa = dulieu.khoaHoc.find((khoa) => khoa.ma === makhoa);
  batbuoc(
    khoa && dulieu.hocVien.some((hocvien) => hocvien.ma === mahocvien),
    'Thông tin học viên hoặc khóa học chưa đúng.'
  );
  batbuoc(cacphuongthuc.includes(phuongthuc), 'Vui lòng chọn phương thức thanh toán.');
  batbuoc(khoa.siSo < khoa.sucChua, 'Lớp học đã đủ sĩ số.');
  batbuoc(
    !dulieu.ghiDanh.some(
      (ghidanh) =>
        ghidanh.maHocVien === mahocvien &&
        ghidanh.maKhoa === makhoa &&
        ['dangHoc', 'choXacNhan'].includes(ghidanh.trangThai)
    ),
    'Học viên đã đăng ký hoặc đang theo học khóa này.'
  );
  const ghidanh = {
    ma: taoma('dangky'),
    maHocVien: mahocvien,
    maKhoa: makhoa,
    phuongThuc: phuongthuc,
    trangThai: 'choXacNhan',
    ngayDangKy: new Date().toISOString(),
  };
  dulieu.ghiDanh.unshift(ghidanh);
  return ghidanh;
}

export function thanhtoanhoadon(dulieu, mahoadon, phuongthuc) {
  const hocvien = layhocvien(dulieu);
  const hoadon = dulieu.hoaDon.find(
    (hoadon) => hoadon.ma === mahoadon && hoadon.maHocVien === hocvien.ma
  );
  batbuoc(hoadon, 'Không tìm thấy hóa đơn của học viên đang xem.');
  batbuoc(hoadon.trangThai !== 'daThanhToan', 'Hóa đơn này đã được thanh toán trong bản mẫu.');
  batbuoc(cacphuongthuc.includes(phuongthuc), 'Phương thức thanh toán chưa đúng.');
  Object.assign(hoadon, {
    trangThai: 'daThanhToan',
    phuongThuc: phuongthuc,
    ngayThanhToan: ngayhomnay(),
    maGiaoDich: taoma('NEKO-MAU').toUpperCase(),
  });
  return hoadon;
}

export function danhdauthongbao(dulieu, mathongbao, dadoc = true) {
  const hocvien = layhocvien(dulieu);
  const thongbao = laythongbao(dulieu, hocvien.ma).find((thongbao) => thongbao.ma === mathongbao);
  batbuoc(thongbao, 'Không tìm thấy thông báo cho học viên đang xem.');
  thongbao.daDoc = Boolean(dadoc);
  return thongbao;
}

export function doctatcathongbao(dulieu) {
  const hocvien = layhocvien(dulieu);
  laythongbao(dulieu, hocvien.ma).forEach((thongbao) => {
    thongbao.daDoc = true;
  });
}

export function guiphanhoi(dulieu, { maThongBao: mathongbao, noiDung: noidung }) {
  const hocvien = layhocvien(dulieu);
  batbuoc(
    laythongbao(dulieu, hocvien.ma).some((thongbao) => thongbao.ma === mathongbao),
    'Thông báo không thuộc hồ sơ đang xem.'
  );
  const noidungsach = String(noidung ?? '').trim();
  batbuoc(
    noidungsach && noidungsach.length <= 2000,
    'Nội dung phản hồi cần có từ 1 đến 2.000 ký tự.'
  );
  const phanhoi = {
    ma: taoma('phanhoi'),
    maThongBao: mathongbao,
    maHocVien: hocvien.ma,
    noiDung: noidungsach,
    ngayGui: new Date().toISOString(),
    trangThai: 'daGui',
  };
  dulieu.phanHoiThongBao.unshift(phanhoi);
  return phanhoi;
}

export function guidanhgia(dulieu, noidung) {
  const hocvien = layhocvien(dulieu);
  batbuoc(
    laykhoadanghoc(dulieu, hocvien.ma).some((khoa) => khoa.ma === noidung.maKhoa),
    'Chỉ có thể đánh giá khóa học đang theo học.'
  );
  const {
    chatLuongGiangDay: chatluonggiangday,
    coSoVatChat: cosovatchat,
    hoTroTrungTam: hotrotrungtam,
  } = noidung;
  batbuoc(
    [chatluonggiangday, cosovatchat, hotrotrungtam].every(
      (diem) => Number.isInteger(diem) && diem >= 1 && diem <= 5
    ),
    'Vui lòng chọn từ 1 đến 5 sao cho cả ba tiêu chí.'
  );
  const nhanxet = String(noidung.nhanXet ?? '').trim();
  batbuoc(nhanxet && nhanxet.length <= 1000, 'Nhận xét cần có từ 1 đến 1.000 ký tự.');
  const danhgia = {
    ma: taoma('danhgia'),
    maHocVien: hocvien.ma,
    maKhoa: noidung.maKhoa,
    chatLuongGiangDay: chatluonggiangday,
    coSoVatChat: cosovatchat,
    hoTroTrungTam: hotrotrungtam,
    nhanXet: nhanxet,
    ngayGui: new Date().toISOString(),
  };
  dulieu.danhGia.unshift(danhgia);
  return danhgia;
}

export function luuhoso(dulieu, noidung) {
  const ten = String(noidung.ten ?? '').trim();
  const thudientu = String(noidung.email ?? '').trim();
  const dienthoai = String(noidung.dienThoai ?? '').trim();
  const diachi = String(noidung.diaChi ?? '').trim();
  const anhdaidien = String(noidung.anhDaiDien ?? '');
  batbuoc(ten.length >= 2 && ten.length <= 100, 'Họ tên cần có từ 2 đến 100 ký tự.');
  batbuoc(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(thudientu) && thudientu.length <= 255,
    'Email chưa hợp lệ.'
  );
  batbuoc(
    /^0\d{9}$/.test(dienthoai.replace(/[\s.-]/g, '')),
    'Số điện thoại cần có 10 chữ số và bắt đầu bằng 0.'
  );
  batbuoc(diachi.length <= 255, 'Địa chỉ tối đa 255 ký tự.');
  batbuoc(
    !anhdaidien ||
      (anhdaidien.length <= 1500000 && /^data:image\/(png|jpeg|webp);base64,/.test(anhdaidien)),
    'Ảnh đại diện chưa hợp lệ hoặc vượt quá 1 MB.'
  );
  Object.assign(dulieu.taiKhoan, {
    ten,
    email: thudientu,
    dienThoai: dienthoai,
    diaChi: diachi,
    anhDaiDien: anhdaidien,
  });
  return dulieu.taiKhoan;
}
