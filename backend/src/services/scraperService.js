import { JWT } from 'google-auth-library';

// Khởi tạo 1 lần, tái sử dụng cho mọi request (JWT tự refresh access token khi hết hạn)
let gaAuthClient = null;
function getGAAuthClient() {
  if (!gaAuthClient) {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    const credentials = JSON.parse(decoded);

    gaAuthClient = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });
  }
  return gaAuthClient;
}

// Gọi runReport thô, trả về toàn bộ rows (mỗi row có dimensionValues + metricValues)
const runGA4Report = async (propertyId, token, body) => {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        ...body,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = `GA4 Error: ${errorData?.error?.message ?? response.status}`;
    console.error('[GA4] API error:', response.status, errorData);
    throw new Error(message);
  }

  const data = await response.json();
  return data.rows ?? [];
};

// ---- Các breakdown theo dimension ----

const fetchTrafficSources = async (propertyId, token) => {
  const rows = await runGA4Report(propertyId, token, {
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  return rows.map((row) => ({
    source: row.dimensionValues?.[0]?.value ?? '(not set)',
    medium: row.dimensionValues?.[1]?.value ?? '(not set)',
    sessions: parseInt(row.metricValues?.[0]?.value) || 0,
    users: parseInt(row.metricValues?.[1]?.value) || 0,
  }));
};

const fetchCountries = async (propertyId, token) => {
  const rows = await runGA4Report(propertyId, token, {
    dimensions: [{ name: 'country' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    limit: 10,
  });

  return rows.map((row) => ({
    country: row.dimensionValues?.[0]?.value ?? '(not set)',
    users: parseInt(row.metricValues?.[0]?.value) || 0,
    sessions: parseInt(row.metricValues?.[1]?.value) || 0,
  }));
};

// Lưu ý: cần bật Google Signals trong GA4 property thì age/gender mới có data,
// nếu không tất cả sẽ trả về "(not set)"/"unknown"
const fetchAgeBrackets = async (propertyId, token) => {
  const rows = await runGA4Report(propertyId, token, {
    dimensions: [{ name: 'userAgeBracket' }],
    metrics: [{ name: 'activeUsers' }],
    orderBys: [{ dimension: { dimensionName: 'userAgeBracket' } }],
  });

  return rows.map((row) => ({
    age: row.dimensionValues?.[0]?.value ?? 'unknown',
    users: parseInt(row.metricValues?.[0]?.value) || 0,
  }));
};

const fetchGenders = async (propertyId, token) => {
  const rows = await runGA4Report(propertyId, token, {
    dimensions: [{ name: 'userGender' }],
    metrics: [{ name: 'activeUsers' }],
  });

  return rows.map((row) => ({
    gender: row.dimensionValues?.[0]?.value ?? 'unknown',
    users: parseInt(row.metricValues?.[0]?.value) || 0,
  }));
};

const fetchTopPages = async (propertyId, token) => {
  const rows = await runGA4Report(propertyId, token, {
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 10,
  });

  return rows.map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? '(not set)',
    views: parseInt(row.metricValues?.[0]?.value) || 0,
    users: parseInt(row.metricValues?.[1]?.value) || 0,
  }));
};

export const fetchGoogleAnalyticsStats = async () => {
  try {
    const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
    if (!propertyId) {
      return { followers: 0, posts: 0, views: 0, error: 'Thiếu GOOGLE_ANALYTICS_PROPERTY_ID trong env' };
    }
    const authClient = getGAAuthClient();
    const { token } = await authClient.getAccessToken();

    const [
      batch1,
      batch2,
      trafficSources,
      countries,
      ageBrackets,
      genders,
      topPages,
    ] = await Promise.all([
      runGA4Report(propertyId, token, {
        metrics: [
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
          { name: 'engagementRate' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
      }).then((rows) => rows[0]?.metricValues ?? []),
      runGA4Report(propertyId, token, {
        metrics: [
          { name: 'keyEvents' },
          { name: 'keyEvents:qualify_lead' },
          { name: 'keyEvents:close_convert_lead' },
          { name: 'keyEvents:purchase' },
        ],
      }).then((rows) => rows[0]?.metricValues ?? []),
      fetchTrafficSources(propertyId, token),
      fetchCountries(propertyId, token),
      fetchAgeBrackets(propertyId, token),
      fetchGenders(propertyId, token),
      fetchTopPages(propertyId, token),
    ]);

    const users            = parseInt(batch1[0]?.value) || 0;
    const newUsers          = parseInt(batch1[1]?.value) || 0;
    const sessions          = parseInt(batch1[2]?.value) || 0;
    const engagementRate    = parseFloat(batch1[3]?.value) || 0; // 0..1
    const pageviews         = parseInt(batch1[4]?.value) || 0;
    const bounceRate        = parseFloat(batch1[5]?.value) || 0; // 0..1
    const avgDuration       = parseFloat(batch1[6]?.value) || 0; // giây

    const totalKeyEvents    = parseInt(batch2[0]?.value) || 0;
    const qualifyLeads      = parseInt(batch2[1]?.value) || 0;
    const closeConvertLeads = parseInt(batch2[2]?.value) || 0;
    const purchases         = parseInt(batch2[3]?.value) || 0;

    return {
      // Shape cũ, dùng cho flow Metric chung
      followers: users,
      posts: sessions,
      views: pageviews,
      // Field mở rộng cho GA4 card
      pageviews,
      users,
      newUsers,
      sessions,
      bounceRate: Math.round(bounceRate * 100),
      avgDuration: Math.round(avgDuration),
      engagementRate: Math.round(engagementRate * 100),
      totalKeyEvents,
      qualifyLeads,
      closeConvertLeads,
      purchases,
      // Breakdown
      trafficSources,
      countries,
      ageBrackets,
      genders,
      topPages,
    };
  } catch (error) {
    console.error('[GA4] Fetch error:', error);
    return { followers: 0, posts: 0, views: 0, error: error.message || 'Failed to fetch Google Analytics stats' };
  }
};

export const fetchYouTubeStats = async (channelHandle, apiKey) => {
  try {
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelHandle)}&key=${apiKey}`
    );

    if (!channelResponse.ok) {
      return { followers: 0, posts: 0, views: 0, error: 'YouTube API request failed' };
    }

    const channelData = await channelResponse.json();

    if (!channelData.items?.[0]?.id?.channelId) {
      return { followers: 0, posts: 0, views: 0, error: 'Channel not found' };
    }

    const channelId = channelData.items[0].id.channelId;

    const statsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`
    );

    if (!statsResponse.ok) {
      return { followers: 0, posts: 0, views: 0, error: 'Failed to fetch channel stats' };
    }

    const statsData = await statsResponse.json();

    if (!statsData.items?.[0]?.statistics) {
      return { followers: 0, posts: 0, views: 0, error: 'Stats not found' };
    }

    const stats = statsData.items[0].statistics;
    return {
      followers: parseInt(stats.subscriberCount) || 0,
      posts: parseInt(stats.videoCount) || 0,
      views: parseInt(stats.viewCount) || 0,
    };
  } catch (error) {
    console.error('[YouTube] API error:', error);
    return { followers: 0, posts: 0, views: 0, error: 'Failed to fetch YouTube stats' };
  }
};

