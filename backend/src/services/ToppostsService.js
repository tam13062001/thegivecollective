// services/topPosts.js
// Lấy bài đăng/video có lượt xem cao nhất của từng nền tảng (mỗi nền tảng 1 bài).
// Dùng chung API key/token với services thống kê tổng (xem file services thống kê hiện có).

const GRAPH_API_VERSION = 'v21.0';

// ─── Instagram ───────────────────────────────────────────────────────────────

export const fetchInstagramTopPost = async (apiKey) => {
  try {
    const BASE = 'https://graph.facebook.com/v21.0';
    const igAccountId = '17841422427064625'; // The Give Collective

    const allMedia = [];
    let fetchError = null;
    let nextUrl = `${BASE}/${igAccountId}/media?fields=id,caption,timestamp,media_type,like_count,permalink&limit=100&access_token=${apiKey}`;

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

    // Lấy views cho từng bài theo batch (VIDEO dùng 'views', ảnh/album dùng 'impressions')
    const BATCH_SIZE = 20;
    const withViews = [];
    for (let i = 0; i < allMedia.length; i += BATCH_SIZE) {
      const batch = allMedia.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (media) => {
          try {
            const metric = media.media_type === 'VIDEO' ? 'views' : 'impressions';
            const insightRes = await fetch(`${BASE}/${media.id}/insights?metric=${metric}&access_token=${apiKey}`);
            if (!insightRes.ok) return { ...media, views: 0 };
            const insightData = await insightRes.json();
            const insight = insightData.data?.[0];
            const views = insight?.values?.[0]?.value ?? insight?.value ?? 0;
            return { ...media, views };
          } catch {
            return { ...media, views: 0 };
          }
        })
      );
      withViews.push(...results);
    }

    const top = withViews.sort((a, b) => b.views - a.views)[0];

    return {
      platform: 'Instagram',
      title: top.caption ? top.caption.slice(0, 120) : '(Không có caption)',
      views: top.views || 0,
      likes: top.like_count || 0,
      date: top.timestamp?.slice(0, 10) || '',
      url: top.permalink,
    };
  } catch (error) {
    console.error('[Instagram] Top post error:', error);
    return { platform: 'Instagram', error: 'Failed to fetch top Instagram post' };
  }
};

// ─── Facebook (Posts + Reels gộp chung, lấy cái views cao nhất) ───────────────

export const fetchFacebookTopPost = async (pageId, accessToken) => {
  try {
    const BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
    let top = null;

    // Posts thường
    const posts = [];
    let postsError = null;
    let postsUrl = `${BASE}/${pageId}/posts?fields=id,message,created_time,permalink_url,likes.summary(true)&limit=100&access_token=${accessToken}`;
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
        batch.map((post) =>
          fetch(`${BASE}/${post.id}/insights?metric=post_media_view&access_token=${accessToken}`)
            .then((r) => r.json())
            .then((d) => ({ post, views: d.data?.[0]?.values?.[0]?.value ?? 0 }))
            .catch(() => ({ post, views: 0 }))
        )
      );
      for (const { post, views } of results) {
        if (!top || views > top.views) {
          top = {
            platform: 'Facebook',
            title: post.message ? post.message.slice(0, 120) : '(Không có nội dung)',
            views,
            likes: post.likes?.summary?.total_count || 0,
            date: post.created_time?.slice(0, 10) || '',
            url: post.permalink_url,
          };
        }
      }
    }

    // Reels
    let reelsError = null;
    let reelsUrl = `${BASE}/${pageId}/video_reels?fields=id,description,created_time,permalink_url,likes.summary(true),video_insights.metric(plays,blue_reels_play_count)&limit=100&access_token=${accessToken}`;
    while (reelsUrl) {
      const res = await fetch(reelsUrl);
      const data = await res.json();
      if (data.error) { reelsError = data.error.message; break; }
      for (const reel of data.data || []) {
        const insights = reel.video_insights?.data || [];
        const plays = insights.find((i) => i.name === 'blue_reels_play_count') || insights.find((i) => i.name === 'plays');
        const views = plays?.values?.[0]?.value ?? 0;
        if (!top || views > top.views) {
          top = {
            platform: 'Facebook',
            title: reel.description ? reel.description.slice(0, 120) : '(Reel không có mô tả)',
            views,
            likes: reel.likes?.summary?.total_count || 0,
            date: reel.created_time?.slice(0, 10) || '',
            url: reel.permalink_url,
          };
        }
      }
      reelsUrl = data.paging?.next || null;
    }

    return top || { platform: 'Facebook', error: postsError || reelsError || 'No posts found (0 posts, 0 reels)' };
  } catch (error) {
    console.error('[Facebook] Top post error:', error);
    return { platform: 'Facebook', error: 'Failed to fetch top Facebook post' };
  }
};

// ─── TikTok (qua Apify, giống fetchTikTokStats) ────────────────────────────────

