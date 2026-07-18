import OnlineFollowersSnapshot from '../models/OnlineFollowersSnapshot.js';

const GRAPH_VERSION = 'v25.0';
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;


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

// services/igDemographics.js

const IG_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_INSTAGRAM;
const IG_BUSINESS_ACCOUNT_ID = process.env.IG_BUSINESS_ACCOUNT_ID || '17841422427064625';

function getWeekdayIndex(date) {
  const day = date.getUTCDay(); // 0=CN
  return (day + 6) % 7;         // quy về 0=Mon ... 6=Sun
}

function extractDateStrAndWeekday(endTimeIso) {
  // endTimeIso vd: "2026-07-16T07:00:00+0000"
  // end_time là mốc KẾT THÚC của ngày dữ liệu đó -> ngày dữ liệu thực = end_time trừ 1 ngày
  const d = new Date(endTimeIso);
  d.setUTCDate(d.getUTCDate() - 1);

  const dateStr = d.toISOString().slice(0, 10); // "2026-07-15" dạng UTC thuần, không lệch timezone máy
  const day = d.getUTCDay();          // 0=CN
  const weekday = (day + 6) % 7;      // 0=Mon ... 6=Sun
  return { dateStr, weekday };
}

export async function getFanOnline({ weeksBack = 8 } = {}) {
  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${IG_BUSINESS_ACCOUNT_ID}/insights` +
      `?metric=online_followers&period=lifetime&access_token=${IG_ACCESS_TOKEN}`;

    const resp = await fetch(url);
    const json = await resp.json();
    if (json.error) throw new Error(json.error.message);

    const allValues = json?.data?.[0]?.values || [];

    for (const entry of allValues) {
      if (!entry.value || Object.keys(entry.value).length === 0) continue; // bỏ ngày chưa đủ data

      const { dateStr, weekday } = extractDateStrAndWeekday(entry.end_time);
      const hourly = Object.entries(entry.value).map(([hour, count]) => ({
        hour: Number(hour),
        count: Number(count) || 0,
      }));

      await OnlineFollowersSnapshot.findOneAndUpdate(
        { igUserId: IG_BUSINESS_ACCOUNT_ID, snapshotDateStr: dateStr },
        { igUserId: IG_BUSINESS_ACCOUNT_ID, snapshotDateStr: dateStr, weekday, hourly },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.error('getFanOnline fetch error:', err.message);
  }

  const since = new Date();
  since.setDate(since.getDate() - weeksBack * 7);

  const snapshots = await OnlineFollowersSnapshot.find({
    igUserId: IG_BUSINESS_ACCOUNT_ID,
    snapshotDate: { $gte: since },
  }).lean();

  const grid = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ totalCount: 0, sampleDays: 0 }))
  );

  for (const snap of snapshots) {
    for (const { hour, count } of snap.hourly) {
      grid[snap.weekday][hour].totalCount += count;
      grid[snap.weekday][hour].sampleDays += 1;
    }
  }

  const data = [];
  for (let w = 0; w < 7; w++) {
    for (let h = 0; h < 24; h++) {
      const cell = grid[w][h];
      data.push({
        weekday: w,
        hour: h,
        avgOnline: cell.sampleDays ? Math.round(cell.totalCount / cell.sampleDays) : 0,
        sampleDays: cell.sampleDays,
      });
    }
  }

  return { data, sampleWindowWeeks: weeksBack, snapshotCount: snapshots.length };
}