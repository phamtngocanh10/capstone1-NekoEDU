// Khi có backend: bỏ comment import và dòng return API trong từng hàm.
// Đặt VITE_API_BASE_URL trong .env.development rồi đổi endpoint cho khớp backend.
// API đăng nhập trả { access_token, user: { id, name, role, email, phone, address, joined } }.
// import apiClient from './client'

const TAI_KHOAN = [
  {
    tenDangNhap: ['manager', 'ngocanh@nekoedu.vn', 'manager@nekoedu.vn'],
    matKhau: 'Neko@123',
    user: {
      id: 'manager-ngocanh', name: 'Phạm Thị Ngọc Anh', role: 'Manager',
      email: 'ngocanh@nekoedu.vn', phone: '0901 234 567',
      address: '25 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', joined: '03/2023',
    },
  },
  {
    tenDangNhap: ['giangvien', 'khoi.tran@neko.edu.vn', 'giangvien@nekoedu.vn'],
    matKhau: 'Neko@123',
    user: {
      id: 'gv-khoi', name: 'Trần Minh Khôi', role: 'Lecturer',
      email: 'khoi.tran@neko.edu.vn', phone: '0901 234 567',
      address: '25 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', joined: '03/2023',
    },
  },
]

const khoaMatKhau = id => `neko-auth-password:${id}`

function layMatKhauDaLuu(id) {
  try {
    const giaTri = globalThis.localStorage?.getItem(khoaMatKhau(id))
    if (!giaTri) return null
    const matKhau = JSON.parse(giaTri)
    if (!/^[0-9a-f]{32}$/.test(matKhau.salt) || !/^[0-9a-f]{64}$/.test(matKhau.hash)) {
      throw new Error('Dữ liệu mật khẩu không hợp lệ.')
    }
    return matKhau
  } catch {
    throw new Error('Không đọc được mật khẩu đã lưu trên trình duyệt.')
  }
}

function thanhChuoiHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

async function bamMatKhau(id, salt, matKhau) {
  const duLieu = new TextEncoder().encode(`${id}:${salt}:${matKhau}`)
  const ketQua = await crypto.subtle.digest('SHA-256', duLieu)
  return thanhChuoiHex(new Uint8Array(ketQua))
}

async function khopMatKhau(taiKhoan, matKhau) {
  const daLuu = layMatKhauDaLuu(taiKhoan.user.id)
  if (!daLuu) return matKhau === taiKhoan.matKhau
  const hash = await bamMatKhau(taiKhoan.user.id, daLuu.salt, matKhau)
  return hash === daLuu.hash
}

export async function login({ username, password, captcha }) {
  // return apiClient.post('/auth/login', { username, password, captcha }).then(response => response.data)
  const tenDangNhap = String(username ?? '').trim().toLowerCase()
  const taiKhoan = TAI_KHOAN.find(account => account.tenDangNhap.includes(tenDangNhap))
  if (!taiKhoan || typeof password !== 'string' || !(await khopMatKhau(taiKhoan, password))) {
    throw new Error('Tài khoản hoặc mật khẩu không đúng.')
  }
  // Chế độ frontend chưa tạo token giả. Backend thật sẽ trả access_token.
  return { access_token: null, user: { ...taiKhoan.user } }
}

export async function getProfile() {
  // return apiClient.get('/auth/me').then(response => response.data)
  try {
    const user = JSON.parse(localStorage.getItem('neko-auth-user'))
    if (user) return user
  } catch { /* Trạng thái tài khoản không hợp lệ, yêu cầu đăng nhập lại. */ }
  throw new Error('Vui lòng đăng nhập để xem thông tin tài khoản.')
}

export async function changePassword({ currentPassword, newPassword }) {
  // return apiClient.post('/auth/change-password', { currentPassword, newPassword }).then(response => response.data)
  const user = await getProfile()
  const taiKhoan = TAI_KHOAN.find(account => account.user.id === user.id && account.user.role === user.role)
  if (!taiKhoan) throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.')
  if (typeof currentPassword !== 'string' || !(await khopMatKhau(taiKhoan, currentPassword))) {
    throw new Error('Mật khẩu hiện tại không đúng.')
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new Error('Mật khẩu mới cần tối thiểu 8 ký tự.')
  }
  if (newPassword === currentPassword) throw new Error('Mật khẩu mới phải khác mật khẩu hiện tại.')

  // Chỉ lưu salt ngẫu nhiên và hash, không lưu mật khẩu gốc hoặc mật khẩu vừa nhập.
  // Đây là dữ liệu frontend trên trình duyệt hiện tại; backend thật quản lý mật khẩu trên máy chủ.
  const salt = thanhChuoiHex(crypto.getRandomValues(new Uint8Array(16)))
  const hash = await bamMatKhau(taiKhoan.user.id, salt, newPassword)
  try {
    localStorage.setItem(khoaMatKhau(user.id), JSON.stringify({ salt, hash }))
  } catch {
    throw new Error('Không lưu được mật khẩu mới trên trình duyệt.')
  }
  return { success: true }
}
