// routes/TopPosts.js
import express from 'express';
import { getCachedTopPosts, refreshTopPostsFromDb } from '../controllers/temp.js';
import {
  getCachedAllPosts,
  refreshAllPostsFromDb,
  getInstagramProfileClicks,
  getInstagramProfileClicksHistory,
} from '../controllers/allpostcontroller.js';

const router = express.Router();

router.get('/top-posts', getCachedTopPosts);

router.get('/top-posts/refresh', refreshTopPostsFromDb);

router.get('/all-posts', getCachedAllPosts);

router.get('/all-posts/refresh', refreshAllPostsFromDb);

// Instagram: clicks là metric cấp tài khoản, trả riêng khỏi danh sách bài viết
router.get('/instagram/profile-clicks', getInstagramProfileClicks);
// Lịch sử theo ngày của cùng metric trên, dùng cho chart daily ở Homepage
router.get('/instagram/profile-clicks/history', getInstagramProfileClicksHistory);

export default router;

