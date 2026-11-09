import axios from "axios";

// VITE_API_BASE_URL, nếu đặt, cần bao gồm prefix /api/v1.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Gắn token (nếu có) vào mọi request.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) delete config.headers['Content-Type'];
  return config;
});

// Xử lý lỗi chung: hết phiên đăng nhập (401) thì quay về /login.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("neko-auth-user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    const payload = error.response?.data;
    if (payload && !(payload instanceof Blob)) {
      const flatten = (value) => typeof value === 'string' ? [value]
        : Array.isArray(value) ? value.flatMap(flatten)
        : value && typeof value === 'object' ? Object.values(value).flatMap(flatten) : [];
      const details = flatten(payload.errors);
      error.message = details.length ? details.join('; ') : payload.message || error.message;
      if (details.length) payload.message = error.message;
    } else if (!error.response) {
      error.message = 'Không kết nối được máy chủ. Kiểm tra Backend đang chạy tại cổng 8000.';
    }
    return Promise.reject(error);
  },
);

export default apiClient;
