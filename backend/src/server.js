import dotenv from 'dotenv';
import express from 'express';
import tasksRoutes from './routes/tasksRoutes.js';
import historyRoutes from './routes/historyRoute.js';
import insightsRoutes from './routes/Insights.js';
import topPostsRouter from './routes/ToppostsRoute.js';
import ga4Routes from './routes/ga4Routes.js';
import ga4SecondaryRoutes from './routes/ga4secondaryroutes.js';
import { takeSnapshot } from './jobs/snapshotjob.js';
import {triggerAutoScrape} from './jobs/autoScrapeJob.js';
import { connectDB } from './config/db.js';
import cors from 'cors';
import CronLog from './models/CronLog.js';

dotenv.config();
const port = process.env.PORT || 5001;

const app = express();

// --- 1. MIDDLEWARE PHẢI ĐỂ Ở TRÊN CÙNG ---

// Chuyển CORS lên đầu tiên để mở cửa trước khi làm bất cứ việc gì khác
app.use(cors({
  origin: [
    'https://client.100xmedia.agency',
    'https://thegivecollective.vercel.app',  
    'http://localhost:5173',                  
    'http://localhost:3000',
    'https://analytics.thegivecollective.com',
  ],
  credentials: true,
}));

// Hoặc nếu bạn muốn nhanh/tiện nhất để test mọi link: app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- 2. KHAI BÁO ROUTER SAU KHI ĐÃ ĐI QUA CÁC MIDDLEWARE ---
app.use("/api/v1", tasksRoutes);
app.use("/api/v1", historyRoutes);
app.use('/api/v1/insights', insightsRoutes);
app.use('/api/v1/insights', topPostsRouter);
app.use('/api/v1', ga4Routes);
app.use('/api/v1', ga4SecondaryRoutes);
// Gợi ý: Chắc là bạn sẽ cần khai báo sử dụng historyRoutes ở đây
// app.use("/api/v1/history", historyRoutes); 

app.get('/api/v1/trigger-snapshot', async (req, res) => {
  try {
    console.log("Bắt đầu chạy snapshot thủ công...");
    await takeSnapshot();
    res.status(200).json({ success: true, message: "Snapshot đã chạy thành công!" });
  } catch (error) {
    console.error("Lỗi khi chạy snapshot:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/v1/trigger-autoscrape', async (req, res) => {
  try {
    console.log("Bắt đầu chạy auto-scrape thủ công...");
    await triggerAutoScrape();
    res.status(200).json({ success: true, message: "Auto-scrape đã chạy thành công!" });
  } catch (error) {
    console.error("Lỗi khi chạy auto-scrape:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.get('/api/v1/cron/daily-job', async (req, res) => {
  // Bảo vệ endpoint khỏi bị gọi từ bên ngoài (Vercel gửi header này khi cron gọi)
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const log = { startedAt: new Date(), steps: [] };

  try {
    console.log('[CRON] Bắt đầu daily job:', new Date().toISOString());

    await triggerAutoScrape();
    log.steps.push({ step: 'autoscrape', status: 'success', at: new Date() });

    await takeSnapshot();
    log.steps.push({ step: 'snapshot', status: 'success', at: new Date() });

    log.status = 'success';
  } catch (error) {
    console.error('[CRON] Lỗi:', error);
    log.status = 'failed';
    log.error = error.message;
  } finally {
    log.finishedAt = new Date();
    await CronLog.create(log); // xem mục 3
  }

  res.status(200).json(log);
});

app.get('/api/v1/cron/logs', async (req, res) => {
  const logs = await CronLog.find().sort({ startedAt: -1 }).limit(20);
  res.json(logs);
});

// --- 3. KẾT NỐI DB VÀ CHẠY SERVER ---
connectDB().then(() => {
    // Chỉ listen port khi chạy ở máy tính (local)
    // Trên Vercel (môi trường production), Vercel sẽ tự quản lý cổng
    if (process.env.NODE_ENV !== 'production') {
        app.listen(port, () => {
            console.log("Server started on port " + port);
        });
    }
}).catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1); 
});

// BẮT BUỘC: Export app ra để Vercel biến nó thành Serverless Function
export default app;