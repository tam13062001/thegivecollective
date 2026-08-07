import dotenv from 'dotenv';
dotenv.config();
import { JWT } from 'google-auth-library';

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_2;
if (!raw) {
  console.error('Thiếu GOOGLE_SERVICE_ACCOUNT_JSON_2 trong .env');
  process.exit(1);
}

const credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));

const authClient = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
});

const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID_2;
if (!propertyId) {
  console.error('Thiếu GOOGLE_ANALYTICS_PROPERTY_ID_2 trong .env');
  process.exit(1);
}

const DAYS = 30;

const { token } = await authClient.getAccessToken();

console.log(`--- Key Events breakdown (${DAYS} ngày gần nhất) — property ${propertyId} ---\n`);

const res = await fetch(
  `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      dateRanges: [{ startDate: `${DAYS}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'keyEvents' }],
      orderBys: [{ metric: { metricName: 'keyEvents' }, desc: true }],
      limit: 20,
    }),
  }
);

const data = await res.json();

if (data.error) {
  console.error('GA4 API error:', data.error);
  process.exit(1);
}

const rows = data.rows ?? [];

const keyEventsBreakdown = rows
  .map((row) => ({
    eventName: row.dimensionValues?.[0]?.value ?? '(not set)',
    count: parseInt(row.metricValues?.[0]?.value) || 0,
  }))
  .filter((e) => e.count > 0);

if (keyEventsBreakdown.length === 0) {
  console.log('Không có key event nào có data trong khoảng thời gian này.');
} else {
  const maxNameLen = Math.max(...keyEventsBreakdown.map((e) => e.eventName.length));
  keyEventsBreakdown.forEach((e) => {
    console.log(`${e.eventName.padEnd(maxNameLen + 2)} ${e.count}`);
  });
}

const totalKeyEvents = keyEventsBreakdown.reduce((sum, e) => sum + e.count, 0);
console.log(`\nTổng: ${totalKeyEvents} key events`);

console.log('\n--- Raw response (để đối chiếu nếu số liệu không khớp GA4 UI) ---');
console.log(JSON.stringify(data, null, 2));