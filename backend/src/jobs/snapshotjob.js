/**
 * snapshotjob.js
 *
 * Chạy mỗi ngày lúc 23:59 — đọc toàn bộ tasks (platforms) hiện tại
 * và lưu 1 bản snapshot vào StatsHistory.
 *
 * Setup trong server.js / index.js:
 * import './jobs/snapshotjob.js';
 *
 * Cần cài: npm install node-cron
 */

import cron from 'node-cron'; // Sửa require thành import
import StatsHistory from '../models/statsHistory.js'; // Nhớ thêm đuôi .js

// Import Metric model của bạn
import Task from '../models/Metric.js'; // Nhớ thêm đuôi .js

export async function takeSnapshot() {
  const today = new Date().toISOString().split('T')[0]; // Ví dụ: "2026-06-23"
  console.log(`[Snapshot] Bắt đầu chụp snapshot ngày ${today}...`);

  try {
    const tasks = await Task.find({});

    if (!tasks.length) {
      console.log('[Snapshot] Không có platform nào để snapshot.');
      return;
    }

    const ops = tasks.map((task) => ({
      updateOne: {
        filter: { date: today, taskId: task._id },
        update: {
          $set: {
            date:           today,
            taskId:         task._id,
            platformName:   task.platformName,
            accountHandle:  task.accountHandle,
            profileUrl:     task.profileUrl     || '',
            followersCount: task.followersCount || 0,
            postsCount:     task.postsCount     || 0,
            viewsCount:     task.viewsCount     || 0,
          },
        },
        upsert: true, // Nếu đã có record ngày hôm nay thì ghi đè
      },
    }));

    const result = await StatsHistory.bulkWrite(ops);
    console.log(
      `[Snapshot] ✅ Xong — upserted: ${result.upsertedCount}, modified: ${result.modifiedCount}`
    );
  } catch (err) {
    console.error('[Snapshot] ❌ Lỗi:', err.message);
  }
}

// Chạy mỗi ngày lúc 23:59
cron.schedule('59 23 * * *', () => {
  takeSnapshot();
});