// services/adsSyncService.js
// Đồng bộ Google Sheet -> MongoDB. DB luôn "gương" của sheet:
//   - dòng mới trong sheet  -> thêm vào DB
//   - dòng bị sửa           -> cập nhật trong DB
//   - dòng bị xoá khỏi sheet -> xoá khỏi DB
// Nếu nội dung sheet không đổi (so hash) thì không ghi gì.
import AdsDaily from '../models/AdsDaily.js';
import AdsBreakdown from '../models/AdsBreakdown.js';
import AdsSyncState from '../models/AdsSyncState.js';
import { readAdsSheet } from './adsSheetService.js';

const STATE_KEY = 'facebook_ads';
const TZ = process.env.ADS_TIMEZONE || 'Asia/Singapore';

export const utdKey = (r) => `${r.date_start}|${r.ad_id || r.adset_name + '|' + r.ad_name}`;
export const breakdownKey = (r) => `${r.tab}|${r.segment}|${r.date_start}|${r.ad_id || r.adset_name + '|' + r.ad_name}`;

// "Nov 3, 2026, 8:44 am SGT" từ status_fetched_at mới nhất
export function takenLabel(utd) {
  const latest = utd.reduce((m, r) => (r.status_fetched_at && r.status_fetched_at > m ? r.status_fetched_at : m), '');
  const d = latest ? new Date(latest) : new Date();
  if (Number.isNaN(d.getTime())) return latest;
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d);
  return s.replace(/\s?(AM|PM)$/, (m) => ' ' + m.trim().toLowerCase()) + (TZ === 'Asia/Singapore' ? ' SGT' : '');
}

async function mirror(Model, rows, keyFn) {
  const keys = [];
  const ops = rows.map((r) => {
    const key = keyFn(r);
    keys.push(key);
    return { updateOne: { filter: { key }, update: { $set: { ...r, key } }, upsert: true } };
  });
  let upserted = 0, modified = 0;
  if (ops.length) {
    const res = await Model.bulkWrite(ops, { ordered: false });
    upserted = res.upsertedCount || 0;
    modified = res.modifiedCount || 0;
  }
  const del = await Model.deleteMany({ key: { $nin: keys } });
  return { upserted, modified, deleted: del.deletedCount || 0 };
}

let inFlight = null;

export function syncAdsFromSheet({ force = false } = {}) {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const started = new Date();
    try {
      const { utd, breakdowns, hash } = await readAdsSheet();
      const state = await AdsSyncState.findOne({ key: STATE_KEY }).lean();

      // An toàn: sheet trống (connector đang ghi lại / lỗi quyền) thì KHÔNG xoá dữ liệu DB.
      if (!utd.length) throw new Error('Tab Utd trong Google Sheet đang trống, bỏ qua để không xoá dữ liệu DB');

      if (!force && state?.hash === hash) {
        await AdsSyncState.updateOne({ key: STATE_KEY }, { $set: { lastCheckedAt: started, lastError: null } });
        return { changed: false, counts: state.counts };
      }

      const a = await mirror(AdsDaily, utd, utdKey);
      const b = await mirror(AdsBreakdown, breakdowns, breakdownKey);
      const result = { upserted: a.upserted + b.upserted, modified: a.modified + b.modified, deleted: a.deleted + b.deleted };
      const counts = { utd: utd.length, breakdowns: breakdowns.length };

      await AdsSyncState.updateOne(
        { key: STATE_KEY },
        {
          $set: {
            hash, counts, lastResult: result, taken: takenLabel(utd),
            lastCheckedAt: started, dataChangedAt: started, lastError: null, lastErrorAt: null,
          },
        },
        { upsert: true },
      );
      console.log('[ADS-SYNC] sheet -> DB', counts, result);
      return { changed: true, counts, result };
    } catch (err) {
      console.error('[ADS-SYNC] lỗi:', err.message);
      await AdsSyncState.updateOne(
        { key: STATE_KEY },
        { $set: { lastCheckedAt: started, lastError: err.message, lastErrorAt: new Date() } },
        { upsert: true },
      ).catch(() => {});
      throw err;
    }
  })();
  return inFlight.finally(() => { inFlight = null; });
}

export const getAdsSyncState = () => AdsSyncState.findOne({ key: STATE_KEY }).lean();
