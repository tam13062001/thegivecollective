// models/CronLog.js
import mongoose from 'mongoose';

const cronLogSchema = new mongoose.Schema({
  startedAt: Date,
  finishedAt: Date,
  status: { type: String, enum: ['success', 'failed'] },
  steps: [{ step: String, status: String, at: Date }],
  error: String,
});

export default mongoose.model('CronLog', cronLogSchema);