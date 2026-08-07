import express from 'express';
import {
  getGA4StatsSecondary,
  refreshGA4StatsSecondary,
  updateGA4WebsiteSecondary,
} from '../controllers/ga4SecondaryController.js';

const router = express.Router();

// Toàn bộ route ga4-secondary chỉ nhận request từ analytics.thegivecollective.com


router.get('/ga4-secondary', getGA4StatsSecondary);
router.post('/ga4-secondary/refresh', refreshGA4StatsSecondary);
router.put('/ga4-secondary/website', updateGA4WebsiteSecondary);

export default router;