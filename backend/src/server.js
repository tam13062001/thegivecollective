import dotenv from 'dotenv';
import express, { response } from 'express';
import tasksRoutes from './routes/tasksRoutes.js';
import { connectDB } from './config/db.js';

dotenv.config();
const port = process.env.PORT || 5001;

const app = express();

connectDB();

app.use("/api/tasks", tasksRoutes);

app.listen(port, () =>{
    console.log("server started")
})

