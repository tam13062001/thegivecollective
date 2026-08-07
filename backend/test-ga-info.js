import dotenv from 'dotenv';
dotenv.config();
import { JWT } from 'google-auth-library';

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_2;
const credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));

const authClient = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
});

const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID_2;
const { token } = await authClient.getAccessToken();

// 1. Tên property
const propRes = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log('--- Property ---');
console.log(await propRes.json());

// 2. Data streams (chứa URL website thật)
const streamsRes = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/dataStreams`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log('--- Data Streams ---');
console.log(JSON.stringify(await streamsRes.json(), null, 2));

// 3. Liệt kê TẤT CẢ metrics khả dụng cho property này
const metadataRes = await fetch(
  `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}/metadata`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const metadata = await metadataRes.json();
console.log('--- Tất cả Metrics khả dụng ---');
metadata.metrics?.forEach((m) => {
  console.log(`${m.apiName.padEnd(35)} ${m.uiName}`);
});

// 4. Thử lấy 1 bộ metric mở rộng 
const extendedRes = await fetch(
  `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'engagementRate' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'keyEvents' },
        { name: 'keyEvents:qualify_lead' },
        { name: 'keyEvents:close_convert_lead' },
      ],
    }),
  }
);
const extendedData = await extendedRes.json();
console.log('--- Bộ metric mở rộng ---');
console.log(JSON.stringify(extendedData, null, 2));