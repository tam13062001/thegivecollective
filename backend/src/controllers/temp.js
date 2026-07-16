// controllers/topPostController.js
import Metric from '../models/Metric.js';
import TopPost from '../models/ToppostModels.js';
import { fetchTopPostForPlatform } from '../services/ToppostsService.js';

const SUPPORTED_PLATFORMS = ['Facebook', 'Instagram', 'Tiktok', 'Youtube'];

export const refreshTopPostsFromDb = async (req, res) => {
  try {
    const tokens = {
      metaAccessToken: process.env.META_ACCESS_TOKEN,
      metaAccessTokenInstagram: process.env.META_ACCESS_TOKEN_INSTAGRAM,
      apifyToken: process.env.APIFY_TOKEN,
      youtubeApiKey: process.env.YOUTUBE_API_KEY,
    };

    const metrics = await Metric.find({ platformName: { $in: SUPPORTED_PLATFORMS } });

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
        successfulPlatforms.push(resItem.platform);
        allNewPosts.push(...resItem.data.slice(0, 3)); 
      } else if (resItem.data && !Array.isArray(resItem.data)) {
        successfulPlatforms.push(resItem.platform);
        allNewPosts.push(resItem.data);
      }
    });

    // ─── PHẦN QUAN TRỌNG NHẤT: ĐỒNG BỘ INDEX & LƯU DB ───

    // 1. Ép MongoDB đồng bộ lại index. Nó sẽ tự động tìm và xóa cái luật unique: true 
    // của platform cũ, giúp các bài viết thứ 2, thứ 3 được lưu bình thường.
    await TopPost.syncIndexes();

    if (successfulPlatforms.length > 0) {
      // 2. Dọn rác: Xóa các bài posts cũ của những platform cào thành công, 
      // và xóa luôn các bản ghi bị lỗi platform: null (như bạn thấy trong GET API)
      await TopPost.deleteMany({ 
        $or: [
          { platform: { $in: successfulPlatforms } },
          { platform: null }
        ]
      });
      
      // 3. Chèn toàn bộ 12 bài posts mới vào DB
      await TopPost.insertMany(allNewPosts, { ordered: false }).catch(err => {
         console.warn('[TopPosts] Cảnh báo khi lưu DB (Có thể do trùng URL):', err.message);
      });
    }

    const summary = {
      message: `Cập nhật top posts hoàn tất. Đã lưu ${allNewPosts.length} bài viết mới.`,
      insertedPosts: allNewPosts,
      errors: failedPosts,
    };

    if (res) return res.status(200).json(summary);
    return summary;
  } catch (error) {
    console.error('[TopPosts] Refresh error:', error);
    if (res) res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật top posts' });
  }
};

export const getCachedTopPosts = async (req, res) => {
  try {
    const posts = await TopPost.find().sort({ updatedAt: -1 });

    if (posts.length === 0) {
      return res.status(200).json({
        message: 'Chưa có dữ liệu cache. Gọi GET /api/v1/insights/top-posts/refresh trước để cào dữ liệu lần đầu.',
        total: 0,
        posts: [],
      });
    }

    const groupedPosts = posts.reduce((acc, post) => {
      if (post.platform) { // Bỏ qua nếu platform vô tình bị null
        if (!acc[post.platform]) acc[post.platform] = [];
        acc[post.platform].push(post);
      }
      return acc;
    }, {});

    res.status(200).json({
       total: posts.length,
       posts: posts,
       groupedByPlatform: groupedPosts
    });
  } catch (error) {
    console.error('[TopPosts] Get cached error:', error);
    res.status(500).json({ message: 'Lỗi hệ thống khi lấy top posts', error: error.message });
  }
};