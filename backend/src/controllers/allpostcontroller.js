import Metric from '../models/Metric.js';
import AllPost from '../models/Allpost.js';
import {
  fetchTopPostForPlatform,
  fetchInstagramProfileLinksTaps,
  fetchInstagramProfileClicksDailySeries,
} from '../services/allpostService.js';

const SUPPORTED_PLATFORMS = ['Facebook', 'Instagram', 'Tiktok', 'Youtube'];

export const refreshAllPostsFromDb = async (req, res) => {
  try {
    const tokens = {
      metaAccessToken: process.env.META_ACCESS_TOKEN,
      metaAccessTokenInstagram: process.env.META_ACCESS_TOKEN_INSTAGRAM,
      apifyToken: process.env.APIFY_TOKEN,
      youtubeApiKey: process.env.YOUTUBE_API_KEY,
    };

    // Allow refreshing a single platform for testing, e.g. ?platform=facebook
    // If omitted, refreshes everything as before.
    let targetPlatforms = SUPPORTED_PLATFORMS;
    if (req.query.platform) {
      const requested = req.query.platform.split(',').map(p => p.trim().toLowerCase());
      targetPlatforms = SUPPORTED_PLATFORMS.filter(p => requested.includes(p.toLowerCase()));
      if (targetPlatforms.length === 0) {
        return res.status(400).json({
          message: `Platform "${req.query.platform}" is not valid. Supported: ${SUPPORTED_PLATFORMS.join(', ')}.`,
        });
      }
    }

    const metrics = await Metric.find({ platformName: { $in: targetPlatforms } });

    if (metrics.length === 0) {
      const msg = 'No channels found in DB (Metric collection) to fetch top posts.';
      return res ? res.status(200).json({ message: msg, posts: [] }) : [];
    }

    const latestPerPlatform = new Map();
    for (const m of metrics) {
      const existing = latestPerPlatform.get(m.platformName);
      if (!existing || m.scrapedAt > existing.scrapedAt) {
        latestPerPlatform.set(m.platformName, m);
      }
    }

    const results = await Promise.all(
      Array.from(latestPerPlatform.values()).map(async (m) => {
        const data = await fetchTopPostForPlatform(m.platformName, m.accountHandle, tokens);
        return { platform: m.platformName, data };
      })
    );

    const successfulPlatforms = [];
    const allNewPosts = [];
    const failedPosts = [];

    results.forEach((resItem) => {
      if (resItem.data && resItem.data.error) {
        failedPosts.push(resItem);
      } else if (Array.isArray(resItem.data) && resItem.data.length > 0) {
        const actualPlatform = resItem.data[0].platform;
        successfulPlatforms.push(actualPlatform);
        allNewPosts.push(...resItem.data);
      } else if (resItem.data && !Array.isArray(resItem.data)) {
        const actualPlatform = resItem.data.platform;
        successfulPlatforms.push(actualPlatform);
        allNewPosts.push(resItem.data);
      }
    });

    await AllPost.syncIndexes();

    if (successfulPlatforms.length > 0) {
      await AllPost.deleteMany({
        $or: [
          { platform: { $in: successfulPlatforms } },
          { platform: null },
        ],
      });

      const insertResult = await AllPost.insertMany(allNewPosts, { ordered: false }).catch(err => {
        console.warn('[AllPosts] Warning while saving to DB (possibly duplicate URLs):', err.message);
        if (err.writeErrors) {
          err.writeErrors.forEach(e => {
            console.warn('  → Skipped post:', e.err?.op?.url || e.errmsg);
          });
        }
        return err.insertedDocs || [];
      });
    }

    // Sort by most recent date first, easier to review when testing a single platform
    const sortedPosts = [...allNewPosts].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Facebook has real post-level clicks (post_clicks) so we sum them directly from posts.
    const totalClicks = allNewPosts.reduce((sum, p) => sum + (Number(p.clicks) || 0), 0);
    const totalViews = allNewPosts.reduce((sum, p) => sum + (Number(p.views) || 0), 0);

    // Instagram: clicks only exist at the ACCOUNT LEVEL (profile clicks), fetch the
    // cumulative total and return it separately — not assigned to individual posts.
    let instagramProfileClicks = null;
    if (successfulPlatforms.some(p => String(p).toLowerCase() === 'instagram')) {
      const taps = await fetchInstagramProfileLinksTaps(tokens.metaAccessTokenInstagram);
      instagramProfileClicks = {
        total: taps.total,
        byMetric: taps.byMetric,
        since: taps.since,
        error: taps.error,
      };
    }

    const summary = {
      message: `Top posts update complete. Saved ${allNewPosts.length} new posts.`,
      platformsRequested: targetPlatforms,
      totalPosts: allNewPosts.length,
      totalClicks,
      // Overall CTR = total clicks / total views * 100 (%)
      overallCtr: totalViews > 0 ? Math.round((totalClicks / totalViews) * 10000) / 100 : 0,
      instagramProfileClicks,
      // Show full detail for each post (title, views, likes, shares, date, url, contentType...)
      insertedPosts: sortedPosts,
      errors: failedPosts,
    };

    if (res) return res.status(200).json(summary);
    return summary;
  } catch (error) {
    console.error('[TopPosts] Refresh error:', error);
    if (res) res.status(500).json({ message: 'System error while updating top posts' });
  }
};

