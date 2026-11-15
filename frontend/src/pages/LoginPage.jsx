import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GraduationCap,
  Mail,
  Lock,
  ShieldCheck,
  RotateCcw,
  BookOpen,
  ClipboardCheck,
  User,
} from "lucide-react";
import Button from "../common/Button";
import Input from "../common/Input";
import { login } from '../api/auth';
import { loginStudentParent, isStudentParentAccount, DEMO_CREDENTIALS } from "../components/StudentParent/data/duLieuDangNhap";

const ROLES = [
  { icon: ShieldCheck, name: "Manager", desc: "Toàn quyền vận hành" },
  { icon: BookOpen, name: "Lecturer", desc: "Giảng viên" },
  { icon: ClipboardCheck, name: "Teaching Assistant", desc: "Trợ giảng" },
  { icon: User, name: "Student / Parent", desc: "Tài khoản dùng chung" },
];

const newCaptcha = () => Math.random().toString(36).slice(2, 7).toUpperCase();

function getRememberedUsername() {
  try {
    return localStorage.getItem("neko-login-username") || "";
  } catch {
    return "";
  }
}

function rememberUsername(username, rememberAccount) {
  if (rememberAccount) localStorage.setItem('neko-login-username', username);
  else localStorage.removeItem('neko-login-username');
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [captcha, setCaptcha] = useState(newCaptcha);
  const [usernameInput, setUsernameInput] = useState(getRememberedUsername);
  const [password, setPassword] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [rememberAccount, setRememberAccount] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function refreshCaptcha() {
    setCaptcha(newCaptcha());
    setCaptchaInput("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (captchaInput.trim().toUpperCase() !== captcha) {
      setError("Mã xác nhận chưa đúng. Vui lòng kiểm tra lại.");
      return;
    }
    setSubmitting(true);
    try {
      const username = usernameInput.trim();
      if (isStudentParentAccount(username)) {
        loginStudentParent(username, password);
        rememberUsername(username, rememberAccount);
        navigate('/student/trangchu', { replace: true });
        return;
      }
      const result = await login({
        username,
        password,
        captcha: captchaInput.trim(),
      });
      const roleName = result.user?.role?.toLowerCase();
      if (roleName !== "manager" && roleName !== "lecturer") {
        throw new Error("Tài khoản chưa được cấp quyền truy cập giao diện này.");
      }
      const isLecturer = roleName === "lecturer";
      const user = { ...result.user, role: isLecturer ? "Lecturer" : "Manager" };
      localStorage.setItem("neko-auth-user", JSON.stringify(user));
      if (result.access_token) {
        localStorage.setItem("access_token", result.access_token);
      } else {
        localStorage.removeItem("access_token");
      }
      rememberUsername(username, rememberAccount);
      navigate(isLecturer ? "/lecturer/tongquan" : "/tongquan", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? "Không thể đăng nhập. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <section className="login__hero">
        <div className="login__brand">
          <span className="logo logo--white">
            <GraduationCap size={20} />
          </span>
          <div>
            <strong>NEKO EDU</strong>
            <small>Smart English Center Management Platform</small>
          </div>
        </div>

        <h1>Vận hành trung tâm Anh ngữ, gọn trong một nền tảng duy nhất.</h1>
        <p>
          Tuyển sinh, lớp học, điểm danh, học phí và báo cáo được kết nối trong
          cùng một hệ thống{" "}
        </p>

        <div className="roles">
          {ROLES.map(({ icon: Icon, name, desc }) => (
            <div className="role" key={name}>
              <span className="role__icon">
                <Icon size={16} />
              </span>
              <div>
                <strong>{name}</strong>
                <small>{desc}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="login__panel">
        <form className="login__form" onSubmit={handleSubmit}>
          <h2>Đăng nhập</h2>
          <p className="login__sub">
            Nhập thông tin tài khoản để truy cập NEKO EDU
          </p>

          <Input
            label="Tài khoản"
            icon={Mail}
            placeholder="Nhập tài khoản hoặc email"
            name="username"
            autoComplete="username"
            required
            value={usernameInput}
            onChange={(event) => setUsernameInput(event.target.value)}
          />
          <Input
            label="Mật khẩu"
            icon={Lock}
            type="password"
            placeholder="••••••••"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <div>
            <span className="field__label">Mã xác nhận</span>
            <div className="captcha">
              <div className="captcha__code" aria-label="Mã xác nhận">
                {[...captcha].map((character, index) => (
                  <span key={index}>{character}</span>
                ))}
              </div>
              <button
                type="button"
                className="captcha__refresh"
                onClick={refreshCaptcha}
                aria-label="Đổi mã khác"
              >
                <RotateCcw size={20} />
              </button>
            </div>
          </div>
          <Input
            icon={ShieldCheck}
            aria-label="Nhập mã xác nhận"
            placeholder="Nhập mã xác nhận ở trên"
            required
            autoComplete="off"
            maxLength={5}
            value={captchaInput}
            onChange={(event) => setCaptchaInput(event.target.value)}
          />

          <div className="login__row">
            <label className="check">
              <input type="checkbox" checked={rememberAccount} onChange={(event) => setRememberAccount(event.target.checked)} /> Ghi nhớ tài khoản
            </label>
            <Link to="/quenmatkhau">Quên mật khẩu?</Link>
          </div>

          {error && <p className="login__error" role="alert">{error}</p>}
          <Button type="submit" block disabled={submitting}>
            {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
          <p className="login__student-note">Tài khoản mẫu Học viên / Phụ huynh:<br />
            <strong>{DEMO_CREDENTIALS.username}</strong> / <strong>{DEMO_CREDENTIALS.password}</strong>
          </p>
        </form>
      </section>
    </div>
  );
}
