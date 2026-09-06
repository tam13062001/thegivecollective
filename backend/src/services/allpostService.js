import {
  mapFacebookContentType,
  mapInstagramContentType,
  mapTikTokContentType,
  mapYouTubeContentType,
} from '../utils/contentType.js';

const GRAPH_API_VERSION = 'v21.0';

// Múi giờ VN (+7) — dùng chung cho việc format date và cắt mốc ngày khi gọi insights
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

/**
 * CTR = clicks / views * 100, đơn vị %, làm tròn 2 chữ số thập phân.
 * views = 0 (hoặc không hợp lệ) -> 0 để tránh Infinity/NaN khi lưu DB.
 */
export const calcCtr = (clicks, views) => {
  const c = Number(clicks) || 0;
  const v = Number(views) || 0;
  if (v <= 0 || c <= 0) return 0;
  return Math.round((c / v) * 10000) / 100;
};

// Thêm helper này ở đầu file
const formatDateTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString.slice(0, 10);

  const vnDate = new Date(d.getTime() + 7 * 60 * 60 * 1000); // ← dòng này phải có

  const yyyy = vnDate.getUTCFullYear();
  const mm = pad(vnDate.getUTCMonth() + 1);
  const dd = pad(vnDate.getUTCDate());
  const hh = pad(vnDate.getUTCHours());
  const mi = pad(vnDate.getUTCMinutes());

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
};

// ─── Instagram ───────────────────────────────────────────────────────────────
const IG_ACCOUNT_ID = process.env.IG_ACCOUNT_ID || '17841422427064625';
// Graph API chỉ cho phép mỗi request bao tối đa 30 ngày, nên muốn lấy tổng lũy kế
// thì phải chia thành nhiều cửa sổ 30 ngày rồi cộng dồn lại.
const IG_LINK_TAPS_WINDOW_DAYS = 30;
const IG_LINK_TAPS_CONCURRENCY = 6;
// Mốc bắt đầu tính tổng. Meta chỉ giữ insights khoảng 2 năm, đặt mặc định 2 năm.
// Có thể override bằng env IG_INSIGHTS_SINCE (dạng 'YYYY-MM-DD').
const IG_LINK_TAPS_LOOKBACK_DAYS = 730;

// Metric clicks cấp tài khoản của Instagram:
// - `website_clicks`  : click vào link (link-in-bio) trên profile — đây là số liệu thực dụng.
// - `profile_links_taps`: chỉ đếm tap vào nút business address / call / email / text.
//   Account thegivecollectivesg không bật các nút này nên metric luôn trả 0.
// Cả 2 đều BẮT BUỘC `period=day` + `metric_type=total_value` (bỏ `period` -> lỗi
// "(#100) the parameter period is required"; bỏ `metric_type` -> lỗi yêu cầu total_value).
const IG_CLICK_METRICS = ['website_clicks', 'profile_links_taps'];

/**
 * Lấy TỔNG profile clicks của tài khoản (`website_clicks` + `profile_links_taps`) lũy kế
 * từ mốc bắt đầu đến hiện tại.
 *
 * Lưu ý: đây là metric CẤP TÀI KHOẢN — Instagram Graph API không expose clicks ở cấp
 * bài viết, nên KHÔNG được chia con số này cho từng post.
 * Metric chỉ hỗ trợ `metric_type=total_value` (không có `time_series`), và mỗi
 * request chỉ bao tối đa 30 ngày, nên ở đây chia cửa sổ 30 ngày rồi cộng dồn.
 * Mỗi metric gọi 1 request riêng để 1 metric lỗi không làm mất metric còn lại.
 *
 * @returns {Promise<{ total: number, byMetric: Record<string, number>, windowsFetched: number, since: string, error: string|null }>}
 */
export const fetchInstagramProfileLinksTaps = async (apiKey, accountId = IG_ACCOUNT_ID) => {
  const BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
  let error = null;

  const now = Date.now();
  const envSince = process.env.IG_INSIGHTS_SINCE ? Date.parse(process.env.IG_INSIGHTS_SINCE) : NaN;
  const startMs = Number.isNaN(envSince) ? now - IG_LINK_TAPS_LOOKBACK_DAYS * DAY_MS : envSince;

  // Chia [startMs, now] thành các cửa sổ 30 ngày liên tiếp
  const windows = [];
  for (let from = startMs; from < now; from += IG_LINK_TAPS_WINDOW_DAYS * DAY_MS) {
    const to = Math.min(from + IG_LINK_TAPS_WINDOW_DAYS * DAY_MS, now);
    windows.push({ since: Math.floor(from / 1000), until: Math.floor(to / 1000) });
  }

  // Mỗi (metric x cửa sổ 30 ngày) là 1 request độc lập
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
              `[Instagram] ${metric} lỗi (${new Date(since * 1000).toISOString().slice(0, 10)} → ${new Date(until * 1000).toISOString().slice(0, 10)}):`,
              data.error.message
            );
            return { metric, taps: 0, errMsg: data.error.message };
          }

          const entry = data.data?.[0];
          // API trả data rỗng (không phải 0) khi khoảng thời gian không có số liệu
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

