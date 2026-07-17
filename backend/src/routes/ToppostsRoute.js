// routes/TopPosts.js
import express from 'express';
import { getCachedTopPosts, refreshTopPostsFromDb } from '../controllers/temp.js';
import { getCachedAllPosts, refreshAllPostsFromDb } from '../controllers/allpostcontroller.js';

const router = express.Router();

router.get('/top-posts', getCachedTopPosts);

router.get('/top-posts/refresh', refreshTopPostsFromDb);

router.get('/all-posts', getCachedAllPosts);

router.get('/all-posts/refresh', refreshAllPostsFromDb);

export default router;

