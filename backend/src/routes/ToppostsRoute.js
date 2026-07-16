// routes/TopPosts.js
import express from 'express';
import { getCachedTopPosts, refreshTopPostsFromDb } from '../controllers/temp.js';

const router = express.Router();

// Frontend (InsightsPage) gọi cái này — đọc cache trong DB, nhanh.
router.get('/top-posts', getCachedTopPosts);

// Cron job gọi cái này 1 lần/ngày để cào lại + cache — KHÔNG gọi từ frontend.
// Bảo vệ bằng CRON_SECRET để tránh ai đó gọi public URL này tốn quota API.
router.get('/top-posts/refresh', refreshTopPostsFromDb);

export default router;

