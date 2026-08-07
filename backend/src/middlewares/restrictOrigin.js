const PRODUCTION_ORIGIN = ['https://thegivecollective-backend.vercel.app',];

// Cho phép thêm các origin localhost khi dev (Vite/CRA thường chạy các port này).
// Production luôn chỉ nhận đúng PRODUCTION_ORIGIN.
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5001',
];

const isDev = process.env.NODE_ENV !== 'production';
const ALLOWED_ORIGINS = isDev ? [PRODUCTION_ORIGIN, ...DEV_ORIGINS] : [PRODUCTION_ORIGIN];

// Chặn mọi request không đến từ origin cho phép.
// Lưu ý: header Origin/Referer do client tự gửi nên có thể giả mạo (curl, Postman...).
// Đây chỉ là lớp chặn cơ bản cho trình duyệt qua CORS, không phải cơ chế bảo mật mạnh.
// Nếu cần chặt hơn, thêm kiểm tra API key/secret ở dưới (đã chừa sẵn chỗ).
export const restrictOrigin = (req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || '';
  const isAllowed = ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed));

  if (!isAllowed) {
    console.warn('[GA4-secondary] Blocked request, invalid origin:', origin || '(none)');
    return res.status(403).json({ message: 'Forbidden: invalid origin' });
  }

  // Trả về đúng origin đang gọi (thay vì hardcode) để CORS hoạt động đúng cho cả dev lẫn prod
  const matchedOrigin = ALLOWED_ORIGINS.find((allowed) => origin.startsWith(allowed));
  res.setHeader('Access-Control-Allow-Origin', matchedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
};

export default restrictOrigin;