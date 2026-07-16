// routes/Insights.js
import express from 'express';
import { getIgAudienceDemographics } from '../services/igDemographics.js';

const router = express.Router();

// ID đã xác nhận thật cho Page "The Give Collective" -> IG Business Account
// Có thể chuyển thành biến môi trường IG_BUSINESS_ACCOUNT_ID nếu sau này đổi tài khoản.
const IG_BUSINESS_ACCOUNT_ID = process.env.IG_BUSINESS_ACCOUNT_ID || '17841422427064625';

router.get('/demographics', async (req, res) => {
  try {
    const data = await getIgAudienceDemographics(IG_BUSINESS_ACCOUNT_ID);
    res.json(data);
  } catch (error) {
    console.error('Error fetching IG demographics:', error.message);
    res.status(502).json({ message: 'Could not fetch demographics from Meta API' });
  }
});

export default router;

// Trong app.js / index.js:
// import insightsRouter from './routes/Insights.js';
// app.use('/api/v1/insights', insightsRouter);