export const fetchTikTokTopPost = async (handle, apifyToken) => {
  try {
    const cleanHandle = handle.replace('@', '');

    const response = await fetch(
      `https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles: [cleanHandle], maxPosts: 100 }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      return { platform: 'TikTok', error: `Apify Error: ${response.status} — ${errBody.slice(0, 200)}` };
    }

    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) {
      return { platform: 'TikTok', error: 'No data returned from Apify' };
    }

    // Apify đẩy "error item" (có field errorCode) vào dataset thay vì bỏ qua
    // khi không cào được 1 video cụ thể — phải lọc bỏ trước khi chọn top.
    const validItems = items.filter((item) => !item.errorCode && item.id);
    if (validItems.length === 0) {
      return { platform: 'TikTok', error: 'All items returned errorCode from Apify (profile private/blocked?)' };
    }

    const top = validItems.reduce((best, item) => {
      const views = Number(item.playCount) || 0;
      return !best || views > best.views ? { ...item, views } : best;
    }, null);

    return {
      platform: 'TikTok',
      title: top.text ? top.text.slice(0, 120) : '(Không có caption)',
      views: top.views || 0,
      likes: Number(top.diggCount) || 0,
      date: top.createTimeISO?.slice(0, 10) || '',
      url: top.webVideoUrl,
    };
  } catch (error) {
    console.error('[TikTok] Top post error:', error);
    return { platform: 'TikTok', error: 'Failed to fetch top TikTok post' };
  }
};

// ─── YouTube ─────────────────────────────────────────────────────────────────
// Lưu ý quota: search.list tốn 100 units/lần (so với videos.list chỉ 1 unit).
// Nếu gọi trong cron job chạy nhiều lần/ngày, cân nhắc cache lại videoId thay vì search mỗi lần.

export const fetchYouTubeTopPost = async (channelHandle, apiKey) => {
  try {
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelHandle)}&key=${apiKey}`
    );
    if (!channelResponse.ok) {
      const errBody = await channelResponse.text();
      return { platform: 'YouTube', error: `YouTube API request failed (${channelResponse.status}): ${errBody.slice(0, 200)}` };
    }
    const channelData = await channelResponse.json();
    const channelId = channelData.items?.[0]?.id?.channelId;
    if (!channelId) {
      return { platform: 'YouTube', error: 'Channel not found' };
    }

    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=viewCount&maxResults=1&key=${apiKey}`
    );
    if (!searchRes.ok) {
      return { platform: 'YouTube', error: 'Failed to search top video' };
    }
    const searchData = await searchRes.json();
    const videoId = searchData.items?.[0]?.id?.videoId;
    if (!videoId) {
      return { platform: 'YouTube', error: 'No videos found' };
    }

    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`
    );
    const videoData = await videoRes.json();
    const video = videoData.items?.[0];
    if (!video) {
      return { platform: 'YouTube', error: 'Video details not found' };
    }

    return {
      platform: 'YouTube',
      title: video.snippet.title,
      views: parseInt(video.statistics.viewCount) || 0,
      likes: parseInt(video.statistics.likeCount) || 0,
      date: video.snippet.publishedAt?.slice(0, 10) || '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  } catch (error) {
    console.error('[YouTube] Top post error:', error);
    return { platform: 'YouTube', error: 'Failed to fetch top YouTube video' };
  }
};

// ─── Dispatcher: dùng đúng handle đã lưu trong DB (bảng Metric) ────────────────
// thay vì tự đoán / hard-code riêng cho topPosts, tránh lấy nhầm kênh.

export const fetchTopPostForPlatform = async (platformName, handle, tokens) => {
  switch (platformName.toLowerCase()) {
    case 'facebook':
      // Giống fetchMetaStats: dùng thẳng handle (slug từ URL) làm pageId
      return fetchFacebookTopPost(handle, tokens.metaAccessToken);
    case 'instagram':
      // Giống fetchInstagramStats: IG account ID luôn hard-code, bỏ qua handle
      return fetchInstagramTopPost(tokens.metaAccessTokenInstagram);
    case 'tiktok':
      return fetchTikTokTopPost(handle, tokens.apifyToken);
    case 'youtube':
      return fetchYouTubeTopPost(handle, tokens.youtubeApiKey);
    default:
      return { platform: platformName, error: `Chưa hỗ trợ lấy top post cho ${platformName}` };
  }
};

// ─── Gộp cả 4 nền tảng (bỏ LinkedIn theo yêu cầu) ──────────────────────────────

// Trả về TẤT CẢ kết quả kể cả lỗi — dùng để debug xem platform nào fail và tại sao.
export const fetchAllTopPostsRaw = async ({
  igApiKey,
  fbPageId,
  fbAccessToken,
  tiktokHandle,
  apifyToken,
  youtubeChannelHandle,
  youtubeApiKey,
}) => {
  const [instagram, facebook, tiktok, youtube] = await Promise.all([
    fetchInstagramTopPost(igApiKey),
    fetchFacebookTopPost(fbPageId, fbAccessToken),
    fetchTikTokTopPost(tiktokHandle, apifyToken),
    fetchYouTubeTopPost(youtubeChannelHandle, youtubeApiKey),
  ]);
  return { instagram, facebook, tiktok, youtube };
};

export const fetchAllTopPosts = async (config) => {
  const raw = await fetchAllTopPostsRaw(config);
  const results = Object.values(raw);

  // Bỏ những platform bị lỗi (thiếu token, API fail...) thay vì làm vỡ cả response
  return results
    .filter((r) => !r.error)
    .map((r, idx) => ({ id: idx + 1, ...r }));
};