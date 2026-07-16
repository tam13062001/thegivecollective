// services/igDemographics.js
// Lấy demographic (age/gender) của Instagram Business Account
// liên kết với một Facebook Page, dùng Page Access Token.

const GRAPH_VERSION = 'v25.0';
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN; // lưu trong .env, không hardcode

/**
 * Bước 1: lấy Instagram Business Account ID từ Page ID
 */
export async function getIgBusinessAccountId(pageId) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}` +
    `?fields=instagram_business_account&access_token=${PAGE_ACCESS_TOKEN}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(`FB API error: ${data.error.message}`);
  }
  if (!data.instagram_business_account) {
    throw new Error('Page này chưa liên kết Instagram Business/Creator account.');
  }
  return data.instagram_business_account.id;
}

/**
 * Bước 2: lấy demographic từ IG Business Account ID.
 * Metric đúng (Meta API v25.0) là `follower_demographics`.
 * timeframe bắt buộc, chỉ nhận 'this_week' hoặc 'this_month'.
 */
export async function getIgAudienceDemographics(igBusinessAccountId) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${igBusinessAccountId}/insights` +
    `?metric=follower_demographics` +
    `&period=lifetime` +
    `&timeframe=this_month` +
    `&breakdown=age,gender` +
    `&metric_type=total_value` +
    `&access_token=${PAGE_ACCESS_TOKEN}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    // Lỗi phổ biến: thiếu 100+ followers, thiếu scope instagram_manage_insights
    throw new Error(`IG Insights error: ${data.error.message}`);
  }

  const demoMetric = data.data?.find((m) => m.name === 'follower_demographics');
  const breakdown = demoMetric?.total_value?.breakdowns?.[0];
  const dimensionKeys = breakdown?.dimension_keys ?? []; // ['age', 'gender']
  const results = breakdown?.results ?? [];

  const ageIdx = dimensionKeys.indexOf('age');
  const genderIdx = dimensionKeys.indexOf('gender');

  // Gộp theo age range, tách theo gender (F/M/U)
  const byAge = {};
  for (const item of results) {
    const ageRange = item.dimension_values[ageIdx];
    const gender = item.dimension_values[genderIdx]; // 'M' | 'F' | 'U'
    byAge[ageRange] ??= { age: ageRange, female: 0, male: 0, undisclosed: 0 };
    if (gender === 'F') byAge[ageRange].female += item.value;
    else if (gender === 'M') byAge[ageRange].male += item.value;
    else byAge[ageRange].undisclosed += item.value;
  }

  return Object.values(byAge).sort((a, b) => a.age.localeCompare(b.age));
}