/**
 * Returns Instagram's total profile clicks (account-level metric) on its own.
 * Used by the frontend to display IG clicks without running a full posts refresh.
 * Query: ?since=YYYY-MM-DD (defaults to env IG_INSIGHTS_SINCE / last 2 years)
 */
export const getInstagramProfileClicks = async (req, res) => {
  try {
    if (req.query.since) process.env.IG_INSIGHTS_SINCE = req.query.since;

    const taps = await fetchInstagramProfileLinksTaps(process.env.META_ACCESS_TOKEN_INSTAGRAM);

    res.status(200).json({
      platform: 'Instagram',
      profileClicks: taps.total,
      byMetric: taps.byMetric,
      since: taps.since,
      note: 'Instagram only has clicks at the account level (profile clicks), not per individual post.',
      error: taps.error,
    });
  } catch (error) {
    console.error('[Instagram] Profile clicks error:', error);
    res.status(500).json({ message: 'System error while fetching Instagram profile clicks', error: error.message });
  }
};

/**
 * DAILY history of Instagram profile clicks (website_clicks + profile_links_taps),
 * used for the Homepage daily chart. Unlike /instagram/profile-clicks (cumulative total),
 * this endpoint returns an array broken down by day.
 * Query: ?days=7|14|30|90 (default 30, max 90)
 */
export const getInstagramProfileClicksHistory = async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const { series, error } = await fetchInstagramProfileClicksDailySeries(
      process.env.META_ACCESS_TOKEN_INSTAGRAM,
      days,
    );

    res.status(200).json({
      platform: 'Instagram',
      days,
      data: series,
      note: 'Website clicks + profile links taps by day (Singapore time), account-level — not split per post.',
      error,
    });
  } catch (error) {
    console.error('[Instagram] Profile clicks history error:', error);
    res.status(500).json({
      message: 'System error while fetching Instagram profile clicks history',
      error: error.message,
    });
  }
};

export const getCachedAllPosts = async (req, res) => {
  try {
    const hasDaysFilter = req.query.days !== undefined && Number(req.query.days) > 0;
    const days = hasDaysFilter ? Number(req.query.days) : null;

    let fromDate = null;
    if (days) {
      fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
    }

    const query = {};
    if (req.query.platform) {
      const platforms = req.query.platform.split(',').map(p => p.trim());
      query.platform = platforms.length > 1 ? { $in: platforms } : platforms[0];
    }

    const allPosts = await AllPost.find(query).sort({ date: -1 });

    // Only filter by date when `days` is provided in the query; default is to fetch
    // everything, since the `date` field is a String so Mongo's $gte can't be used —
    // filtering has to happen at the application layer.
    const posts = fromDate
      ? allPosts.filter((post) => {
          if (!post.date) return false;
          const parsed = new Date(post.date);
          if (isNaN(parsed.getTime())) return false; // unparseable date -> skip
          return parsed >= fromDate;
        })
      : allPosts;

    if (posts.length === 0) {
      return res.status(200).json({
        message: days
          ? `No matching posts found in the last ${days} days${req.query.platform ? ` for platform "${req.query.platform}"` : ''}.`
          : `No matching posts found${req.query.platform ? ` for platform "${req.query.platform}"` : ''}.`,
        total: 0,
        posts: [],
      });
    }

    const groupedPosts = posts.reduce((acc, post) => {
      if (post.platform) {
        if (!acc[post.platform]) acc[post.platform] = [];
        acc[post.platform].push(post);
      }
      return acc;
    }, {});

    const cachedClicks = posts.reduce((sum, p) => sum + (Number(p.clicks) || 0), 0);
    const cachedViews = posts.reduce((sum, p) => sum + (Number(p.views) || 0), 0);

    res.status(200).json({
      total: posts.length,
      totalClicks: cachedClicks,
      overallCtr: cachedViews > 0 ? Math.round((cachedClicks / cachedViews) * 10000) / 100 : 0,
      rangeDays: days || 'all',
      platformFilter: req.query.platform || null,
      posts,
      groupedByPlatform: groupedPosts,
    });
  } catch (error) {
    console.error('[TopPosts] Get cached error:', error);
    res.status(500).json({ message: 'System error while fetching top posts', error: error.message });
  }
};