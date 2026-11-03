import express from 'express';
import { getAdsBoosting, syncAds, adsSyncStatus } from '../controllers/adsBoostingController.js';

const router = express.Router();

router.get('/ads-boosting', getAdsBoosting);
router.get('/ads-boosting/status', adsSyncStatus);
router.post('/ads-boosting/sync', syncAds); // Apps Script
router.get('/cron/ads-sync', syncAds); // Vercel cron

export default router;
