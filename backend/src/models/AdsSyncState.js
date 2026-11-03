// models/AdsSyncState.js — trạng thái đồng bộ Google Sheet -> MongoDB (1 document)
import mongoose from 'mongoose';

const adsSyncStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'facebook_ads' },
  hash: String, // hash nội dung sheet lần đồng bộ gần nhất
  lastCheckedAt: Date, // lần cuối đọc sheet
  dataChangedAt: Date, // lần cuối dữ liệu thực sự thay đổi
  taken: String, // nhãn hiển thị, vd "Nov 3, 2026, 8:44 am SGT" (status_fetched_at mới nhất)
  counts: { utd: Number, breakdowns: Number },
  lastResult: { upserted: Number, modified: Number, deleted: Number },
  lastError: String,
  lastErrorAt: Date,
});

export default mongoose.model('AdsSyncState', adsSyncStateSchema);
