export const DEMO_PROFILE_KEY = 'neko-trogiang-demo-profile-v1';
export const DEMO_SESSION_KEY = 'neko-trogiang-demo-session-v1';
export const DEMO_CREDENTIALS = Object.freeze({ username: 'tg01', password: 'Neko@2026' });

const DEMO_ACCOUNT = {
  id: 'tro-giang-mau',
  username: DEMO_CREDENTIALS.username,
  name: 'Nguyễn Thảo Vy',
  role: 'Teaching Assistant',
  email: 'thaovy@neko.edu.vn',
  phone: '0905123456',
  address: 'Hải Châu, Đà Nẵng',
  joined: '09/2025',
  avatarUrl: '',
};

export function isAssistantAccount(username) {
  return String(username).trim().toLowerCase() === DEMO_CREDENTIALS.username;
}

export function loginAssistant(username, password) {
  if (!isAssistantAccount(username) || password !== DEMO_CREDENTIALS.password) {
    throw new Error('Tài khoản hoặc mật khẩu chưa đúng.');
  }
  try {
    // Phiên mẫu chỉ giữ danh tính, không lưu mật khẩu hay ghi đè token API.
    localStorage.setItem(
      DEMO_SESSION_KEY,
      JSON.stringify({
        id: DEMO_ACCOUNT.id,
        username: DEMO_CREDENTIALS.username,
        role: DEMO_ACCOUNT.role,
      })
    );
  } catch {
    throw new Error(
      'Không lưu được phiên đăng nhập. Vui lòng cho phép trình duyệt lưu dữ liệu rồi thử lại.'
    );
  }
}

export function isAssistantLoggedIn() {
  try {
    const sessionData = JSON.parse(localStorage.getItem(DEMO_SESSION_KEY));
    return (
      sessionData?.id === DEMO_ACCOUNT.id &&
      sessionData.username === DEMO_CREDENTIALS.username &&
      sessionData.role === DEMO_ACCOUNT.role
    );
  } catch {
    return false;
  }
}

export function logoutAssistant() {
  try {
    localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    throw new Error('Chưa xóa được phiên đăng nhập. Vui lòng thử lại.');
  }
}

function normalizeAccount(data = {}) {
  const account = { ...DEMO_ACCOUNT };
  for (const fieldName of ['name', 'email', 'phone', 'address', 'joined']) {
    if (typeof data[fieldName] === 'string') {
      account[fieldName] = data[fieldName].slice(0, 255);
    }
  }
  const avatar = data.avatarUrl;
  if (
    typeof avatar === 'string' &&
    avatar.length <= 1500000 &&
    /^data:image\/(png|jpeg|webp);base64,/.test(avatar)
  ) {
    account.avatarUrl = avatar;
  }
  return account;
}

export function getDemoAccount() {
  try {
    const data = JSON.parse(localStorage.getItem(DEMO_PROFILE_KEY));
    return normalizeAccount(data && typeof data === 'object' ? data : {});
  } catch {
    return { ...DEMO_ACCOUNT };
  }
}

export function saveDemoAccount(data) {
  const account = normalizeAccount(data);
  try {
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(account));
    return account;
  } catch {
    throw new Error(
      'Trình duyệt chưa cho phép lưu hồ sơ mẫu. Hãy kiểm tra dung lượng hoặc quyền lưu trữ.'
    );
  }
}
