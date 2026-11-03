import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import Button from "../common/Button";
import Input from "../common/Input";
import "../styles/recovery.css";

function PasswordField({ label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="field__box">
        <input
          required
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder="Nhập mật khẩu của bạn"
        />
        <button
          className="recovery__visibility"
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

export default function PasswordRecoveryPage({ reset = false }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const requirements = [
    { label: "Ít nhất 8 ký tự", valid: password.length >= 8 },
    { label: "Có chữ hoa và chữ thường", valid: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: "Có ít nhất 1 chữ số", valid: /\d/.test(password) },
  ];

  function handlePasswordChange(event) {
    setPassword(event.target.value);
    setError("");
  }

  function handleConfirmationChange(event) {
    setConfirmation(event.target.value);
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!reset) {
      navigate("/datlaimatkhau", { state: { email: email.trim() } });
      return;
    }
    if (!requirements.every(({ valid }) => valid)) {
      setError("Mật khẩu mới chưa đáp ứng các yêu cầu bên dưới.");
      return;
    }
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận không khớp. Vui lòng nhập lại.");
      return;
    }
    setSubmitted(true);
  }

  return (
    <main className="recovery">
      <section className="recovery__hero" aria-label="NEKO EDU">
        <Link className="recovery__brand" to="/login">
          <span className="recovery__logo"><GraduationCap size={23} /></span>
          <span><strong>NEKO EDU</strong><small>Smart English Center Management Platform</small></span>
        </Link>
        <span className="recovery__bubble recovery__bubble--book" aria-hidden="true"><BookOpen size={24} /></span>
        <span className="recovery__bubble recovery__bubble--users" aria-hidden="true"><Users size={22} /></span>
        <span className="recovery__bubble recovery__bubble--cap" aria-hidden="true"><GraduationCap size={23} /></span>
        <span className="recovery__bubble recovery__bubble--shield" aria-hidden="true"><ShieldCheck size={21} /></span>
        <div className="recovery__intro">
          {reset && <h1>Tạo mật khẩu mới,<br />an toàn hơn cho tài khoản.</h1>}
          <p>{reset ? "Một bước nhỏ để bảo vệ hành trình học tập và quản lý trung tâm của bạn." : "Lấy lại quyền truy cập NEKO EDU chỉ với một email xác nhận và vài bước đơn giản."}</p>
        </div>
        <footer>© {new Date().getFullYear()} NEKO EDU · Hệ thống quản lý trung tâm Anh ngữ</footer>
      </section>

      <section className="recovery__panel">
        <form className="recovery__form" onSubmit={handleSubmit}>
          <header>
            <span className={`recovery__badge${reset ? " recovery__badge--green" : ""}`}>{reset ? <KeyRound size={23} /> : <LockKeyhole size={23} />}</span>
            <h2>{reset ? "Đặt lại mật khẩu" : "Quên mật khẩu"}</h2>
            <p className="recovery__subtitle">{reset ? "Tạo mật khẩu mới để tiếp tục truy cập NEKO EDU." : "Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu."}</p>
          </header>

          {submitted ? (
            <div className="recovery__notice" role="status">
              <strong>{reset ? "Mật khẩu hợp lệ" : "Email hợp lệ"}</strong>
              <p>{reset ? "Bản demo giao diện: mật khẩu chưa được lưu. Cần kết nối API để hoàn tất đặt lại mật khẩu." : `Bản demo giao diện: chưa gửi email đến ${email}. Cần kết nối API để gửi liên kết khôi phục.`}</p>
              {!reset && <Link className="recovery__demo" to="/datlaimatkhau">Xem giao diện đặt lại mật khẩu <span aria-hidden="true">→</span></Link>}
            </div>
          ) : (
            <>
              {reset ? (
                <>
                  <PasswordField
                    label="Mật khẩu mới"
                    value={password}
                    onChange={handlePasswordChange}
                    autoComplete="new-password"
                  />
                  <PasswordField
                    label="Nhập lại mật khẩu mới"
                    value={confirmation}
                    onChange={handleConfirmationChange}
                    autoComplete="new-password"
                  />
                  <ul className="recovery__requirements" aria-label="Yêu cầu mật khẩu">
                    {requirements.map(({ label, valid }) => (
                      <li key={label} className={valid ? "is-valid" : ""}>
                        <Check size={13} aria-hidden="true" />
                        {label}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <Input
                  label="Email đăng ký"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="VD: tenban@gmail.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
              {error && <p className="recovery__error" role="alert">{error}</p>}
              <Button type="submit" block>{reset ? "Đặt lại mật khẩu" : "Gửi liên kết đặt lại mật khẩu"}</Button>
            </>
          )}

          <Link className="recovery__back" to="/login"><ArrowLeft size={15} />Quay lại đăng nhập</Link>
          {!reset && <p className="recovery__help"><ShieldCheck size={16} /><span>Vì lý do bảo mật, liên kết đặt lại mật khẩu sẽ có thời hạn sử dụng. Đừng chia sẻ liên kết này với bất kỳ ai.</span></p>}
        </form>
      </section>
    </main>
  );
}