export const fetchTikTokStats = async (handle, apifyToken) => {
  try {
    const cleanHandle = handle.replace('@', '');
    console.log(`[TikTok] Requesting Apify for: ${cleanHandle}`);

    const response = await fetch(
      `https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profiles: [cleanHandle],
          maxPosts: 100,
        }),
      }
    );

    if (!response.ok) {
      return { followers: 0, posts: 0, views: 0, error: `Apify Error: ${response.status}` };
    }

    const items = await response.json();

    if (!Array.isArray(items) || items.length === 0) {
      return { followers: 0, posts: 0, views: 0, error: 'No data returned from Apify' };
    }

    const views = items.reduce((sum, item) => sum + (Number(item.playCount) || 0), 0);
    const followers = items[0]?.authorMeta?.fans ?? items[0]?.authorMeta?.followers ?? 0;

    return {
      followers,
      posts: items.length,
      views,
    };
  } catch (error) {
    console.error('[TikTok] Fetch error:', error);
    return { followers: 0, posts: 0, views: 0, error: 'Failed to fetch TikTok stats' };
  }
};

const GRAPH_API_VERSION = 'v21.0';

export const fetchMetaStats = async (pageId, accessToken) => {
  try {
    // 1. Thông tin cơ bản
    const pageResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}?fields=id,name,followers_count&access_token=${accessToken}`
    );
    const pageData = await pageResponse.json();

    if (pageData.error) {
      return { followers: 0, posts: 0, views: 0, error: pageData.error.message };
    }
    if (!pageData.id) {
      return { followers: 0, posts: 0, views: 0, error: 'Page not found' };
    }

    const followers = pageData.followers_count || 0;
    const resolvedPageId = pageData.id;

    // 2. Lấy số lượng và lượt xem Posts
    let postCount = 0;
    let postViews = 0;
    let postsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${resolvedPageId}/posts?fields=id,created_time&limit=100&access_token=${accessToken}`;
    const postIds = [];

    while (postsUrl) {
      const res = await fetch(postsUrl);
      const data = await res.json();
      if (data.error) break;

      for (const post of data.data || []) {
        postCount++;
        postIds.push(post.id);
      }
      postsUrl = data.paging?.next || null;
    }

    // Lấy Insight từng bài
    const BATCH_SIZE = 20;
    for (let i = 0; i < postIds.length; i += BATCH_SIZE) {
      const batch = postIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((id) =>
          fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${id}/insights?metric=post_media_view&access_token=${accessToken}`)
            .then((r) => r.json())
            .catch(() => null)
        )
      );

      for (const result of results) {
        if (!result || result.error) continue;
        const metric = result.data?.find((m) => m.name === 'post_media_view');
        const value = metric?.values?.[0]?.value;
        if (typeof value === 'number') {
          postViews += value;
        }
      }
    }

    // 3. Lấy số lượng và lượt xem Reels
    let reelCount = 0;
    let reelViews = 0;
    let reelsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${resolvedPageId}/video_reels?fields=id,video_insights.metric(plays,blue_reels_play_count)&limit=100&access_token=${accessToken}`;

    while (reelsUrl) {
      const res = await fetch(reelsUrl);
      const data = await res.json();
      if (data.error) break;

      for (const reel of data.data || []) {
        reelCount++;
        const insights = reel.video_insights?.data || [];
        const plays = insights.find((i) => i.name === 'blue_reels_play_count') || insights.find((i) => i.name === 'plays');
        if (plays?.values?.[0]?.value) {
          reelViews += plays.values[0].value;
        }
      }
      reelsUrl = data.paging?.next || null;
    }

    return {
      followers,
      posts: postCount + reelCount,
      views: postViews + reelViews,
      name: pageData.name,
    };
  } catch (error) {
    console.error('[Facebook] Fetch error:', error);
    return { followers: 0, posts: 0, views: 0, error: 'Failed to fetch Meta stats' };
  }
};

export const fetchInstagramStats = async (handle, apiKey) => {
  try {
    const BASE = 'https://graph.facebook.com/v19.0';
    
    // Đã hardcode cứng ID của The Give Collective
    // (Bỏ qua hoàn toàn biến 'handle' được truyền từ Postman xuống)
    const igAccountId = '17841422427064625';

    // 1. Lấy thông tin Profile cơ bản (Followers, Số lượng bài post)
    const profileRes = await fetch(`${BASE}/${igAccountId}?fields=followers_count,media_count&access_token=${apiKey}`);
    if (!profileRes.ok) {
      return { followers: 0, posts: 0, views: 0, error: `Graph API Error: ${profileRes.status}` };
    }
    
    const profile = await profileRes.json();
    if (profile.error) {
      return { followers: 0, posts: 0, views: 0, error: profile.error.message };
    }

    // 2. Lấy danh sách TẤT CẢ bài viết kèm theo loại (media_type)
    const allMedia = [];
    let nextUrl = `${BASE}/${igAccountId}/media?fields=id,media_type&limit=100&access_token=${apiKey}`;

    while (nextUrl) {
      const mediaRes = await fetch(nextUrl);
      if (!mediaRes.ok) break;

      const mediaData = await mediaRes.json();
      for (const item of mediaData.data || []) {
        // Lưu cả id và type để xử lý metric đếm view cho phù hợp
        allMedia.push({ id: item.id, type: item.media_type });
      }
      nextUrl = mediaData.paging?.next ?? null;
    }

    // 3. Tính tổng lượt xem (Views/Impressions)
    let totalViews = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < allMedia.length; i += BATCH_SIZE) {
      const batch = allMedia.slice(i, i + BATCH_SIZE);
      const batchViews = await Promise.all(
        batch.map(async (media) => {
          try {
            // Phân loại tự động: Video/Reels dùng 'views', Ảnh/Album dùng 'impressions'
            const metric = media.type === 'VIDEO' ? 'views' : 'impressions';
            
            const insightRes = await fetch(`${BASE}/${media.id}/insights?metric=${metric}&access_token=${apiKey}`);
            if (!insightRes.ok) return 0;

            const insightData = await insightRes.json();
            const insight = insightData.data?.[0];
            
            return insight?.values?.[0]?.value ?? insight?.value ?? 0;
          } catch {
            return 0; // Tránh sập luồng nếu 1 bài post bị lỗi API
          }
        })
      );
      
      totalViews += batchViews.reduce((sum, v) => sum + v, 0);
    }

    // 4. Trả về kết quả cuối cùng
    return {
      followers: profile.followers_count ?? 0,
      posts: profile.media_count ?? 0,
      views: totalViews,
    };
    
  } catch (error) {
    console.error('[Instagram] Fetch error:', error);
    return { followers: 0, posts: 0, views: 0, error: 'Failed to fetch Instagram stats' };
  }
};

export const fetchLinkedInStats = async (handle, apiToken) => {
  try {
    const companySlug = handle.replace(/\/$/, '').split('/').pop() || handle;
    const linkedinUrl = `https://www.linkedin.com/company/${companySlug}/`;

    console.log(`[LinkedIn] Bắt đầu lấy dữ liệu cho: ${linkedinUrl}`);

    // ==========================================
    // 1. LẤY FOLLOWERS (Dùng Actor: linkedin-company)
    // ==========================================
    const PROFILE_ACTOR_ID = 'harvestapi~linkedin-company';
    let followersCount = 0;

    const profileResponse = await fetch(
      `https://api.apify.com/v2/acts/${PROFILE_ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: [linkedinUrl] }),
      }
    );

    if (profileResponse.ok) {
      const profileDataset = await profileResponse.json();
      if (profileDataset && profileDataset.length > 0) {
        followersCount = profileDataset[0].followerCount || profileDataset[0].follower_count || profileDataset[0].followers || 0;
      }
    } else {
      console.error('[LinkedIn] Lỗi lấy Profile:', await profileResponse.text());
    }

    // ==========================================
    // 2. LẤY POSTS COUNT (Dùng Actor: linkedin-profile-posts)
    // ==========================================
    const POSTS_ACTOR_ID = 'harvestapi~linkedin-profile-posts';
    let postsCount = 0;

    // MẸO: Bạn hãy click sang tab "JSON" (cạnh chữ Form trong ảnh của bạn) trên Apify 
    // để xem chính xác các key cần truyền vào body. Thông thường nó sẽ như sau:
    const postsInputParams = {
      targetUrls: [linkedinUrl],
      maxPosts: 100, // Set một số cực lớn để lấy TẤT CẢ bài viết (thay vì 10 như mặc định)
      // includeQuotePosts: true, 
      // includeReposts: true 
    };

    console.log(`[LinkedIn] Đang cào Posts... (việc này có thể mất thời gian)`);
    const postsResponse = await fetch(
      `https://api.apify.com/v2/acts/${POSTS_ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postsInputParams),
      }
    );

    if (postsResponse.ok) {
      const postsDataset = await postsResponse.json();
      // Số lượng post chính là số lượng phần tử (objects) trong mảng dataset trả về
      postsCount = postsDataset ? postsDataset.length : 0;
    } else {
      console.error('[LinkedIn] Lỗi lấy Posts:', await postsResponse.text());
    }

    // ==========================================
    // 3. TRẢ VỀ KẾT QUẢ CUỐI CÙNG
    // ==========================================
    return {
      followers: followersCount,
      posts: postsCount,
      views: 0, // Lưu ý: Vẫn phải để 0 vì Views của tổng trang không thể cào bằng bot (cần tài khoản Admin)
    };

  } catch (error) {
    console.error('[LinkedIn] Fetch error:', error);
    return { followers: 0, posts: 0, views: 0, error: 'Failed to fetch LinkedIn stats' };
  }
};