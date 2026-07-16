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

    // Lọc lấy bản ghi mới nhất cho từng platform
    const latestPerPlatform = new Map();
    for (const m of metrics) {
      const existing = latestPerPlatform.get(m.platformName);
      if (!existing || m.scrapedAt > existing.scrapedAt) {
        latestPerPlatform.set(m.platformName, m);
      }
    }

    // Gọi API cào dữ liệu cho tất cả platform
    const results = await Promise.all(
      Array.from(latestPerPlatform.values()).map(async (m) => {
        const data = await fetchTopPostForPlatform(m.platformName, m.accountHandle, tokens);
        return { platform: m.platformName, data };
      })
    );

    const successfulPlatforms = [];
    const allNewPosts = [];
    const failedPosts = [];

    // Phân loại kết quả trả về
    results.forEach((resItem) => {
      if (resItem.data && resItem.data.error) {
        failedPosts.push(resItem);
      } else if (Array.isArray(resItem.data) && resItem.data.length > 0) {
        // Nếu Service trả về mảng -> Lấy top 3 và đẩy vào danh sách insert
        successfulPlatforms.push(resItem.platform);
        allNewPosts.push(...resItem.data.slice(0, 3)); 
      } else if (resItem.data && !Array.isArray(resItem.data)) {
        // Fallback: Nếu Service chỉ trả về 1 object -> Vẫn giữ lại
        successfulPlatforms.push(resItem.platform);
        allNewPosts.push(resItem.data);
      }
    });

    // Xóa cache cũ & Lưu cache mới (Chỉ áp dụng cho các platform cào thành công)
    if (successfulPlatforms.length > 0) {
      // 1. Xóa các bài posts cũ của những platform đã lấy được data mới
      await TopPost.deleteMany({ platform: { $in: successfulPlatforms } });
      
      // 2. Chèn toàn bộ các bài posts mới vào DB
      // Bỏ qua lỗi duplicate key (nếu có URL trùng nhau bị lọt vào)
      await TopPost.insertMany(allNewPosts, { ordered: false }).catch(err => {
         console.warn('[TopPosts] Một số post bị trùng URL và bị bỏ qua:', err.message);
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
        posts: [],
      });
    }

    // Tùy chọn: Nhóm dữ liệu theo platform cho Frontend dễ render
    const groupedPosts = posts.reduce((acc, post) => {
      if (!acc[post.platform]) acc[post.platform] = [];
      acc[post.platform].push(post);
      return acc;
    }, {});

    // Trả về cả mảng phẳng và mảng đã nhóm
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