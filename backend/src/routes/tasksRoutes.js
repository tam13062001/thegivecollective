import express from 'express';
import {getAllMetric, CreateMetric, UpdateMetric, DeleteMetric} from '../controllers/taskcontrollers.js'
const router = express.Router();

router.get("/", getAllMetric)

router.post("/", CreateMetric)

router.put("/:id", UpdateMetric)

router.delete("/:id", DeleteMetric)

export default router;