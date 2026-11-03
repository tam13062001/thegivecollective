// services/adsSheetService.js
// Đọc Google Sheet DATA_FACEBOOK_TGC_2026 (tab Utd, Age, Gender) bằng service account
// và chuẩn hoá thành đúng format dashboard Ads Boosting cần: { utd, breakdowns }.
//
// ENV:
//   ADS_SHEET_ID              mặc định 1Lz8KlhMfAkJSUO6DAJYLfelXLQ27-ZdJ6MR3nCG3ubk
//   ADS_SHEET_TABS            mặc định "Utd,Age,Gender"  (tên tab: daily theo ad, theo tuổi, theo giới tính)
//   ADS_SHEET_SA_ENV          tên biến env chứa service account (base64 JSON), mặc định GOOGLE_SERVICE_ACCOUNT_JSON
//   -> Nhớ share Google Sheet (quyền Viewer) cho email client_email của service account đó.
import crypto from 'crypto';
import { JWT } from 'google-auth-library'; 

const SHEET_ID = () => process.env.ADS_SHEET_ID || '1Lz8KlhMfAkJSUO6DAJYLfelXLQ27-ZdJ6MR3nCG3ubk';
const TABS = () => (process.env.ADS_SHEET_TABS || 'Utd,Age,Gender').split(',').map((s) => s.trim());

let authClient;
function getAuth() {
  if (authClient) return authClient;
  const envName = process.env.ADS_SHEET_SA_ENV || 'GOOGLE_SERVICE_ACCOUNT_JSON';
  const raw = process.env[envName];
  if (!raw) throw new Error(`Thiếu biến env ${envName}`);
  const credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
  authClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return authClient;
}

// ---- helpers chuẩn hoá giá trị ----
const SERIAL_EPOCH = Date.UTC(1899, 11, 30);
const num = (v) => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const r2 = (x) => Math.round(x * 100) / 100;
const str = (v) => (v == null ? '' : String(v).trim());

// Ngày trong sheet có thể là serial number (ô dạng date) hoặc text.
function toDate(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return new Date(SERIAL_EPOCH + Math.round(v * 864e5)).toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}

// status_fetched_at: giữ nguyên ISO string; nếu là serial thì coi là giờ Singapore (+08:00).
function toFetchedAt(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const iso = new Date(SERIAL_EPOCH + Math.round(v * 864e5)).toISOString().slice(0, 19);
    return `${iso}+08:00`;
  }
  return String(v).trim();
}

// Biến mảng 2 chiều (dòng đầu là header) thành mảng object, bỏ dòng trống.
function toObjects(values = []) {
  const [header = [], ...rows] = values;
  const keys = header.map((h) => str(h));
  return rows
    .filter((r) => r.some((c) => c !== '' && c != null))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

export function shapeUtd(rows) {
  return rows
    .filter((r) => str(r.date_start) !== '' && str(r.campaign_name) !== '')
    .map((r) => ({
      date_start: toDate(r.date_start),
      campaign_name: str(r.campaign_name),
      adset_name: str(r.adset_name),
      ad_name: str(r.ad_name),
      ad_account_id: str(r.ad_account_id),
      campaign_effective_status: str(r.campaign_effective_status) || null,
      adset_id: str(r.adset_id),
      adset_effective_status: str(r.adset_effective_status) || null,
      ad_id: str(r.ad_id),
      ad_effective_status: str(r.ad_effective_status) || null,
      status_fetched_at: toFetchedAt(r.status_fetched_at),
      spend: r2(num(r.spend)),
      impressions: num(r.impressions),
      reach: num(r.reach),
      clicks: num(r.clicks),
      inline_link_clicks: num(r.inline_link_clicks),
      landing_page_view: num(r.landing_page_view),
      initiate_checkout: num(r.initiate_checkout),
      purchase: num(r.purchase),
      purchase_value: r2(num(r.purchase_value)),
      event_count__donate_total: num(r.event_count__donate_total),
      event_value__donate_total: r2(num(r.event_value__donate_total)),
      frequency: num(r.frequency),
    }));
}

export function shapeBreakdown(rows, tab) {
  return rows
    .filter((r) => str(r.date_start) !== '' && str(r[tab]) !== '')
    .map((r) => ({
      tab,
      segment: str(r[tab]),
      date_start: toDate(r.date_start),
      campaign_name: str(r.campaign_name),
      adset_name: str(r.adset_name),
      ad_id: str(r.ad_id),
      ad_name: str(r.ad_name),
      spend: r2(num(r.spend)),
      impressions: num(r.impressions),
      inline_link_clicks: num(r.inline_link_clicks),
      landing_page_view: num(r.landing_page_view),
      purchase: num(r.purchase),
      purchase_value: r2(num(r.purchase_value)),
    }));
}

// Từ raw values của 3 tab -> { utd, breakdowns, hash }
export function shapeSheet({ utd = [], age = [], gender = [] }) {
  const out = {
    utd: shapeUtd(toObjects(utd)),
    breakdowns: [...shapeBreakdown(toObjects(age), 'age'), ...shapeBreakdown(toObjects(gender), 'gender')],
  };
  out.hash = crypto.createHash('sha1').update(JSON.stringify([out.utd, out.breakdowns])).digest('hex');
  return out;
}

export async function readAdsSheet() {
  const { token } = await getAuth().getAccessToken();
  const [utdTab, ageTab, genderTab] = TABS();
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID()}/values:batchGet`);
  [utdTab, ageTab, genderTab].forEach((t) => url.searchParams.append('ranges', `'${t}'`));
  url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE');
  url.searchParams.set('dateTimeRenderOption', 'SERIAL_NUMBER');

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Sheets API: ${body?.error?.message || 'HTTP ' + res.status}`);

  const [utd, age, gender] = (body.valueRanges || []).map((v) => v.values || []);
  return shapeSheet({ utd, age, gender });
}
