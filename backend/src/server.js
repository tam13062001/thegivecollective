import dotenv from 'dotenv';
import express from 'express';
import tasksRoutes from './routes/tasksRoutes.js';
import historyRoutes from './routes/historyRoute.js'; // Đã sửa thành import và thêm .js
import { takeSnapshot } from './jobs/snapshotjob.js';
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
  ],
  credentials: true,
}));

// Hoặc nếu bạn muốn nhanh/tiện nhất để test mọi link: app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- 2. KHAI BÁO ROUTER SAU KHI ĐÃ ĐI QUA CÁC MIDDLEWARE ---
app.use("/api/v1", tasksRoutes);
app.use("/api/v1", historyRoutes);
// Gợi ý: Chắc là bạn sẽ cần khai báo sử dụng historyRoutes ở đây
// app.use("/api/v1/history", historyRoutes); 

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