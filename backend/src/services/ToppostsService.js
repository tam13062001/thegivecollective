// services/topPosts.js
const GRAPH_API_VERSION = 'v21.0';
// Thêm helper này ở đầu file
const formatDateTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString.slice(0, 10); // fallback nếu parse lỗi
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
// ─── Instagram ───────────────────────────────────────────────────────────────
export const fetchInstagramTopPost = async (apiKey) => {
  try {
    const BASE = 'https://graph.facebook.com/v21.0';
    const igAccountId = '17841422427064625'; 

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

    // Lấy top 3
    const top3 = withViews.sort((a, b) => b.views - a.views).slice(0, 3);

    return top3.map(top => ({
      platform: 'Instagram',
      title: top.caption ? top.caption.slice(0, 120) : '(Không có caption)',
      views: top.views || 0,
      likes: top.like_count || 0,
      date: formatDateTime(top.timestamp),
      url: top.permalink,
    }));
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
        allContent.push({
          platform: 'Facebook',
          title: post.message ? post.message.slice(0, 120) : '(No caption)',
          views,
          likes: post.likes?.summary?.total_count || 0,
          date: formatDateTime(post.created_time),
          url: post.permalink_url,
        });
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
        allContent.push({
          platform: 'Facebook',
          title: reel.description ? reel.description.slice(0, 120) : '(Reel không có mô tả)',
          views,
          likes: reel.likes?.summary?.total_count || 0,
          date: formatDateTime(reel.created_time),
          url: reel.permalink_url,
        });
      }
      reelsUrl = data.paging?.next || null;
    }

    if (allContent.length === 0) {
        return { platform: 'Facebook', error: postsError || reelsError || 'No posts found' };
    }

    // Lấy top 3
    return allContent.sort((a, b) => b.views - a.views).slice(0, 3);
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
        body: JSON.stringify({ profiles: [cleanHandle], maxPosts: 100 }),
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

    // Map thêm trường views cho dễ sort, sắp xếp, lấy top 3
    const top3 = validItems
        .map(item => ({ ...item, views: Number(item.playCount) || 0 }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 3);

    return top3.map(top => ({
      platform: 'TikTok',
      title: top.text ? top.text.slice(0, 120) : '(Không có caption)',
      views: top.views,
      likes: Number(top.diggCount) || 0,
      date: formatDateTime(top.createTimeISO),
      url: top.webVideoUrl,
    }));
  } catch (error) {
    console.error('[TikTok] Top post error:', error);
    return { platform: 'TikTok', error: 'Failed to fetch top TikTok posts' };
  }
};

// ─── YouTube ─────────────────────────────────────────────────────────────────
export const fetchYouTubeTopPost = async (channelHandle, apiKey) => {
  try {
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelHandle)}&key=${apiKey}`
    );
    const channelData = await channelResponse.json();
    const channelId = channelData.items?.[0]?.id?.channelId;
    if (!channelId) return { platform: 'YouTube', error: 'Channel not found' };

    // Đổi maxResults từ 1 sang 3
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=viewCount&maxResults=3&key=${apiKey}`
    );
    const searchData = await searchRes.json();
    const videoIds = searchData.items?.map(item => item.id?.videoId).filter(Boolean) || [];
    
    if (videoIds.length === 0) return { platform: 'YouTube', error: 'No videos found' };

    // Batch request: Lấy details của cả 3 video chỉ trong 1 call (tiết kiệm quota)
    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}&key=${apiKey}`
    );
    const videoData = await videoRes.json();
    
    return (videoData.items || [])
      .map(video => ({
        platform: 'YouTube',
        title: video.snippet.title,
        views: parseInt(video.statistics.viewCount) || 0,
        likes: parseInt(video.statistics.likeCount) || 0,
        date: formatDateTime(video.snippet.publishedAt),
        url: `https://www.youtube.com/watch?v=${video.id}`,
      }))
      .sort((a, b) => b.views - a.views); // Đảm bảo đúng thứ tự
  } catch (error) {
    console.error('[YouTube] Top post error:', error);
    return { platform: 'YouTube', error: 'Failed to fetch top YouTube videos' };
  }
};

// Các hàm Dispatcher (fetchTopPostForPlatform, fetchAllTopPostsRaw) giữ nguyên
export const fetchTopPostForPlatform = async (platformName, handle, tokens) => {
  switch (platformName.toLowerCase()) {
    case 'facebook': return fetchFacebookTopPost(handle, tokens.metaAccessTokenInstagram);
    case 'instagram': return fetchInstagramTopPost(tokens.metaAccessTokenInstagram);
    case 'tiktok': return fetchTikTokTopPost(handle, tokens.apifyToken);
    case 'youtube': return fetchYouTubeTopPost(handle, tokens.youtubeApiKey);
    default: return { platform: platformName, error: `Chưa hỗ trợ ${platformName}` };
  }
};