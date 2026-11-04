import express from 'express';
import { getAdsBoosting, syncAds, adsSyncStatus } from '../controllers/adsBoostingController.js';
import { getTodos, patchTodo, runTodos } from '../controllers/aiTodoController.js';

const router = express.Router();

router.get('/ads-boosting', getAdsBoosting);
router.get('/ads-boosting/status', adsSyncStatus);
router.post('/ads-boosting/sync', syncAds); // Apps Script
router.get('/cron/ads-sync', syncAds); // Vercel cron

// AI ToDo
router.get('/ads-boosting/todos', getTodos);
router.patch('/ads-boosting/todos/:id', patchTodo);
router.post('/ads-boosting/todos/generate', runTodos); // chạy tay (CRON_SECRET)
router.get('/cron/ai-todo', runTodos); // Vercel cron (CRON_SECRET)

export default router;