export const fetchInstagramTopPost = async (apiKey) => {
  try {
    const BASE = 'https://graph.facebook.com/v21.0';
    const igAccountId = IG_ACCOUNT_ID;

    const allMedia = [];
    let fetchError = null;
    // Thêm media_type + media_product_type để xác định Image/Video/Carousel/Story/Reels
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
            // Meta đã hợp nhất mọi media type (Feed/Story/Reels — gồm cả Image, Carousel)
            // về chung 1 metric "views" từ Graph API v22.0. Metric "impressions" cũ đã bị
            // deprecate hoàn toàn kể từ 21/4/2025 và trả lỗi cho mọi bài đăng từ 2/7/2024
            // trở đi — đây là lý do trước đây Carousel/Image luôn bị views: 0.
            const insightRes = await fetch(`${BASE}/${media.id}/insights?metric=views&access_token=${apiKey}`);
            if (!insightRes.ok) {
              const errBody = await insightRes.text();
              console.warn(`[Instagram] Insight lỗi cho media ${media.id} (${media.media_type}):`, errBody);
              return { ...media, views: 0 };
            }
            const insightData = await insightRes.json();
            const insight = insightData.data?.[0];
            const views = insight?.values?.[0]?.value ?? insight?.value ?? 0;
            return { ...media, views };
          } catch (err) {
            console.warn(`[Instagram] Insight exception cho media ${media.id}:`, err.message);
            return { ...media, views: 0 };
          }
        })
      );
      withViews.push(...results);
    }

    // Clicks của Instagram là metric CẤP TÀI KHOẢN (profile clicks) — không có ở cấp bài
    // viết, nên KHÔNG gán/chia cho từng post. Tổng được trả riêng ở controller.
    // Lấy hết, sắp xếp theo views giảm dần
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
    const allContent = []; // Gom chung cả Posts và Reels vào đây

    // Posts thường — thêm "shares" để lấy số share thật, và attachments{media_type,type}
    // để xác định Photo/Video/Album/Link
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
        // Gọi riêng views và clicks — 1 metric lỗi không làm hỏng metric còn lại
        const [viewsRes, clicksRes] = await Promise.all([
          fetch(`${BASE}/${post.id}/insights?metric=post_media_view&access_token=${accessToken}`)
            .then((r) => r.json())
            .catch(() => null),
          fetch(`${BASE}/${post.id}/insights?metric=post_clicks&access_token=${accessToken}`)
            .then((r) => r.json())
            .catch(() => null),
        ]);

        if (viewsRes?.error) console.warn(`[Facebook] views lỗi cho post ${post.id}:`, viewsRes.error.message);
        if (clicksRes?.error) console.warn(`[Facebook] clicks lỗi cho post ${post.id}:`, clicksRes.error.message);

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

    // Reels — KHÔNG nhúng video_insights vào field expansion nữa (1 metric sai sẽ
    // làm fail toàn bộ query). Lấy field cơ bản trước, insights gọi tách riêng theo
    // batch giống Posts, để cô lập lỗi nếu 1 video bị thiếu insight.
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
                console.warn(`[Facebook] Reel insight lỗi cho video ${reel.id}:`, d.error.message);
                return { reel, views: 0 };
              }
              const views = d.data?.[0]?.values?.[0]?.value ?? 0;
              return { reel, views };
            })
            .catch((err) => {
              console.warn(`[Facebook] Reel insight exception cho video ${reel.id}:`, err.message);
              return { reel, views: 0 };
            })
        )
      );
      for (const { reel, views } of results) {
        // video_insights của Reels không có metric clicks -> để 0, ctr theo đó = 0
        const clicks = 0;
        allContent.push({
          platform: 'Facebook',
          title: reel.description ? reel.description.slice(0, 120) : '(Reel không có mô tả)',
          views,
          likes: reel.likes?.summary?.total_count || 0,
          shares: 0, // video_reels edge không trả field "shares", cần call riêng nếu cần
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

    // Lấy hết, sắp xếp theo views giảm dần
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
        // maxPosts: 0 = lấy hết toàn bộ video của profile (theo doc của actor này)
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

    // Map thêm trường views cho dễ sort, lấy hết
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
// Lưu ý: để lấy HẾT video (không chỉ top view), phải đổi cách lấy dữ liệu:
// dùng channels.list để lấy uploads playlist, sau đó phân trang playlistItems.list,
// rồi batch gọi videos.list để lấy statistics. Cách cũ (search order=viewCount) không lấy hết được.
export const fetchYouTubeTopPost = async (channelHandle, apiKey) => {
  try {
    // 1. Tìm channelId
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelHandle)}&key=${apiKey}`
    );
    const channelData = await channelResponse.json();
    const channelId = channelData.items?.[0]?.id?.channelId;
    if (!channelId) return { platform: 'YouTube', error: 'Channel not found' };

    // 2. Lấy uploads playlist id của channel (rẻ hơn search rất nhiều về quota)
    const channelDetailRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
    );
    const channelDetailData = await channelDetailRes.json();
    const uploadsPlaylistId = channelDetailData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return { platform: 'YouTube', error: 'Uploads playlist not found' };

    // 3. Phân trang lấy hết videoId trong uploads playlist
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

    // 4. Batch videos.list theo từng nhóm 50 id (giới hạn API)
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

// Các hàm Dispatcher (fetchTopPostForPlatform, fetchAllTopPostsRaw) giữ nguyên
export const fetchTopPostForPlatform = async (platformName, handle, tokens) => {
  switch (platformName.toLowerCase()) {
    case 'facebook': return fetchFacebookTopPost(handle, tokens.metaAccessToken);
    case 'instagram': return fetchInstagramTopPost(tokens.metaAccessTokenInstagram);
    case 'tiktok': return fetchTikTokTopPost(handle, tokens.apifyToken);
    case 'youtube': return fetchYouTubeTopPost(handle, tokens.youtubeApiKey);
    default: return { platform: platformName, error: `Chưa hỗ trợ ${platformName}` };
  }
};