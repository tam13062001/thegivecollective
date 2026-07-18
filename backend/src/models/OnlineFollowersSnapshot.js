import mongoose from 'mongoose';

const HourStatSchema = new mongoose.Schema({
  pt_hour: { type: Number, required: true },
  vn_hour: { type: Number, required: true },
  followers_online: { type: Number, required: true }
}, { _id: false });

// Schema chính
const TimeEngagementSchema = new mongoose.Schema({
  ig_user_id: { 
    type: String, 
    required: true,
    index: true 
  },
  recommended_vn_times: [{ type: String }],
  top_hours_detail: [HourStatSchema],
  full_day_stats: [HourStatSchema]
}, { 
  timestamps: true 
});

// Export default model
export default mongoose.model('TimeEngagement', TimeEngagementSchema);