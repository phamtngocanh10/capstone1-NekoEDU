import axios from "axios";

// Base URL lấy từ .env.* — đổi VITE_API_BASE_URL để trỏ sang backend thật.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Gắn token (nếu có) vào mọi request.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Xử lý lỗi chung: hết phiên đăng nhập (401) thì quay về /login.
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      if (window.location.pathname !== "/login")
        window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default apiClient;
