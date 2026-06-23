import dotenv from 'dotenv';
import express, { response } from 'express';
import tasksRoutes from './routes/tasksRoutes.js';
import { connectDB } from './config/db.js';

dotenv.config();
const port = process.env.PORT || 5001;

const app = express();
// 1. Kích hoạt middleware để Express đọc được JSON từ request body
app.use(express.json());

// 2. (Tùy chọn) Kích hoạt để đọc dữ liệu từ form-urlencoded (nếu Frontend có dùng form submit)
app.use(express.urlencoded({ extended: true }));

app.use("/api/tasks", tasksRoutes);

connectDB().then(() => {
    app.listen(port, () => {
        console.log("server started")
    })
}).catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1); // Dừng server nếu không kết nối được DB
});