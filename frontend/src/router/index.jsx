import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import PlaceholderPage from "../pages/PlaceholderPage";

// Manager
import ManagerLayout from "../components/Manager/layout/ManagerLayout";
import TongQuan from "../components/Manager/components/TongQuan";
import HocVien from "../components/Manager/components/HocVien";
import HoSoHocVien from "../components/Manager/components/HocVien/HoSoHocVien";
import KhoaHoc from "../components/Manager/components/KhoaHoc";
import DanhSachLop from "../components/Manager/components/KhoaHoc/DanhSachLop";
import ChiTietLop from "../components/Manager/components/KhoaHoc/ChiTietLop";
import LichPhanCong from "../components/Manager/components/LichPhanCong";
import ChiTietKhungGio from "../components/Manager/components/LichPhanCong/ChiTietKhungGio";
import GiangVien from "../components/Manager/components/GiangVien";
import HoSoGiangVien from "../components/Manager/components/GiangVien/HoSoGiangVien";
import LichDayGiangVien from "../components/Manager/components/GiangVien/LichDayGiangVien";
import DiemDanh from "../components/Manager/components/DiemDanh"; // trang "Điểm số"
import DiemKhoaHoc from "../components/Manager/components/DiemDanh/DiemKhoaHoc";
import BangDiemLop from "../components/Manager/components/DiemDanh/BangDiemLop";
import NhapDiem from "../components/Manager/components/DiemDanh/NhapDiem";
import HocPhi from "../components/Manager/components/HocPhi";
import NguyCo from "../components/Manager/components/HocPhi/NguyCo";
import DuyetThongBao from "../components/Manager/components/HocPhi/DuyetThongBao";
import LichSuThanhToan from "../components/Manager/components/HocPhi/LichSuThanhToan";
import ThuChi from "../components/Manager/components/ThuChi";
import ThongBao from "../components/Manager/components/ThongBao";
import SoanThongBao from "../components/Manager/components/ThongBao/SoanThongBao";
import ChiTietThongBao from "../components/Manager/components/ThongBao/ChiTietThongBao";
import TuyenSinh from "../components/Manager/components/TuyenSinh";
import PhanQuyen from "../components/Manager/components/PhanQuyen";
import ThongTinCaNhan from "../components/Manager/components/ThongTinCaNhan";

// Cuộn lên đầu trang mỗi khi đổi đường dẫn (trang chi tiết mở từ danh sách dài)
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function AppRouter() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/quenmatkhau"
          element={<PlaceholderPage title="Quên mật khẩu" />}
        />
        <Route path="/dangky" element={<PlaceholderPage title="Đăng ký" />} />

        {/* Manager — trang con nằm dưới đường dẫn của mục sidebar tương ứng nên sidebar luôn sáng đúng mục */}
        <Route element={<ManagerLayout />}>
          <Route path="/tongquan" element={<TongQuan />} />

          <Route path="/hocvien" element={<HocVien />} />
          <Route path="/hocvien/:studentId" element={<HoSoHocVien />} />

          <Route path="/khoahoc" element={<KhoaHoc />} />
          <Route path="/khoahoc/:courseId" element={<DanhSachLop />} />
          <Route path="/khoahoc/:courseId/lop/:classId" element={<ChiTietLop />} />

          <Route path="/lichphancong" element={<LichPhanCong />} />
          <Route path="/lichphancong/:date" element={<ChiTietKhungGio />} />

          <Route path="/giangvien" element={<GiangVien />} />
          <Route path="/giangvien/:lecturerId" element={<HoSoGiangVien />} />
          <Route path="/giangvien/:lecturerId/lich" element={<LichDayGiangVien />} />

          <Route path="/diemdanh" element={<DiemDanh />} />
          <Route path="/diemdanh/khoahoc/:courseId" element={<DiemKhoaHoc />} />
          <Route path="/diemdanh/lop/:classId" element={<BangDiemLop />} />
          <Route path="/diemdanh/nhap-diem" element={<NhapDiem />} />

          <Route path="/hocphi" element={<HocPhi />} />
          <Route path="/hocphi/nguy-co" element={<NguyCo />} />
          <Route path="/hocphi/duyet-thong-bao" element={<DuyetThongBao />} />
          <Route path="/hocphi/lich-su" element={<LichSuThanhToan />} />

          <Route path="/thuchi" element={<ThuChi />} />

          <Route path="/thongbao" element={<ThongBao />} />
          <Route path="/thongbao/soan" element={<SoanThongBao />} />
          <Route path="/thongbao/:id" element={<ChiTietThongBao />} />

          <Route path="/tuyensinh/:tab?" element={<TuyenSinh />} />
          <Route path="/phanquyen/:tab?" element={<PhanQuyen />} />

          <Route path="/thongtincanhan" element={<ThongTinCaNhan />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
