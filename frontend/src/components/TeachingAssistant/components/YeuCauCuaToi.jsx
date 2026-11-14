import { useMemo, useState } from "react";
import {
  CheckCheck,
  ClipboardList,
  Clock3,
  FileCheck2,
  Plus,
  Send,
  XCircle,
} from "lucide-react";
import {
  Btn,
  Card,
  CardHead,
  Chip,
  DataTable,
  Dialog,
  SearchBox,
  SelectField,
  StatCard,
} from "../../../common/ui";
import {
  usePageHeader as useTieuDeTrang,
  useManager as useNguCanhQuanLy,
} from "../../Manager/layout/ManagerContext";
import { useTroGiang } from "../layout/NguCanhTroGiang";
import {
  dinhDangNgayGio,
  locTheoTuKhoa,
  TrangThaiTaiDuLieu,
} from "./DungChung";
import GuiYeuCauModal from "./GuiYeuCauModal";

const TRANG_THAI_YEU_CAU = {
  PENDING: { nhan: "Chờ giảng viên duyệt", mau: "amber" },
  APPROVED: { nhan: "Đã duyệt", mau: "green" },
  REJECTED: { nhan: "Bị từ chối", mau: "red" },
  RETURNED: { nhan: "Cần chỉnh sửa", mau: "red" },
  CANCELLED: { nhan: "Đã hủy", mau: "gray" },
};

function NhanTrangThai({ trangThai }) {
  const hienThi = TRANG_THAI_YEU_CAU[trangThai];
  return (
    <Chip tone={hienThi?.mau ?? "gray"}>{hienThi?.nhan ?? trangThai}</Chip>
  );
}

function taoLichSu(duLieu) {
  const cacYeuCau = duLieu.requests.map((yeuCau) => ({
    ...yeuCau,
    maDong: `yeucau-${yeuCau.id}`,
    loai: "yeucau",
    moTa: "Yêu cầu mở quyền nhập điểm",
  }));
  const cacBangDiem = duLieu.submissions.map((bangDiem) => ({
    ...bangDiem,
    maDong: `bangdiem-${bangDiem.id}`,
    loai: "bangdiem",
    moTa: `Điểm đã gửi duyệt (${bangDiem.studentCount} HV)`,
  }));
  return [...cacYeuCau, ...cacBangDiem].sort(
    (dongTruoc, dongSau) =>
      new Date(dongSau.createdAt) - new Date(dongTruoc.createdAt),
  );
}

const CAC_COT_LICH_SU = [
  {
    key: "moTa",
    label: "NỘI DUNG",
    render: (dong) => (
      <span className="ta-history-content">
        {dong.loai === "yeucau" ? <Send size={17} /> : <FileCheck2 size={17} />}
        <span>
          <strong>{dong.moTa}</strong>
          <small>{dong.title}</small>
        </span>
      </span>
    ),
  },
  {
    key: "className",
    label: "LỚP",
    render: (dong) => <strong>{dong.className}</strong>,
  },
  {
    key: "from",
    label: "THỜI GIAN",
    render: (dong) =>
      dong.from ? (
        <span className="ta-history-time">
          {dinhDangNgayGio(dong.from)}
          <br />
          {dinhDangNgayGio(dong.to)}
        </span>
      ) : (
        "—"
      ),
  },
  {
    key: "createdAt",
    label: "GỬI LÚC",
    render: (dong) => dinhDangNgayGio(dong.createdAt),
  },
  {
    key: "status",
    label: "TRẠNG THÁI",
    render: (dong) => <NhanTrangThai trangThai={dong.status} />,
  },
  {
    key: "reviewNote",
    label: "GHI CHÚ GIẢNG VIÊN",
    render: (dong) => (
      <span className="ta-review-note">
        {dong.reviewNote ||
          (dong.status === "APPROVED" ? "Đã được phê duyệt" : "—")}
      </span>
    ),
  },
];

