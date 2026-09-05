import Metric from '../models/Metric.js';
import AllPost from '../models/Allpost.js';
import { fetchTopPostForPlatform } from '../services/allpostService.js';

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

    const summary = {
      message: `Cập nhật top posts hoàn tất. Đã lưu ${allNewPosts.length} bài viết mới.`,
      platformsRequested: targetPlatforms,
      totalPosts: allNewPosts.length,
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

    res.status(200).json({
      total: posts.length,
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