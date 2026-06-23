/**
 * history.routes.js
 *
 * Mount trong server.js:
 *   app.use('/api/history', require('./history.routes'));
 */

import express from 'express';
import StatsHistory from '../models/statsHistory.js';

const router = express.Router();


/**
 * GET /api/history
 * Query params:
 *   - days   : số ngày cần lấy (mặc định 30)
 *   - taskId : lọc theo 1 platform cụ thể (optional)
 *
 * Trả về mảng điểm dữ liệu đã aggregate theo ngày:
 * [{ date, views, posts, followers, platforms: [...] }]
 */
router.get('/history', async (req, res) => {
  try {
    const days   = parseInt(req.query.days)   || 30;
    const taskId = req.query.taskId           || null;

    // Tính ngày bắt đầu
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    // Build query
    const query = { date: { $gte: sinceStr } };
    if (taskId) query.taskId = taskId;

    const rows = await StatsHistory.find(query).sort({ date: 1 }).lean();

    if (taskId) {
      // Lọc theo 1 platform — trả thẳng từng ngày
      const data = rows.map((r) => ({
        date:          r.date,
        views:         r.viewsCount,
        posts:         r.postsCount,
        followers:     r.followersCount,
        platformName:  r.platformName,
        accountHandle: r.accountHandle,
      }));
      return res.json(data);
    }

    // All platforms — aggregate tổng theo ngày
    const byDate = new Map();
    for (const r of rows) {
      const prev = byDate.get(r.date) ?? { date: r.date, views: 0, posts: 0, followers: 0, platforms: [] };
      prev.views     += r.viewsCount     || 0;
      prev.posts     += r.postsCount     || 0;
      prev.followers += r.followersCount || 0;
      if (!prev.platforms.includes(r.platformName)) {
        prev.platforms.push(r.platformName);
      }
      byDate.set(r.date, prev);
    }

    res.json(Array.from(byDate.values()));
  } catch (err) {
    console.error('[History API]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/history/platforms
 * Trả về danh sách platforms đã có lịch sử (để populate dropdown)
 */
router.get('/history/platforms', async (req, res) => {
  try {
    const platforms = await StatsHistory.aggregate([
      {
        $group: {
          _id:           '$taskId',
          platformName:  { $last: '$platformName' },
          accountHandle: { $last: '$accountHandle' },
        },
      },
    ]);
    res.json(platforms.map((p) => ({ taskId: p._id, platformName: p.platformName, accountHandle: p.accountHandle })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;