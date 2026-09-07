import {
  mapFacebookContentType,
  mapInstagramContentType,
  mapTikTokContentType,
  mapYouTubeContentType,
} from '../utils/contentType.js';

const GRAPH_API_VERSION = 'v21.0';

// Singapore Time (+8) — used for date formatting and day-boundary cutoffs when calling insights
const SG_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

/**
 * CTR = clicks / views * 100, as a percentage, rounded to 2 decimal places.
 * views = 0 (or invalid) -> 0 to avoid Infinity/NaN when saving to DB.
 */
export const calcCtr = (clicks, views) => {
  const c = Number(clicks) || 0;
  const v = Number(views) || 0;
  if (v <= 0 || c <= 0) return 0;
  return Math.round((c / v) * 10000) / 100;
};

const formatDateTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString.slice(0, 10);

  const sgDate = new Date(d.getTime() + SG_OFFSET_MS);

  const yyyy = sgDate.getUTCFullYear();
  const mm = pad(sgDate.getUTCMonth() + 1);
  const dd = pad(sgDate.getUTCDate());
  const hh = pad(sgDate.getUTCHours());
  const mi = pad(sgDate.getUTCMinutes());

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
};

// ─── Instagram ───────────────────────────────────────────────────────────────
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID || '17841422427064625';
// Graph API only allows up to 30 days per request, so to get a running total
// we need to split into multiple 30-day windows and sum them up.
const IG_LINK_TAPS_WINDOW_DAYS = 30;
const IG_LINK_TAPS_CONCURRENCY = 6;
// Starting point for the total. Meta only retains insights for ~2 years, default to 2 years.
// Can be overridden via env IG_INSIGHTS_SINCE (format 'YYYY-MM-DD').
const IG_LINK_TAPS_LOOKBACK_DAYS = 730;

// Instagram account-level click metrics:
// - `website_clicks`     : clicks on the link-in-bio on the profile — the practically useful number.
// - `profile_links_taps` : only counts taps on business address / call / email / text buttons.
//   The account thegivecollectivesg doesn't have these buttons enabled, so this metric always returns 0.
// Both REQUIRE `period=day` + `metric_type=total_value` (omitting `period` ->
// "(#100) the parameter period is required"; omitting `metric_type` -> error requiring total_value).
const IG_CLICK_METRICS = ['website_clicks', 'profile_links_taps'];

/**
 * Fetches the TOTAL account profile clicks (`website_clicks` + `profile_links_taps`),
 * cumulative from the start date to now.
 *
 * Note: this is an ACCOUNT-LEVEL metric — the Instagram Graph API does not expose
 * clicks at the post level, so this number must NOT be split across individual posts.
 * The metric only supports `metric_type=total_value` (no `time_series`), and each
 * request covers at most 30 days, so we split into 30-day windows and sum them here.
 * Each metric is fetched in its own request so that one failing metric doesn't
 * take down the other.
 *
 * @returns {Promise<{ total: number, byMetric: Record<string, number>, windowsFetched: number, since: string, error: string|null }>}
 */
export const fetchInstagramProfileLinksTaps = async (apiKey, accountId = IG_ACCOUNT_ID) => {
  const BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
  let error = null;

  const now = Date.now();
  const envSince = process.env.IG_INSIGHTS_SINCE ? Date.parse(process.env.IG_INSIGHTS_SINCE) : NaN;
  const startMs = Number.isNaN(envSince) ? now - IG_LINK_TAPS_LOOKBACK_DAYS * DAY_MS : envSince;

  // Split [startMs, now] into consecutive 30-day windows
  const windows = [];
  for (let from = startMs; from < now; from += IG_LINK_TAPS_WINDOW_DAYS * DAY_MS) {
    const to = Math.min(from + IG_LINK_TAPS_WINDOW_DAYS * DAY_MS, now);
    windows.push({ since: Math.floor(from / 1000), until: Math.floor(to / 1000) });
  }

  // Each (metric x 30-day window) is an independent request
  const tasks = [];
  for (const metric of IG_CLICK_METRICS) {
    for (const w of windows) tasks.push({ metric, ...w });
  }

  const byMetric = Object.fromEntries(IG_CLICK_METRICS.map((m) => [m, 0]));

  for (let i = 0; i < tasks.length; i += IG_LINK_TAPS_CONCURRENCY) {
    const batch = tasks.slice(i, i + IG_LINK_TAPS_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async ({ metric, since, until }) => {
        try {
          const url =
            `${BASE}/${accountId}/insights?metric=${metric}&period=day` +
            `&metric_type=total_value&since=${since}&until=${until}&access_token=${apiKey}`;
          const res = await fetch(url);
          const data = await res.json();

          if (data.error) {
            console.warn(
              `[Instagram] ${metric} error (${new Date(since * 1000).toISOString().slice(0, 10)} → ${new Date(until * 1000).toISOString().slice(0, 10)}):`,
              data.error.message
            );
            return { metric, taps: 0, errMsg: data.error.message };
          }

          const entry = data.data?.[0];
          // API returns empty data (not 0) when there's no data for the period
          const taps = entry?.total_value?.value ?? entry?.values?.[0]?.value ?? 0;
          return { metric, taps: Number(taps) || 0, errMsg: null };
        } catch (err) {
          console.warn(`[Instagram] ${metric} exception:`, err.message);
          return { metric, taps: 0, errMsg: err.message };
        }
      })
    );

    for (const { metric, taps, errMsg } of results) {
      byMetric[metric] += taps;
      if (errMsg && !error) error = errMsg;
    }
  }

  const total = Object.values(byMetric).reduce((sum, v) => sum + v, 0);

  return {
    total,
    byMetric,
    windowsFetched: windows.length,
    since: new Date(startMs).toISOString().slice(0, 10),
    error,
  };
};

