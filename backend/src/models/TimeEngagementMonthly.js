import mongoose from 'mongoose';

const TimeEngagementMonthlySchema = new mongoose.Schema({
  ig_user_id: {
    type: String,
    required: true,
    unique: true, // mỗi ig_user_id chỉ có 1 document
  },
  // key động dạng "Jan-2022", "Feb-2022"... nên dùng Mixed
  monthlyStats: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
}, {
  minimize: false, // tránh Mongoose tự xóa object rỗng trong field Mixed
});

const TimeEngagementMonthly = mongoose.model('TimeEngagementMonthly', TimeEngagementMonthlySchema);

export default TimeEngagementMonthly;