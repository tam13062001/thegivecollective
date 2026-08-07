// Lớp chặn thêm riêng cho route GA4 secondary (ngoài CORS global ở server.js).
// Origin/Referer do client tự gửi, có thể giả mạo (curl, Postman) — đây không phải
// bảo mật mạnh, chỉ chặn cơ bản. Cần chặt hơn thì thêm API key/secret.
const ALLOWED_ORIGINS = [
  'https://analytics.thegivecollective.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

export const restrictOrigin = (req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || '';

  if (!ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed))) {
    console.warn('[GA4-secondary] Blocked request, invalid origin:', origin || '(none)');
    return res.status(403).json({ message: 'Forbidden: invalid origin' });
  }

  next();
};

export default restrictOrigin;