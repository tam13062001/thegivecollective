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
    const igUserId = handle.replace('@', '');

    const profileRes = await fetch(`${BASE}/${igUserId}?fields=followers_count,media_count&access_token=${apiKey}`);
    if (!profileRes.ok) return { followers: 0, posts: 0, views: 0, error: `Graph API Error: ${profileRes.status}` };
    
    const profile = await profileRes.json();
    if (profile.error) return { followers: 0, posts: 0, views: 0, error: profile.error.message };

    const allMediaIds = [];
    let nextUrl = `${BASE}/${igUserId}/media?fields=id,media_type&limit=100&access_token=${apiKey}`;

    while (nextUrl) {
      const mediaRes = await fetch(nextUrl);
      if (!mediaRes.ok) break;

      const mediaData = await mediaRes.json();
      for (const item of mediaData.data || []) {
        allMediaIds.push(item.id);
      }
      nextUrl = mediaData.paging?.next ?? null;
    }

    let totalViews = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < allMediaIds.length; i += BATCH_SIZE) {
      const batch = allMediaIds.slice(i, i + BATCH_SIZE);
      const batchViews = await Promise.all(
        batch.map(async (mediaId) => {
          try {
            const insightRes = await fetch(`${BASE}/${mediaId}/insights?metric=views&access_token=${apiKey}`);
            if (!insightRes.ok) return 0;

            const insightData = await insightRes.json();
            const insight = insightData.data?.[0];
            return insight?.value ?? insight?.values?.[0]?.value ?? 0;
          } catch {
            return 0;
          }
        })
      );
      totalViews += batchViews.reduce((sum, v) => sum + v, 0);
    }

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
    const ACTOR_ID = 'harvestapi~linkedin-company'; 

    console.log(`[LinkedIn] Requesting Apify for: ${linkedinUrl}`);

    const response = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: [linkedinUrl] }),
      }
    );

    if (!response.ok) {
      return { followers: 0, posts: 0, views: 0, error: `Apify Error: ${response.status}` };
    }

    const dataset = await response.json();

    if (!dataset || dataset.length === 0) {
      return { followers: 0, posts: 0, views: 0, error: 'Apify returned empty data' };
    }

    const companyData = dataset[0];
    
    return {
      followers: companyData.followerCount || companyData.follower_count || companyData.followers || 0,
      posts: 0, 
      views: 0,
    };
  } catch (error) {
    console.error('[LinkedIn] Fetch error:', error);
    return { followers: 0, posts: 0, views: 0, error: 'Failed to fetch LinkedIn stats via Apify' };
  }
};