function ChiTietYeuCau({ noiDung, dong }) {
  return (
    <Dialog
      title={noiDung.moTa}
      subtitle={`${noiDung.className} · ${noiDung.title}`}
      onClose={dong}
    >
      <div className="ta-history-detail">
        <NhanTrangThai trangThai={noiDung.status} />
        <dl>
          <div>
            <dt>Giảng viên phụ trách</dt>
            <dd>{noiDung.teacher || "—"}</dd>
          </div>
          <div>
            <dt>Gửi lúc</dt>
            <dd>{dinhDangNgayGio(noiDung.createdAt)}</dd>
          </div>
          {noiDung.from && (
            <div>
              <dt>Thời gian đề nghị</dt>
              <dd>
                {dinhDangNgayGio(noiDung.from)} – {dinhDangNgayGio(noiDung.to)}
              </dd>
            </div>
          )}
          <div>
            <dt>Lý do / ghi chú của bạn</dt>
            <dd>{noiDung.note || "—"}</dd>
          </div>
          <div>
            <dt>Phản hồi giảng viên</dt>
            <dd>{noiDung.reviewNote || "Chưa có phản hồi"}</dd>
          </div>
          {noiDung.reviewedAt && (
            <div>
              <dt>Phản hồi lúc</dt>
              <dd>{dinhDangNgayGio(noiDung.reviewedAt)}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="u-modal__foot">
        <Btn variant="muted" onClick={dong}>
          Đóng
        </Btn>
        {noiDung.grantId && (
          <Btn to={`/assistant/chamdiem/nhap/${noiDung.grantId}`}>
            Xem bảng điểm
          </Btn>
        )}
      </div>
    </Dialog>
  );
}

export default function YeuCauCuaToi() {
  useTieuDeTrang(
    "Yêu cầu của tôi",
    "Yêu cầu nhập điểm và điểm đã gửi giảng viên duyệt",
  );
  const { duLieu, dangTai, loiTai, taiLaiDuLieu } = useTroGiang();
  const { notify: thongBao } = useNguCanhQuanLy();
  const [moYeuCau, datMoYeuCau] = useState(false);
  const [tuKhoa, datTuKhoa] = useState("");
  const [trangThai, datTrangThai] = useState("");
  const [noiDungChon, datNoiDungChon] = useState(null);
  const lichSu = useMemo(() => taoLichSu(duLieu), [duLieu]);
  const thongKe = useMemo(
    () =>
      lichSu.reduce(
        (tong, dong) => {
          if (dong.status === "APPROVED") tong.daDuyet += 1;
          if (dong.status === "PENDING") tong.choDuyet += 1;
          if (["REJECTED", "RETURNED"].includes(dong.status)) tong.canSua += 1;
          return tong;
        },
        { daDuyet: 0, choDuyet: 0, canSua: 0 },
      ),
    [lichSu],
  );

  if (loiTai) return <TrangThaiTaiDuLieu loi={loiTai} thuLai={taiLaiDuLieu} />;
  if (dangTai && !duLieu.classes.length) return <TrangThaiTaiDuLieu />;

  const lichSuLoc = locTheoTuKhoa(
    lichSu,
    tuKhoa,
    (dong) =>
      `${dong.className} ${dong.title} ${dong.moTa} ${dong.teacher ?? ""}`,
  ).filter((dong) => !trangThai || dong.status === trangThai);

  function xemChiTiet(dong) {
    const lop = duLieu.classes.find(
      (lop) => String(lop.id) === String(dong.classId),
    );
    datNoiDungChon({ ...dong, teacher: dong.teacher || lop?.teacher });
  }

  return (
    <div className="ta-workflow-page">
      <div className="ta-workflow-toolbar">
        <div className="ta-workflow-tabs">
          <Btn variant="ghost" to="/assistant/chamdiem">
            Quyền nhập điểm
          </Btn>
          <Btn
            variant="soft"
            icon={ClipboardList}
            to="/assistant/chamdiem/yeucau"
            aria-current="page"
          >
            Yêu cầu của tôi
          </Btn>
        </div>
        <Btn icon={Plus} onClick={() => datMoYeuCau(true)}>
          Gửi yêu cầu nhập điểm
        </Btn>
      </div>
      <div className="ta-history-stats">
        <StatCard icon={Send} label="Yêu cầu đã gửi" value={lichSu.length} />
        <StatCard
          icon={CheckCheck}
          label="Đã duyệt"
          value={thongKe.daDuyet}
          accent="green"
        />
        <StatCard
          icon={Clock3}
          label="Chờ giảng viên duyệt"
          value={thongKe.choDuyet}
          accent="amber"
        />
        <StatCard
          icon={XCircle}
          label="Bị từ chối / cần sửa"
          value={thongKe.canSua}
          accent="red"
        />
      </div>
      <Card className="ta-history-card">
        <CardHead
          title="Yêu cầu và điểm đã gửi"
          sub="Theo dõi trạng thái phê duyệt và phản hồi của giảng viên"
        />
        <div className="ta-workflow-filters">
          <SearchBox
            value={tuKhoa}
            onChange={datTuKhoa}
            placeholder="Tìm lớp, kỳ điểm, yêu cầu…"
          />
          <SelectField
            label="Trạng thái"
            value={trangThai}
            onChange={(suKien) => datTrangThai(suKien.target.value)}
            options={[
              { value: "", label: "Tất cả trạng thái" },
              ...Object.entries(TRANG_THAI_YEU_CAU).map(
                ([giaTri, hienThi]) => ({ value: giaTri, label: hienThi.nhan }),
              ),
            ]}
          />
        </div>
        <DataTable
          columns={CAC_COT_LICH_SU}
          rows={lichSuLoc}
          rowKey="maDong"
          onRowClick={xemChiTiet}
          empty={
            lichSu.length
              ? "Không có yêu cầu phù hợp với bộ lọc."
              : "Bạn chưa gửi yêu cầu hoặc bảng điểm nào. Gửi yêu cầu để giảng viên cấp quyền nhập điểm."
          }
        />
        <p className="ta-table-caption">
          {lichSuLoc.length} / {lichSu.length} nội dung · Chọn một dòng để xem
          chi tiết
        </p>
      </Card>
      {moYeuCau && (
        <GuiYeuCauModal
          dong={() => datMoYeuCau(false)}
          khiGuiThanhCong={() => thongBao("Đã lưu yêu cầu nhập điểm mẫu")}
        />
      )}
      {noiDungChon && (
        <ChiTietYeuCau
          noiDung={noiDungChon}
          dong={() => datNoiDungChon(null)}
        />
      )}
    </div>
  );
}
