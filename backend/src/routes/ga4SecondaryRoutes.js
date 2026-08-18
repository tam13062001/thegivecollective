// routes/ga4SecondaryRoutes.js
import express from 'express';
import {
  getGA4StatsSecondary,
  refreshGA4StatsSecondary,
  updateGA4WebsiteSecondary,
  saveDailyGA4History,
  getGA4History,
} from '../controllers/ga4SecondaryController.js';

const router = express.Router();

router.get('/ga4-secondary', getGA4StatsSecondary);
router.get('/ga4-secondary/refresh', refreshGA4StatsSecondary);
router.put('/ga4-secondary/website', updateGA4WebsiteSecondary);

// Lịch sử
router.get('/ga4-secondary/history', getGA4History);
router.post('/ga4-secondary/save-history', saveDailyGA4History);
router.get('/ga4-secondary/save-history', saveDailyGA4History);
export default router;