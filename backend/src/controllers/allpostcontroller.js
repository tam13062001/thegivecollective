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

    // Cho phép chỉ refresh 1 platform để test riêng, vd: ?platform=facebook
    // Không truyền thì mặc định refresh hết như cũ.
    let targetPlatforms = SUPPORTED_PLATFORMS;
    if (req.query.platform) {
      const requested = req.query.platform.split(',').map(p => p.trim().toLowerCase());
      targetPlatforms = SUPPORTED_PLATFORMS.filter(p => requested.includes(p.toLowerCase()));
      if (targetPlatforms.length === 0) {
        return res.status(400).json({
          message: `Platform "${req.query.platform}" không hợp lệ. Chỉ hỗ trợ: ${SUPPORTED_PLATFORMS.join(', ')}.`,
        });
      }
    }

    const metrics = await Metric.find({ platformName: { $in: targetPlatforms } });

    if (metrics.length === 0) {
      const msg = 'Chưa có kênh nào trong DB (bảng Metric) để lấy top post.';
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
        console.warn('[AllPosts] Cảnh báo khi lưu DB (Có thể do trùng URL):', err.message);
        if (err.writeErrors) {
          err.writeErrors.forEach(e => {
            console.warn('  → Bài bị skip:', e.err?.op?.url || e.errmsg);
          });
        }
        return err.insertedDocs || [];
      });
    }

    // Sort theo date mới nhất trước, để xem chi tiết dễ hơn khi test 1 platform
    const sortedPosts = [...allNewPosts].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Facebook có clicks thật ở cấp bài viết (post_clicks) nên cộng trực tiếp từ posts.
    const totalClicks = allNewPosts.reduce((sum, p) => sum + (Number(p.clicks) || 0), 0);
    const totalViews = allNewPosts.reduce((sum, p) => sum + (Number(p.views) || 0), 0);

    // Instagram: clicks chỉ tồn tại ở CẤP TÀI KHOẢN (profile clicks), lấy tổng lũy kế
    // và trả riêng — không gán vào từng bài viết.
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
      message: `Cập nhật top posts hoàn tất. Đã lưu ${allNewPosts.length} bài viết mới.`,
      platformsRequested: targetPlatforms,
      totalPosts: allNewPosts.length,
      totalClicks,
      // CTR tổng = tổng clicks / tổng views * 100 (%)
      overallCtr: totalViews > 0 ? Math.round((totalClicks / totalViews) * 10000) / 100 : 0,
      instagramProfileClicks,
      // Show chi tiết từng bài đầy đủ (title, views, likes, shares, date, url, contentType...)
      insertedPosts: sortedPosts,
      errors: failedPosts,
    };

    if (res) return res.status(200).json(summary);
    return summary;
  } catch (error) {
    console.error('[TopPosts] Refresh error:', error);
    if (res) res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật top posts' });
  }
};

/**
 * Trả riêng tổng profile clicks của Instagram (metric cấp tài khoản).
 * Dùng cho frontend hiển thị số clicks IG mà không cần chạy refresh toàn bộ posts.
 * Query: ?since=YYYY-MM-DD (mặc định lấy theo env IG_INSIGHTS_SINCE / 2 năm gần nhất)
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
      note: 'Instagram chỉ có clicks ở cấp tài khoản (profile clicks), không có clicks theo từng bài viết.',
      error: taps.error,
    });
  } catch (error) {
    console.error('[Instagram] Profile clicks error:', error);
    res.status(500).json({ message: 'Lỗi hệ thống khi lấy profile clicks của Instagram', error: error.message });
  }
};

/**
 * Lịch sử THEO NGÀY của Instagram profile clicks (website_clicks + profile_links_taps),
 * dùng để vẽ chart daily trên Homepage. Khác với /instagram/profile-clicks (tổng lũy kế),
 * endpoint này trả về mảng theo từng ngày.
 * Query: ?days=7|14|30|90 (mặc định 30, tối đa 90)
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
      note: 'Website clicks + profile links taps theo ngày (giờ VN), cấp tài khoản — không tách theo từng bài viết.',
      error,
    });
  } catch (error) {
    console.error('[Instagram] Profile clicks history error:', error);
    res.status(500).json({
      message: 'Lỗi hệ thống khi lấy lịch sử profile clicks của Instagram',
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

    // Chỉ lọc theo ngày khi có days trên query; mặc định lấy full vì field `date`
    // là String nên không dùng $gte của Mongo được, phải lọc ở tầng application.
    const posts = fromDate
      ? allPosts.filter((post) => {
          if (!post.date) return false;
          const parsed = new Date(post.date);
          if (isNaN(parsed.getTime())) return false; // date không parse được -> bỏ qua
          return parsed >= fromDate;
        })
      : allPosts;

    if (posts.length === 0) {
      return res.status(200).json({
        message: days
          ? `Không có bài viết nào phù hợp trong ${days} ngày gần nhất${req.query.platform ? ` cho platform "${req.query.platform}"` : ''}.`
          : `Không có bài viết nào phù hợp${req.query.platform ? ` cho platform "${req.query.platform}"` : ''}.`,
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
    res.status(500).json({ message: 'Lỗi hệ thống khi lấy top posts', error: error.message });
  }
};