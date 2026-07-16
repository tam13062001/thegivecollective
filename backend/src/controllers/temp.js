// controllers/topPostController.js
import Metric from '../models/Metric.js';
import TopPost from '../models/ToppostModels.js';
import { fetchTopPostForPlatform } from '../services/ToppostsService.js';

// Bỏ LinkedIn (chưa hỗ trợ), bỏ Threads (chưa có fetcher)
const SUPPORTED_PLATFORMS = ['Facebook', 'Instagram', 'Tiktok', 'Youtube'];

/**
 * Chạy LIVE: lấy đúng handle của từng platform từ DB (bảng Metric — nơi bạn
 * đã "Add" link kênh ở Homepage), gọi API tương ứng, rồi cache vào TopPost.
 * Gọi cái này từ cron job hằng ngày (giống cách Metric được refresh),
 * KHÔNG gọi trực tiếp từ frontend vì tốn quota/API call.
 */
export const refreshTopPostsFromDb = async (req, res) => {
  try {
    // QUAN TRỌNG: đọc process.env BÊN TRONG function (lúc gọi thật),
    // không phải ở module scope — tránh bug đọc env trước khi dotenv load xong.
    const tokens = {
      metaAccessToken: process.env.META_ACCESS_TOKEN,
      metaAccessTokenInstagram: process.env.META_ACCESS_TOKEN_INSTAGRAM,
      apifyToken: process.env.APIFY_TOKEN,
      youtubeApiKey: process.env.YOUTUBE_API_KEY,
    };

    // ─── DEBUG TẠM — xoá sau khi tìm ra nguyên nhân ───
    console.log('[DEBUG] token lengths:', {
      metaAccessToken: tokens.metaAccessToken?.length ?? 'undefined',
      metaAccessTokenInstagram: tokens.metaAccessTokenInstagram?.length ?? 'undefined',
      apifyToken: tokens.apifyToken?.length ?? 'undefined',
      youtubeApiKey: tokens.youtubeApiKey?.length ?? 'undefined',
    });
    // ─────────────────────────────────────────────────

    const metrics = await Metric.find({ platformName: { $in: SUPPORTED_PLATFORMS } });

    // ─── DEBUG TẠM ───
    console.log('[DEBUG] metrics found:', metrics.map((m) => ({
      platform: m.platformName,
      handle: m.accountHandle,
    })));
    // ─────────────────

    if (metrics.length === 0) {
      const msg = 'Chưa có kênh nào trong DB (bảng Metric) để lấy top post.';
      return res ? res.status(200).json({ message: msg, posts: [] }) : [];
    }

    // Nếu lỡ add trùng nhiều URL cùng 1 platform, chỉ lấy bản ghi mới nhất
    const latestPerPlatform = new Map();
    for (const m of metrics) {
      const existing = latestPerPlatform.get(m.platformName);
      if (!existing || m.scrapedAt > existing.scrapedAt) {
        latestPerPlatform.set(m.platformName, m);
      }
    }

    const results = await Promise.all(
      Array.from(latestPerPlatform.values()).map((m) =>
        fetchTopPostForPlatform(m.platformName, m.accountHandle, tokens)
      )
    );

    const validPosts = results.filter((r) => !r.error);
    const failedPosts = results.filter((r) => r.error);

    // Cache lại (upsert theo platform) để endpoint đọc nhanh, không phải cào live mỗi lần
    await Promise.all(
      validPosts.map((post) =>
        TopPost.findOneAndUpdate(
          { platform: post.platform },
          { platform: post.platform, title: post.title, views: post.views, likes: post.likes, date: post.date, url: post.url },
          { upsert: true, returnDocument: 'after' }
        )
      )
    );

    const summary = {
      message: `Cập nhật top posts hoàn tất. Thành công: ${validPosts.length}/${results.length}`,
      posts: validPosts,
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
 * Đọc top posts đã cache trong DB — dùng cho InsightsPage, nhanh và
 * không tốn API quota mỗi lần user vào trang.
 */
export const getCachedTopPosts = async (req, res) => {
  try {
    const posts = await TopPost.find().sort({ updatedAt: -1 });

    if (posts.length === 0) {
      // Không trả về mảng rỗng vô hồn nữa — nói rõ lý do và hướng xử lý.
      return res.status(200).json({
        message: 'Chưa có dữ liệu cache. Gọi GET /api/v1/insights/top-posts/refresh trước để cào dữ liệu lần đầu.',
        posts: [],
      });
    }

    res.status(200).json(posts);
  } catch (error) {
    console.error('[TopPosts] Get cached error:', error);
    res.status(500).json({ message: 'Lỗi hệ thống khi lấy top posts', error: error.message });
  }
};