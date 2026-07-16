// routes/TopPosts.js
import express from 'express';
import { getCachedTopPosts, refreshTopPostsFromDb } from '../controllers/topPostController.js';

const router = express.Router();

// Frontend (InsightsPage) gọi cái này — đọc cache trong DB, nhanh.
router.get('/top-posts', getCachedTopPosts);

// Cron job gọi cái này 1 lần/ngày để cào lại + cache — KHÔNG gọi từ frontend.
// Bảo vệ bằng CRON_SECRET để tránh ai đó gọi public URL này tốn quota API.
router.get('/top-posts/refresh', (req, res, next) => {
  const auth = req.headers.authorization;
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}, refreshTopPostsFromDb);

export default router;

