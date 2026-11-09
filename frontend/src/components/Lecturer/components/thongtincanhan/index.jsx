import ThongTinCaNhanChung from '../../../Manager/components/ThongTinCaNhan';
import { apiGiangVien } from '../../../../api/giangvien';

export default function ThongTinCaNhanGiangVien() {
  return <ThongTinCaNhanChung onSave={apiGiangVien.saveProfile} />;
}
