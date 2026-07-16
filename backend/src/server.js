import dotenv from 'dotenv';
import express from 'express';
import tasksRoutes from './routes/tasksRoutes.js';
import historyRoutes from './routes/historyRoute.js';
import insightsRoutes from './routes/Insights.js';
import topPostsRouter from './routes/TopPosts.js';
import { takeSnapshot } from './jobs/snapshotjob.js';
import {triggerAutoScrape} from './jobs/autoScrapeJob.js';
import { connectDB } from './config/db.js';
import cors from 'cors';

dotenv.config();
const port = process.env.PORT || 5001;

const app = express();

// --- 1. MIDDLEWARE PHẢI ĐỂ Ở TRÊN CÙNG ---

// Chuyển CORS lên đầu tiên để mở cửa trước khi làm bất cứ việc gì khác
app.use(cors({
  origin: [
    'https://thegivecollective.vercel.app',  // FE domain
    'http://localhost:5173',                  // local dev
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