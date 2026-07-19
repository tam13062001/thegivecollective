import mongoose from 'mongoose';

const HourStatSchema = new mongoose.Schema(
  {
    vn_hour: { type: Number, required: true },
    followers_online: { type: Number, required: true }
  },
  { _id: false }
);

const DayStatSchema = new mongoose.Schema(
  {
    end_time: { type: String, required: true },
    top3_vn_times: { type: [String], default: [] },
    full_day_stats: { type: [HourStatSchema], default: [] }
  },
  { _id: false }
);

const TimeEngagementWeeklySchema = new mongoose.Schema(
  {
    ig_user_id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    // key là tên thứ trong tuần: 'Chủ Nhật', 'Thứ 2', ..., 'Thứ 7'
    weeklyStats: {
      type: Map,
      of: DayStatSchema,
      default: {}
    },
    updated_at: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

const TimeEngagementWeekly = mongoose.model('TimeEngagementWeekly', TimeEngagementWeeklySchema);

export default TimeEngagementWeekly;