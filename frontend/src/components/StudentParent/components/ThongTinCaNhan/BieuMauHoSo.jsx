import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  KeyRound,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { Btn, Card, CardHead, Chip, TextField, TextAreaField } from '../../../../common/ui';
import DemoPasswordModal from './DoiMatKhauMau';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_AVATAR_SIZE = 1024 * 1024;

function ProfileAvatar({ name, imageUrl }) {
  const initial = name?.trim().split(/\s+/).at(-1)?.charAt(0) || 'M';
  return (
    <span className="sp-profile-avatar">
      {imageUrl ? <img src={imageUrl} alt={`Ảnh đại diện ${name}`} /> : initial}
    </span>
  );
}

export default function ProfileForm({ account, saveProfile, notify }) {
  const [profile, setProfile] = useState(() => ({ ...account }));
  const [error, setError] = useState('');
  const [readingImage, setReadingImage] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const imageReadVersionRef = useRef(0);

  useEffect(() => {
    setProfile({ ...account });
    setReadingImage(false);
    setError('');
    return () => {
      imageReadVersionRef.current += 1;
    };
  }, [account.ten, account.email, account.dienThoai, account.diaChi, account.anhDaiDien]);

  function changeField(fieldName, value) {
    setProfile((previousProfile) => ({ ...previousProfile, [fieldName]: value }));
    setError('');
  }

  function selectAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const imageReadVersion = ++imageReadVersionRef.current;
    setReadingImage(false);
    if (!IMAGE_TYPES.includes(file.type)) {
      setError('Vui lòng chọn ảnh PNG, JPEG hoặc WebP.');
      return;
    }
    if (file.size >= MAX_AVATAR_SIZE) {
      setError('Ảnh đại diện cần nhỏ hơn 1 MB.');
      return;
    }
    setReadingImage(true);
    setError('');
    const reader = new FileReader();
    reader.onerror = () => {
      if (imageReadVersion !== imageReadVersionRef.current) return;
      setReadingImage(false);
      setError('Không đọc được ảnh. Vui lòng chọn lại.');
    };
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        if (imageReadVersion !== imageReadVersionRef.current) return;
        changeField('anhDaiDien', reader.result);
        setReadingImage(false);
      };
      image.onerror = () => {
        if (imageReadVersion !== imageReadVersionRef.current) return;
        setReadingImage(false);
        setError('Tệp này không phải ảnh hợp lệ. Vui lòng chọn ảnh khác.');
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    imageReadVersionRef.current += 1;
    setReadingImage(false);
    changeField('anhDaiDien', '');
  }

  function submitProfile(event) {
    event.preventDefault();
    setError('');
    if (readingImage) return;
    if (profile.ten.trim().length < 2) {
      setError('Họ và tên cần có ít nhất 2 ký tự.');
      return;
    }
    if (!/^(0\d{9}|\+84\d{9})$/.test(profile.dienThoai.trim())) {
      setError('Vui lòng nhập số điện thoại gồm 10 chữ số hoặc bắt đầu bằng +84.');
      return;
    }
    try {
      const content = {
        ...profile,
        ten: profile.ten.trim(),
        email: profile.email.trim(),
        dienThoai: profile.dienThoai.trim().replace(/^\+84/, '0'),
        diaChi: profile.diaChi.trim(),
      };
      saveProfile(content);
      setProfile(content);
      notify('Đã lưu hồ sơ mẫu trên trình duyệt.');
    } catch (saveError) {
      setError(saveError.message || 'Chưa lưu được hồ sơ. Vui lòng thử lại.');
    }
  }

  return (
    <>
      <div className="sp-profile-layout">
        <aside className="sp-stack">
          <Card className="sp-profile-summary">
            <ProfileAvatar name={profile.ten} imageUrl={profile.anhDaiDien} />
            <h2>{profile.ten || 'Hồ sơ phụ huynh'}</h2>
            <p>{account.email}</p>
            <Chip tone="blue" icon={Users}>
              Học viên / Phụ huynh
            </Chip>
            <div className="sp-profile-upload">
              <label className="sp-upload-photo">
                <Camera size={15} />
                <span>{readingImage ? 'Đang đọc ảnh…' : 'Chọn ảnh đại diện'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Chọn ảnh đại diện"
                  onChange={selectAvatar}
                />
              </label>
              {profile.anhDaiDien && (
                <Btn variant="ghost" size="sm" icon={Trash2} onClick={removeAvatar}>
                  Xóa ảnh
                </Btn>
              )}
            </div>
            <small>
              PNG, JPEG hoặc WebP · nhỏ hơn 1 MB.
              <br />
              Ảnh được lưu cùng thay đổi hồ sơ.
            </small>
          </Card>
          <Card className="sp-profile-security">
            <ShieldCheck size={22} />
            <h3>Bảo mật tài khoản</h3>
            <p>Thử biểu mẫu đổi mật khẩu trong giao diện mẫu.</p>
            <Btn variant="soft" icon={KeyRound} onClick={() => setIsPasswordModalOpen(true)}>
              Đổi mật khẩu
            </Btn>
          </Card>
        </aside>

        <Card>
          <CardHead
            title="Thông tin tài khoản"
            sub="Quản lý thông tin liên hệ của học viên và phụ huynh"
          />
          <form onSubmit={submitProfile} className="sp-stack">
            <div className="sp-form-grid">
              <TextField
                label="Họ và tên"
                icon={User}
                required
                value={profile.ten}
                maxLength={100}
                autoComplete="name"
                onChange={(event) => changeField('ten', event.target.value)}
              />
              <TextField
                label="Email"
                icon={Mail}
                type="email"
                required
                value={profile.email}
                maxLength={255}
                autoComplete="email"
                onChange={(event) => changeField('email', event.target.value)}
              />
              <TextField
                label="Số điện thoại"
                type="tel"
                required
                value={profile.dienThoai}
                maxLength={15}
                autoComplete="tel"
                onChange={(event) => changeField('dienThoai', event.target.value)}
              />
              <TextField label="Vai trò" value="Học viên / Phụ huynh" readOnly />
            </div>
            <TextAreaField
              label="Địa chỉ liên hệ"
              value={profile.diaChi}
              maxLength={255}
              rows={3}
              autoComplete="street-address"
              onChange={(event) => changeField('diaChi', event.target.value)}
            />
            <p className="sp-note sp-profile-local">
              <CheckCircle2 size={17} />
              <span>Hồ sơ này dùng dữ liệu mẫu và chỉ được lưu trên trình duyệt hiện tại.</span>
            </p>
            {error && (
              <p className="sp-error" role="alert">
                {error}
              </p>
            )}
            <div className="sp-profile-actions">
              <Btn
                variant="ghost"
                onClick={() => {
                  imageReadVersionRef.current += 1;
                  setReadingImage(false);
                  setProfile({ ...account });
                  setError('');
                }}
              >
                Hủy thay đổi
              </Btn>
              <Btn type="submit" icon={Save} disabled={readingImage}>
                Lưu thay đổi
              </Btn>
            </div>
          </form>
        </Card>
      </div>
      {isPasswordModalOpen && (
        <DemoPasswordModal onClose={() => setIsPasswordModalOpen(false)} notify={notify} />
      )}
    </>
  );
}
