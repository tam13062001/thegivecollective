import mongoose from 'mongoose'; // Thay require bằng import

const statsHistorySchema = new mongoose.Schema({
  date: {
    type: String, // "2026-06-23" — ISO date string, dễ query/group
    required: true,
    index: true,
  },
  platformName: {
    type: String,
    required: true,
    index: true,
  },
  accountHandle: {
    type: String,
    required: true,
  },
  profileUrl: String,
  followersCount: { type: Number, default: 0 },
  postsCount:     { type: Number, default: 0 },
  viewsCount:     { type: Number, default: 0 },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task', // tham chiếu sang collection tasks hiện tại
    index: true,
  },
});

// Mỗi platform chỉ có 1 record/ngày → upsert theo date + taskId
statsHistorySchema.index({ date: 1, taskId: 1 }, { unique: true });

// Thay module.exports bằng export default
const StatsHistory = mongoose.model('StatsHistory', statsHistorySchema);
export default StatsHistory;