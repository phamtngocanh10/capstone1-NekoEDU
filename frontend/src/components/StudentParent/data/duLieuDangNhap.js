export const DEMO_SESSION_KEY = 'neko-student-parent-session-v1';
export const DEMO_CREDENTIALS = Object.freeze({ username: 'ph01', password: 'Neko@2026' });

export function isStudentParentAccount(username) {
  return ['ph01', 'hv01'].includes(String(username).trim().toLowerCase());
}

export function loginStudentParent(username, password) {
  if (!isStudentParentAccount(username) || password !== DEMO_CREDENTIALS.password) {
    throw new Error('Tài khoản hoặc mật khẩu chưa đúng.');
  }
  try {
    localStorage.setItem(
      DEMO_SESSION_KEY,
      JSON.stringify({
        taiKhoan: String(username).trim().toLowerCase(),
        vaiTro: 'StudentParent',
      })
    );
  } catch {
    throw new Error(
      'Không lưu được phiên đăng nhập. Hãy cho phép trình duyệt lưu dữ liệu rồi thử lại.'
    );
  }
}

export function isStudentParentLoggedIn() {
  try {
    const session = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY));
    return session?.vaiTro === 'StudentParent' && isStudentParentAccount(session.taiKhoan);
  } catch {
    return false;
  }
}

export function logoutStudentParent() {
  try {
    localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    throw new Error('Chưa đăng xuất được. Vui lòng thử lại.');
  }
}
