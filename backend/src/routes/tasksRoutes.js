import express from 'express';
import {getAllMetric, CreateMetric, UpaateTask, DeleteTask} from '../controllers/taskcontrollers.js'
const router = express.Router();

router.get("/", getAllMetric)

router.post("/", CreateMetric)

router.put("/:id", UpaateTask)

router.delete("/:id", DeleteTask)

export default router;