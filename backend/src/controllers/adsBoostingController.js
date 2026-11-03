// controllers/adsBoostingController.js
import AdsDaily from '../models/AdsDaily.js';
import AdsBreakdown from '../models/AdsBreakdown.js';
import { syncAdsFromSheet, getAdsSyncState } from '../services/adsSyncService.js';

// Mỗi request, nếu lần đọc sheet gần nhất đã quá N phút thì đọc lại (rẻ: không đổi thì không ghi DB).
const SYNC_EVERY_MS = Number(process.env.ADS_SYNC_MINUTES || 15) * 60 * 1000;
const HIDE = { _id: 0, __v: 0, key: 0, createdAt: 0, updatedAt: 0 };

const authorized = (req) => {
  if (!process.env.CRON_SECRET) return true;
  const bearer = req.headers['authorization'];
  return bearer === `Bearer ${process.env.CRON_SECRET}` || req.query.key === process.env.CRON_SECRET;
};

// GET /api/v1/ads-boosting -> { taken, takenAt, utd, breakdowns } (format dashboard dùng)
export async function getAdsBoosting(req, res) {
  try {
    let state = await getAdsSyncState();
    const due = !state?.lastCheckedAt || Date.now() - new Date(state.lastCheckedAt).getTime() > SYNC_EVERY_MS;
    if (due) {
      try {
        await syncAdsFromSheet();
      } catch {
        /* sheet lỗi -> vẫn trả dữ liệu đang có trong DB */
      }
      state = await getAdsSyncState();
    }

    const [utd, breakdowns] = await Promise.all([
      AdsDaily.find({}, HIDE).sort({ date_start: 1, adset_name: 1 }).lean(),
      AdsBreakdown.find({}, HIDE).sort({ tab: 1, date_start: 1, segment: 1 }).lean(),
    ]);
    if (!utd.length) {
      return res.status(404).json({ success: false, message: state?.lastError || 'Chưa có dữ liệu ads trong DB' });
    }
    res.set('Cache-Control', 'no-store');
    res.json({ taken: state?.taken || '', takenAt: state?.dataChangedAt || null, utd, breakdowns });
  } catch (err) {
    console.error('[ADS] get lỗi:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET  /api/v1/cron/ads-sync            (Vercel cron, header Authorization: Bearer CRON_SECRET)
// POST /api/v1/ads-boosting/sync?key=…  (Apps Script gọi khi sheet thay đổi)
// Thêm ?force=1 để ghi lại toàn bộ kể cả khi hash không đổi.
export async function syncAds(req, res) {
  if (!authorized(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const out = await syncAdsFromSheet({ force: req.query.force === '1' });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/v1/ads-boosting/status -> trạng thái đồng bộ (debug)
export async function adsSyncStatus(req, res) {
  const state = await getAdsSyncState();
  res.json(state ? { ...state, _id: undefined, hash: undefined } : {});
}