/**
 * Fetches DAILY click figures (not a cumulative total) for the Homepage daily chart.
 *
 * IMPORTANT: `website_clicks` and `profile_links_taps` ONLY support
 * `metric_type=total_value` — the Graph API returns error (#100) "incompatible
 * with the metric type (time_series)" if you use metric_type=time_series with
 * these two metrics, regardless of period. So we CANNOT ask Meta for a ready-made
 * time_series for these metrics (unlike some other metrics, e.g. the old impressions).
 *
 * The only way to get daily figures is to call total_value for EACH DAY
 * individually (since = day X 00:00, until = day X+1 00:00), then stitch the
 * days together. This costs more requests (1 request / metric / day) but is
 * the only approach the API allows.
 *
 * @returns {Promise<{ series: Array<{date:string, websiteClicks:number, profileLinksTaps:number, total:number}>, days: number, error: string|null }>}
 */
export const fetchInstagramProfileClicksDailySeries = async (
  apiKey,
  days = 30,
  accountId = IG_ACCOUNT_ID,
) => {
  const BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
  let error = null;

  // Anchor day boundaries to Singapore time (+8) to match how dates are shown
  // in the app's other charts, then compute the corresponding UTC boundaries
  // to send as since/until.
  const now = Date.now();
  const nowSg = now + SG_OFFSET_MS;
  const todaySgMidnightUtc = Math.floor(nowSg / DAY_MS) * DAY_MS - SG_OFFSET_MS;

  const dayWindows = [];
  for (let i = Math.max(1, days) - 1; i >= 0; i--) {
    const dayStartUtcMs = todaySgMidnightUtc - i * DAY_MS;
    const dayEndUtcMs = dayStartUtcMs + DAY_MS;
    const dateKey = new Date(dayStartUtcMs + SG_OFFSET_MS).toISOString().slice(0, 10);
    dayWindows.push({
      dateKey,
      since: Math.floor(dayStartUtcMs / 1000),
      until: Math.floor(dayEndUtcMs / 1000),
    });
  }

  const tasks = [];
  for (const metric of IG_CLICK_METRICS) {
    for (const w of dayWindows) tasks.push({ metric, ...w });
  }

  // dateKey -> { websiteClicks, profileLinksTaps }
  const byDate = new Map(dayWindows.map((w) => [w.dateKey, { websiteClicks: 0, profileLinksTaps: 0 }]));

  for (let i = 0; i < tasks.length; i += IG_LINK_TAPS_CONCURRENCY) {
    const batch = tasks.slice(i, i + IG_LINK_TAPS_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async ({ metric, dateKey, since, until }) => {
        try {
          // total_value is the ONLY metric_type supported for these two metrics.
          const url =
            `${BASE}/${accountId}/insights?metric=${metric}&period=day` +
            `&metric_type=total_value&since=${since}&until=${until}&access_token=${apiKey}`;
          const res = await fetch(url);
          const data = await res.json();

          if (data.error) {
            console.warn(`[Instagram] ${metric} daily (${dateKey}) error:`, data.error.message);
            return { metric, dateKey, value: 0, errMsg: data.error.message };
          }

          const entry = data.data?.[0];
          const value = entry?.total_value?.value ?? entry?.values?.[0]?.value ?? 0;
          return { metric, dateKey, value: Number(value) || 0, errMsg: null };
        } catch (err) {
          console.warn(`[Instagram] ${metric} daily (${dateKey}) exception:`, err.message);
          return { metric, dateKey, value: 0, errMsg: err.message };
        }
      })
    );

    for (const { metric, dateKey, value, errMsg } of results) {
      if (errMsg && !error) error = errMsg;
      const bucket = byDate.get(dateKey);
      if (!bucket) continue;
      if (metric === 'website_clicks') bucket.websiteClicks += value;
      else if (metric === 'profile_links_taps') bucket.profileLinksTaps += value;
    }
  }

  const series = dayWindows.map(({ dateKey }) => {
    const v = byDate.get(dateKey);
    return {
      date: dateKey,
      websiteClicks: v.websiteClicks,
      profileLinksTaps: v.profileLinksTaps,
      total: v.websiteClicks + v.profileLinksTaps,
    };
  });

  return { series, days, error };
};

