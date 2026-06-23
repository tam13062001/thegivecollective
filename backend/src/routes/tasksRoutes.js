import express from 'express';
import {getAllMetric, CreateMetric, UpdateMetric, DeleteMetric} from '../controllers/taskcontrollers.js'
const router = express.Router();

router.get("/tasks/", getAllMetric)

router.post("/tasks/", CreateMetric)

router.put("/tasks/:id", UpdateMetric)

router.delete("/tasks/:id", DeleteMetric)

export default router;