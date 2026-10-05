import express from 'express';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import AllPost from '../models/Allpost.js';
import StatsHistory from '../models/statsHistory.js';
import ShareLoginAttempt from '../models/ShareLoginAttempt.js';
import { getIgAudienceDemographics } from '../services/igDemographics.js';
import { createShareToken, verifyShareToken, passwordMatches } from '../utils/socialShareAuth.js';

const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.post('/unlock', async (req, res) => {
  if (!process.env.SOCIAL_SHARE_PASSWORD || (process.env.SOCIAL_SHARE_SECRET || '').length < 32) {
    return res.status(503).json({ message: 'Share access is not configured.' });
  }
  try {
    // Shared MongoDB counter works across serverless instances. Do not trust client-supplied X-Forwarded-For.
    const bucket = Math.floor(Date.now() / 900000);
    const id = createHash('sha256').update(`${req.ip}:${bucket}`).digest('hex');
    const attempt = await ShareLoginAttempt.findOneAndUpdate({ _id: id }, {
      $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 900000) },
    }, { upsert: true, new: true });
    if (attempt.count > 20) {
      res.set('Retry-After', String(Math.ceil(((bucket + 1) * 900000 - Date.now()) / 1000)));
      return res.status(429).json({ message: 'Too many attempts. Please try again in 15 minutes.' });
    }
    if (!passwordMatches(req.body?.password, process.env.SOCIAL_SHARE_PASSWORD)) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }
    return res.json({ token: createShareToken(), expiresIn: 28800 });
  } catch (error) {
    console.error('[Social share unlock]', error.message);
    return res.status(503).json({ message: 'Share access is temporarily unavailable.' });
  }
});
router.use((req, res, next) => {
  try {
    const header = req.get('authorization') || '';
    if (!header.startsWith('Bearer ') || !verifyShareToken(header.slice(7))) {
      return res.status(401).json({ message: 'Please enter the sharing password.' });
    }
    next();
  } catch { res.status(503).json({ message: 'Share access is not configured.' }); }
});
router.get('/session', (_req, res) => res.json({ scope: 'social-dashboard' }));
router.get('/top-posts', async (_req, res) => {
  try {
    const groups = await Promise.all(['instagram', 'facebook', 'tiktok'].map(platform =>
      AllPost.find({ platform: new RegExp(`^${platform}$`, 'i') })
        .select('platform title views likes shares clicks date url contentType rawMediaType')
        .sort({ views: -1, likes: -1, shares: -1, _id: 1 }).limit(10).lean()
    ));
    res.json(groups.flat());
  } catch { res.status(503).json({ message: 'Could not load top posts.' }); }
});
router.get('/demographics', async (_req, res) => {
  try {
    res.json(await getIgAudienceDemographics(process.env.IG_BUSINESS_ACCOUNT_ID || '17841422427064625'));
  } catch { res.status(502).json({ message: 'Instagram audience data is unavailable.' }); }
});
router.get('/history/platforms', async (_req, res) => {
  try {
    const rows = await StatsHistory.aggregate([
      { $match: { platformName: { $not: /^GoogleAnalytics$/i } } },
      { $sort: { date: 1 } },
      { $group: { _id: '$taskId', platformName: { $last: '$platformName' }, accountHandle: { $last: '$accountHandle' } } },
      { $sort: { platformName: 1 } },
    ]);
    res.json(rows.map(p => ({ taskId: p._id, platformName: p.platformName, accountHandle: p.accountHandle })));
  } catch { res.status(503).json({ message: 'Could not load profiles.' }); }
});
router.get('/history', async (req, res) => {
  const days = Number(req.query.days ?? 30);
  if (![7, 14, 30, 90].includes(days)) return res.status(400).json({ message: 'Invalid date range.' });
  const taskId = req.query.taskId;
  if (taskId && (typeof taskId !== 'string' || !mongoose.isValidObjectId(taskId))) {
    return res.status(400).json({ message: 'Invalid profile.' });
  }
  try {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    const query = { date: { $gte: since.toISOString().slice(0, 10) }, platformName: { $not: /^GoogleAnalytics$/i } };
    if (taskId) query.taskId = taskId;
    const rows = await StatsHistory.find(query).sort({ date: 1 }).lean();
    const byDate = new Map();
    for (const row of rows) {
      const point = byDate.get(row.date) || { date: row.date, views: 0, posts: 0, followers: 0 };
      point.views += row.viewsCount || 0;
      point.posts += row.postsCount || 0;
      point.followers += row.followersCount || 0;
      byDate.set(row.date, point);
    }
    res.json([...byDate.values()]);
  } catch { res.status(503).json({ message: 'Could not load daily growth.' }); }
});
export default router;