export const fetchInstagramTopPost = async (apiKey) => {
  try {
    const BASE = 'https://graph.facebook.com/v21.0';
    const igAccountId = IG_ACCOUNT_ID;

    const allMedia = [];
    let fetchError = null;
    // Added media_type + media_product_type to identify Image/Video/Carousel/Story/Reels
    let nextUrl = `${BASE}/${igAccountId}/media?fields=id,caption,timestamp,media_type,media_product_type,like_count,permalink&limit=100&access_token=${apiKey}`;

    while (nextUrl) {
      const res = await fetch(nextUrl);
      const data = await res.json();
      if (data.error) { fetchError = data.error.message; break; }
      allMedia.push(...(data.data || []));
      nextUrl = data.paging?.next ?? null;
    }

    if (allMedia.length === 0) {
      return { platform: 'Instagram', error: fetchError || 'No media found' };
    }

    const BATCH_SIZE = 20;
    const withViews = [];
    for (let i = 0; i < allMedia.length; i += BATCH_SIZE) {
      const batch = allMedia.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (media) => {
          try {
            // Meta has unified all media types (Feed/Story/Reels — including Image, Carousel)
            // under a single "views" metric since Graph API v22.0. The old "impressions" metric
            // was fully deprecated as of 2025-04-21 and errors out for any post from
            // 2024-07-02 onward — this is why Carousel/Image posts used to always show views: 0.
            const insightRes = await fetch(`${BASE}/${media.id}/insights?metric=views&access_token=${apiKey}`);
            if (!insightRes.ok) {
              const errBody = await insightRes.text();
              console.warn(`[Instagram] Insight error for media ${media.id} (${media.media_type}):`, errBody);
              return { ...media, views: 0 };
            }
            const insightData = await insightRes.json();
            const insight = insightData.data?.[0];
            const views = insight?.values?.[0]?.value ?? insight?.value ?? 0;
            return { ...media, views };
          } catch (err) {
            console.warn(`[Instagram] Insight exception for media ${media.id}:`, err.message);
            return { ...media, views: 0 };
          }
        })
      );
      withViews.push(...results);
    }

    // Instagram clicks are an ACCOUNT-LEVEL metric — not available per post, so it must
    // NOT be assigned/split across individual posts. The total is returned separately by the controller.
    // Take everything, sort by views descending
    return withViews
      .sort((a, b) => b.views - a.views)
      .map(top => {
        const date = formatDateTime(top.timestamp);
        const views = top.views || 0;

        return {
          platform: 'Instagram',
          title: top.caption ? top.caption.slice(0, 120) : '(No caption)',
          views,
          likes: top.like_count || 0,
          clicks: 0,
          ctr: 0,
          date,
          url: top.permalink,
          contentType: mapInstagramContentType(top.media_type, top.media_product_type),
          rawMediaType: top.media_type || '',
          rawMediaProductType: top.media_product_type || '',
        };
      });
  } catch (error) {
    console.error('[Instagram] Top post error:', error);
    return { platform: 'Instagram', error: 'Failed to fetch top Instagram posts' };
  }
};

