// routes/TopPosts.js
import express from 'express';
import { getCachedTopPosts, refreshTopPostsFromDb } from '../controllers/temp.js';

const router = express.Router();

router.get('/top-posts', getCachedTopPosts);

router.get('/top-posts/refresh', refreshTopPostsFromDb);

export default router;

