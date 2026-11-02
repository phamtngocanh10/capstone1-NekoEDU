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
// import { login } from '../api/auth' // bỏ comment khi có backend

const ROLES = [
  { icon: ShieldCheck, name: "Manager", desc: "Toàn quyền vận hành" },
  { icon: BookOpen, name: "Lecturer", desc: "Giảng viên" },
  { icon: ClipboardCheck, name: "Teaching Assistant", desc: "Trợ giảng" },
  { icon: User, name: "Student / Parent", desc: "Tài khoản dùng chung" },
];

const newCaptcha = () => Math.random().toString(36).slice(2, 7).toUpperCase();

export default function LoginPage() {
  const navigate = useNavigate();
  const [captcha, setCaptcha] = useState(newCaptcha);

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: await login({ username, password }) rồi lưu token vào localStorage 'access_token'
    navigate("/tongquan");
  };

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
            label="Email hoặc số điện thoại"
            icon={Mail}
            placeholder="vd: minhkhoi@gmail.com"
          />
          <Input
            label="Mật khẩu"
            icon={Lock}
            type="password"
            placeholder="••••••••"
          />

          <div>
            <span className="field__label">Mã xác nhận</span>
            <div className="captcha">
              <div className="captcha__code" aria-label="Mã xác nhận">
                {[...captcha].map((c, i) => (
                  <span key={i}>{c}</span>
                ))}
              </div>
              <button
                type="button"
                className="captcha__refresh"
                onClick={() => setCaptcha(newCaptcha())}
                aria-label="Đổi mã khác"
              >
                <RotateCcw size={20} />
              </button>
            </div>
          </div>
          <Input icon={ShieldCheck} placeholder="Nhập mã xác nhận ở trên" />

          <div className="login__row">
            <label className="check">
              <input type="checkbox" defaultChecked /> Ghi nhớ đăng nhập
            </label>
            <Link to="/quenmatkhau">Quên mật khẩu?</Link>
          </div>

          <Button type="submit" block>
            Đăng nhập
          </Button>
        </form>
      </section>
    </div>
  );
}
