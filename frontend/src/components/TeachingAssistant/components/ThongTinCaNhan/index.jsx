import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  Camera,
  KeyRound,
  Mail,
  MapPin,
  MonitorSmartphone,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import Button from '../../../../common/Button.jsx';
import Input from '../../../../common/Input.jsx';
import { initialOf, useManager } from '../../../Manager/layout/ManagerContext.jsx';
import { saveDemoAccount } from '../../data/duLieuTaiKhoan';

function getProfileFields(account) {
  return {
    name: account.name,
    phone: account.phone,
    email: account.email,
    address: account.address,
  };
}

function readAvatar(imageFile) {
  return new Promise((onSuccess, onError) => {
    const reader = new FileReader();
    reader.onload = () => onSuccess(String(reader.result));
    reader.onerror = () => onError(new Error('Không đọc được ảnh. Vui lòng chọn tệp khác.'));
    reader.readAsDataURL(imageFile);
  });
}

export default function Profile() {
  const { user: account, updateUser, openPasswordModal, notify } = useManager();
  const [form, setForm] = useState(() => getProfileFields(account));
  const [readingImage, setReadingImage] = useState(false);
  const [error, setError] = useState('');
  const imageInput = useRef(null);

  useEffect(() => {
    setForm(getProfileFields(account));
  }, [account.name, account.phone, account.email, account.address]);

  const hasChanges = Object.keys(form).some((fieldName) => form[fieldName] !== account[fieldName]);
  const valid = Boolean(form.name.trim() && /\S+@\S+\.\S+/.test(form.email));

  function changeField(fieldName, value) {
    setForm((previousData) => ({ ...previousData, [fieldName]: value }));
  }

  function saveChanges(changes, message) {
    const savedProfile = saveDemoAccount({ ...account, ...changes });
    updateUser(savedProfile);
    notify(message);
  }

  function saveProfile(event) {
    event.preventDefault();
    setError('');
    const phoneNumber = form.phone.replace(/\s/g, '');
    if (phoneNumber && !/^0\d{9}$/.test(phoneNumber)) {
      setError('Số điện thoại cần có 10 chữ số và bắt đầu bằng 0.');
      return;
    }
    try {
      saveChanges(
        {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: phoneNumber,
          address: form.address.trim(),
        },
        'Đã lưu hồ sơ mẫu trên trình duyệt'
      );
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function changeAvatar(event) {
    const imageFile = event.target.files?.[0];
    event.target.value = '';
    if (!imageFile) return;
    setError('');
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(imageFile.type) ||
      !imageFile.size ||
      imageFile.size > 1024 * 1024
    ) {
      setError('Chọn ảnh PNG, JPEG hoặc WEBP có dung lượng tối đa 1 MB.');
      return;
    }
    setReadingImage(true);
    try {
      const avatar = await readAvatar(imageFile);
      saveChanges({ avatarUrl: avatar }, 'Đã cập nhật ảnh đại diện mẫu trên trình duyệt');
    } catch (imageError) {
      setError(imageError.message);
    } finally {
      setReadingImage(false);
    }
  }

  return (
    <div className="profile ta-profile">
      <div className="profile__top">
        <section className="card profile-card">
          <div className="profile-card__avatar">
            <span>
              {account.avatarUrl ? (
                <img
                  src={account.avatarUrl}
                  alt={account.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 'inherit',
                  }}
                />
              ) : (
                initialOf(account.name)
              )}
            </span>
            <input
              type="file"
              ref={imageInput}
              hidden
              accept="image/png,image/jpeg,image/webp"
              onChange={changeAvatar}
            />
            <button
              type="button"
              aria-label="Đổi ảnh đại diện"
              disabled={readingImage}
              onClick={() => imageInput.current?.click()}
            >
              <Camera size={13} />
            </button>
          </div>
          <strong>{account.name}</strong>
          <span className="chip chip--info">Trợ giảng</span>
          <ul>
            <li>
              <Mail size={14} />
              {account.email}
            </li>
            <li>
              <CalendarDays size={14} />
              Tham gia từ {account.joined}
            </li>
          </ul>
        </section>

        <form className="card" onSubmit={saveProfile}>
          <div className="card__head">
            <h3>Thông tin chung</h3>
          </div>
          <div className="form-grid">
            <Input
              label="Họ và tên"
              icon={User}
              value={form.name}
              maxLength={100}
              required
              onChange={(event) => changeField('name', event.target.value)}
            />
            <Input
              label="Số điện thoại"
              icon={Phone}
              value={form.phone}
              maxLength={20}
              onChange={(event) => changeField('phone', event.target.value)}
            />
            <Input
              label="Email"
              icon={Mail}
              type="email"
              value={form.email}
              maxLength={150}
              required
              onChange={(event) => changeField('email', event.target.value)}
            />
            <Input
              label="Vai trò"
              icon={ShieldCheck}
              value="Teaching Assistant"
              readOnly
              disabled
            />
            <div className="form-grid__full">
              <Input
                label="Địa chỉ"
                icon={MapPin}
                value={form.address}
                maxLength={255}
                onChange={(event) => changeField('address', event.target.value)}
              />
            </div>
          </div>
          <div className="form-actions">
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={readingImage || !hasChanges || !valid}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </div>

      <section className="card">
        <div className="card__head">
          <h3>Bảo mật tài khoản</h3>
        </div>
        <ul className="sec-list">
          <li>
            <span className="sec__icon">
              <KeyRound size={16} />
            </span>
            <div>
              <strong>Mật khẩu</strong>
              <small>Xem trước biểu mẫu; bản mẫu không lưu hoặc thay đổi mật khẩu</small>
            </div>
            <button type="button" className="pill-btn" onClick={openPasswordModal}>
              <KeyRound size={13} />
              Đổi mật khẩu
            </button>
          </li>
          <li>
            <span className="sec__icon">
              <MonitorSmartphone size={16} />
            </span>
            <div>
              <strong>Chế độ xem trước</strong>
              <small>Hồ sơ và ảnh mẫu được lưu trên trình duyệt này</small>
            </div>
            <span className="chip chip--info">Dữ liệu mẫu</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