// ─── Facebook (Posts + Reels) ───────────────
export const fetchFacebookTopPost = async (pageId, accessToken) => {
  try {
    const BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
    const allContent = []; // Combine both Posts and Reels here

    // Regular posts — added "shares" to get real share count, and attachments{media_type,type}
    // to identify Photo/Video/Album/Link
    const posts = [];
    let postsError = null;
    let postsUrl = `${BASE}/${pageId}/posts?fields=id,message,created_time,permalink_url,likes.summary(true),shares,attachments{media_type,type}&limit=100&access_token=${accessToken}`;
    while (postsUrl) {
      const res = await fetch(postsUrl);
      const data = await res.json();
      if (data.error) { postsError = data.error.message; break; }
      posts.push(...(data.data || []));
      postsUrl = data.paging?.next || null;
    }

  const BATCH_SIZE = 20;
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (post) => {
        // Fetch views and clicks separately — one failing metric doesn't break the other
        const [viewsRes, clicksRes] = await Promise.all([
          fetch(`${BASE}/${post.id}/insights?metric=post_media_view&access_token=${accessToken}`)
            .then((r) => r.json())
            .catch(() => null),
          fetch(`${BASE}/${post.id}/insights?metric=post_clicks&access_token=${accessToken}`)
            .then((r) => r.json())
            .catch(() => null),
        ]);

        if (viewsRes?.error) console.warn(`[Facebook] views error for post ${post.id}:`, viewsRes.error.message);
        if (clicksRes?.error) console.warn(`[Facebook] clicks error for post ${post.id}:`, clicksRes.error.message);

        const views = viewsRes?.data?.[0]?.values?.[0]?.value ?? 0;
        const clicks = clicksRes?.data?.[0]?.values?.[0]?.value ?? 0;

        return { post, views, clicks };
      })
    );
    for (const { post, views, clicks } of results) {
      const attachmentFirst = post.attachments?.data?.[0];
      allContent.push({
        platform: 'Facebook',
        title: post.message ? post.message.slice(0, 120) : '(No caption)',
        views,
        likes: post.likes?.summary?.total_count || 0,
        shares: post.shares?.count || 0,
        clicks,
        ctr: calcCtr(clicks, views),
        date: formatDateTime(post.created_time),
        url: post.permalink_url,
        contentType: mapFacebookContentType(post.attachments),
        rawMediaType: attachmentFirst?.media_type || attachmentFirst?.type || '',
      });
    }
  }

    // Reels — no longer embedding video_insights in the field expansion (one bad metric
    // would fail the whole query). Fetch base fields first, insights fetched separately in
    // batches like Posts, to isolate errors if one video is missing insights.
    let reelsError = null;
    const reels = [];
    let reelsUrl = `${BASE}/${pageId}/video_reels?fields=id,description,created_time,permalink_url,likes.summary(true)&limit=100&access_token=${accessToken}`;
    while (reelsUrl) {
      const res = await fetch(reelsUrl);
      const data = await res.json();
      if (data.error) { reelsError = data.error.message; break; }
      reels.push(...(data.data || []));
      reelsUrl = data.paging?.next || null;
    }

    for (let i = 0; i < reels.length; i += BATCH_SIZE) {
      const batch = reels.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((reel) =>
          fetch(`${BASE}/${reel.id}/video_insights?metric=blue_reels_play_count&access_token=${accessToken}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.error) {
                console.warn(`[Facebook] Reel insight error for video ${reel.id}:`, d.error.message);
                return { reel, views: 0 };
              }
              const views = d.data?.[0]?.values?.[0]?.value ?? 0;
              return { reel, views };
            })
            .catch((err) => {
              console.warn(`[Facebook] Reel insight exception for video ${reel.id}:`, err.message);
              return { reel, views: 0 };
            })
        )
      );
      for (const { reel, views } of results) {
        // video_insights for Reels has no clicks metric -> leave at 0, ctr accordingly = 0
        const clicks = 0;
        allContent.push({
          platform: 'Facebook',
          title: reel.description ? reel.description.slice(0, 120) : '(Reel has no description)',
          views,
          likes: reel.likes?.summary?.total_count || 0,
          shares: 0, // video_reels edge doesn't return a "shares" field, needs a separate call if needed
          clicks,
          ctr: calcCtr(clicks, views),
          date: formatDateTime(reel.created_time),
          url: reel.permalink_url,
          contentType: 'video',
          rawMediaType: 'video',
        });
      }
    }

    if (allContent.length === 0) {
      return { platform: 'Facebook', error: postsError || reelsError || 'No posts found' };
    }

    // Take everything, sort by views descending
    return allContent.sort((a, b) => b.views - a.views);
  } catch (error) {
    console.error('[Facebook] Top post error:', error);
    return { platform: 'Facebook', error: 'Failed to fetch top Facebook posts' };
  }
};

// ─── TikTok ────────────────────────────────
export const fetchTikTokTopPost = async (handle, apifyToken) => {
  try {
    const cleanHandle = handle.replace('@', '');
    const response = await fetch(
      `https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // maxPosts: 0 = fetch all videos on the profile (per this actor's docs)
        body: JSON.stringify({ profiles: [cleanHandle], maxPosts: 0 }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      return { platform: 'TikTok', error: `Apify Error: ${response.status}` };
    }

    const items = await response.json();
    const validItems = Array.isArray(items) ? items.filter((item) => !item.errorCode && item.id) : [];

    if (validItems.length === 0) {
      return { platform: 'TikTok', error: 'No valid data returned' };
    }

    // Add a views field for easy sorting, take everything
    return validItems
      .map(item => ({ ...item, views: Number(item.playCount) || 0 }))
      .sort((a, b) => b.views - a.views)
      .map(top => ({
        platform: 'TikTok',
        title: top.text ? top.text.slice(0, 120) : '(No caption)',
        views: top.views,
        likes: Number(top.diggCount) || 0,
        shares: Number(top.shareCount) || 0,
        date: formatDateTime(top.createTimeISO),
        url: top.webVideoUrl,
        contentType: mapTikTokContentType(top),
        rawMediaType: Array.isArray(top.images) && top.images.length > 0 ? 'carousel' : 'video',
      }));
  } catch (error) {
    console.error('[TikTok] Top post error:', error);
    return { platform: 'TikTok', error: 'Failed to fetch top TikTok posts' };
  }
};

// ─── YouTube ─────────────────────────────────────────────────────────────────
// Note: to get ALL videos (not just top-viewed), the fetch strategy had to change:
// use channels.list to get the uploads playlist, then paginate playlistItems.list,
// then batch-call videos.list for statistics. The old approach (search order=viewCount)
// couldn't retrieve everything.
export const fetchYouTubeTopPost = async (channelHandle, apiKey) => {
  try {
    // 1. Find the channelId
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelHandle)}&key=${apiKey}`
    );
    const channelData = await channelResponse.json();
    const channelId = channelData.items?.[0]?.id?.channelId;
    if (!channelId) return { platform: 'YouTube', error: 'Channel not found' };

    // 2. Get the channel's uploads playlist id (much cheaper on quota than search)
    const channelDetailRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
    );
    const channelDetailData = await channelDetailRes.json();
    const uploadsPlaylistId = channelDetailData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return { platform: 'YouTube', error: 'Uploads playlist not found' };

    // 3. Paginate through all videoIds in the uploads playlist
    const videoIds = [];
    let pageToken = '';
    do {
      const playlistRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&pageToken=${pageToken}&key=${apiKey}`
      );
      const playlistData = await playlistRes.json();
      for (const item of playlistData.items || []) {
        const vid = item.contentDetails?.videoId;
        if (vid) videoIds.push(vid);
      }
      pageToken = playlistData.nextPageToken || '';
    } while (pageToken);

    if (videoIds.length === 0) return { platform: 'YouTube', error: 'No videos found' };

    // 4. Batch videos.list in groups of 50 ids (API limit)
    const BATCH_SIZE = 50;
    const allVideos = [];
    for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
      const batchIds = videoIds.slice(i, i + BATCH_SIZE);
      const videoRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${batchIds.join(',')}&key=${apiKey}`
      );
      const videoData = await videoRes.json();
      allVideos.push(...(videoData.items || []));
    }

    return allVideos
      .map(video => ({
        platform: 'YouTube',
        title: video.snippet.title,
        views: parseInt(video.statistics.viewCount) || 0,
        likes: parseInt(video.statistics.likeCount) || 0,
        shares: parseInt(video.statistics.shareCount) || 0,
        date: formatDateTime(video.snippet.publishedAt),
        url: `https://www.youtube.com/watch?v=${video.id}`,
        contentType: mapYouTubeContentType(),
        rawMediaType: 'video',
      }))
      .sort((a, b) => b.views - a.views);
  } catch (error) {
    console.error('[YouTube] Top post error:', error);
    return { platform: 'YouTube', error: 'Failed to fetch top YouTube videos' };
  }
};

// Dispatcher functions (fetchTopPostForPlatform, fetchAllTopPostsRaw) unchanged
export const fetchTopPostForPlatform = async (platformName, handle, tokens) => {
  switch (platformName.toLowerCase()) {
    case 'facebook': return fetchFacebookTopPost(handle, tokens.metaAccessToken);
    case 'instagram': return fetchInstagramTopPost(tokens.metaAccessTokenInstagram);
    case 'tiktok': return fetchTikTokTopPost(handle, tokens.apifyToken);
    case 'youtube': return fetchYouTubeTopPost(handle, tokens.youtubeApiKey);
    default: return { platform: platformName, error: `Platform not supported: ${platformName}` };
  }
};